import fs from 'node:fs';
import net from 'node:net';
import tls from 'node:tls';
import { createLogger } from '../logger'

import { HeaderHostTransform } from './transforms/header-host-transform';

import type { Duplex } from 'node:stream';
import type { TunnelConfig } from '../client/client-config';
import type { TunnelLease } from './tunnel-lease';
import type { TunnelEventEmitter } from './tunnel-events';

// TODO this file can do with splitting up
const logger = createLogger('localtunnel:tunnel-cluster');
const format = {
  remoteAddress: (tunnelLease: TunnelLease) => 
    `https://${tunnelLease.remote.target}:${tunnelLease.remote.port}`,
  localAddress: (tunnelConfig: TunnelConfig) => 
    `${!!tunnelConfig.https ? 'https' : 'http'}://${tunnelConfig.hostName}:${tunnelConfig.port}`
}

type DuplexConnectionError = Error & { code: string };

// manages groups of tunnels
export class TunnelCluster {

  #emitter:  TunnelEventEmitter;
  #remoteEstablished: boolean;
  #localEstablished: boolean;
  #remoteSocket: Duplex;
  #localSocket: Duplex;

  constructor(
    private readonly tunnelConfig: TunnelConfig,
    private readonly tunnelLease: TunnelLease,
    emitter: TunnelEventEmitter
  ) {
    this.#emitter = emitter;
  }

  #connectRemote() {

    logger.enabled 
      && logger.log('establishing remote connection to %s', format.remoteAddress(this.tunnelLease));

    this.#remoteEstablished = false;
    const remoteSocketAddress = {
      host: this.tunnelLease.remote.target,
      port: this.tunnelLease.remote.port,
    };
    const remoteSocket: Duplex = net
      .connect(remoteSocketAddress)
      .setKeepAlive(true);
      
    // TODO specific errors
    remoteSocket.on('error', (err: DuplexConnectionError) => {
      logger.enabled && logger.log('remoteSocket error \n %j', err.message);

      // emit connection refused errors immediately, because they
      // indicate that the tunnel can't be established.
      if (err.code === 'ECONNREFUSED' && !this.#remoteEstablished) {
        this.#emitter.emit(
          'tunnel-error',
          new Error(
            `connection refused: ${format.remoteAddress(this.tunnelLease)} (check your firewall settings)`
          )
        );
        
        remoteSocket.end();
        this.#emitter.emit('tunnel-close');
        remoteSocket.destroy();
        return;
      }

      this.#emitter.emit(
        'pipe-error',
        new Error(
          `connection refused: ${format.remoteAddress(this.tunnelLease)}`
        )
      );
    });

    return remoteSocket.pause();
  }
  
  #connectLocal() {

    logger.enabled 
      && logger.log('establishing local connection to %s', format.localAddress(this.tunnelConfig));

    if (logger.enabled && this.tunnelConfig.https.skipCertificateValidation) {
      logger.log('allowing invalid certificates');
    }

    this.#localEstablished = false;
    const localSocketAddress = {
      host: this.tunnelConfig.hostName,
      port: this.tunnelConfig.port,
    };

    const { https } = this.tunnelConfig;

    // connection to local http server
    const localSocket: Duplex = (() => {

      if (!https) return net.connect(localSocketAddress);
      
      const cert = !https.cert ? {} : {
        cert: fs.readFileSync(https.cert.pemLocation),
        key: fs.readFileSync(https.cert.keyLocation),
        ca: https.cert.certificateAuthorityLocation 
          ? [fs.readFileSync(https.cert.certificateAuthorityLocation)] 
          : undefined,
      }
      
      return tls.connect({ 
        ...localSocketAddress,
        rejectUnauthorized: !https.skipCertificateValidation,
        ...cert
      })
    })();

    localSocket.once('connect', () => {
      logger.log('connected locally');
      this.#localEstablished = true;
      this.#remoteSocket.resume();

      let stream = this.#remoteSocket;

      // Use host header transform to replace the host header
      logger.enabled && logger.log('transform Host header to %s', this.tunnelConfig.hostName);
      stream = this.#remoteSocket.pipe(new HeaderHostTransform(this.tunnelConfig));

      // Connect the streams
      stream.pipe(localSocket).pipe(this.#remoteSocket);

      // when local closes, also get a new remote
      localSocket.once('close', hadError => {
        logger.enabled && logger.log('local connection closed [%s]', hadError);
      });
    });

    return localSocket
  };

  open() {

    logger.enabled && logger.log(
      'establishing tunnel %s <> %s',
      format.remoteAddress(this.tunnelLease),
      format.localAddress(this.tunnelConfig)
    );

    // connection to localtunnel server
    this.#remoteSocket = this.#connectRemote();
    if (this.#remoteSocket.destroyed) {
      logger.log('remote destroyed');
      this.#emitter.emit('tunnel-dead', 'Remote server not connected')
      return;
    }
    this.#localSocket = this.#connectLocal();
    
    const remoteClose = () => {
      logger.log('remote close');
      this.#localSocket.end();
      this.#emitter.emit('tunnel-dead', 'remote server closed unexpectedly');
      this.#localSocket.destroy();
      try {
        this.#remoteSocket.destroy();
      } finally {
        // do nothing
      }
    }

    this.#remoteSocket.once('close', remoteClose);

    // TODO some languages have single threaded servers which makes opening up
    // multiple local connections impossible. We need a smarter way to scale
    // and adjust for such instances to avoid beating on the door of the server
    this.#localSocket.once('error', (err: DuplexConnectionError) => {
      logger.log('local error %s', err.message);
      this.#localSocket.end();

      this.#remoteSocket.removeListener('close', remoteClose);

      if (err.code !== 'ECONNREFUSED'
          && err.code !== 'ECONNRESET') {
        return this.#remoteSocket.end();
      }

      // retrying connection to local server
      setTimeout(() => this.#localSocket = this.#connectLocal(), 1000);
    });

    this.#remoteSocket.on('data', data => {
      const match = data.toString().match(/^(\w+) (\S+)/);
      if (match) {
        this.#emitter.emit('pipe-request',
          match[1],
          match[2],
        );
      }
    });

    return new Promise<void>((resolve) => {
      // tunnel is considered open when remote connects
      this.#remoteSocket.once('connect', () => {
        this.#remoteEstablished = true;
        resolve();
        this.#emitter.emit('tunnel-open');
      });
    })
  }
  
  close() {
    return new Promise<void>((resolve) => {
      this.#remoteSocket.end(
        () => this.#localSocket.end(resolve)
      );
    })
  }
};
