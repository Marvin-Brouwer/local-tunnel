import fs from 'node:fs';
import net from 'node:net';
import tls from 'node:tls';
import debug from 'debug'

import { HeaderHostTransform } from './transforms/header-host-transform';

import type { Duplex } from 'node:stream';
import type { TunnelConfig } from '../client/client-config';
import type { TunnelLease } from './tunnel-lease';
import type { TunnelEventEmitter } from './tunnel-events';

// TODO this file can do with splitting up

const clientDebug = debug('localtunnel:tunnel-cluster');
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

  constructor(
    private readonly tunnelConfig: TunnelConfig,
    private readonly tunnelLease: TunnelLease,
    emitter: TunnelEventEmitter
  ) {
    this.#emitter = emitter;
  }

  #connectRemote() {

    clientDebug.enabled 
      && clientDebug('establishing remote connection to %s', format.remoteAddress(this.tunnelLease));

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
      clientDebug.enabled && clientDebug('remoteSocket error \n %j', err.message);

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
  
  #connectLocal(remoteSocket: Duplex) {

    clientDebug.enabled 
      && clientDebug('establishing local connection to %s', format.localAddress(this.tunnelConfig));

    if (clientDebug.enabled && this.tunnelConfig.https.skipCertificateValidation) {
      clientDebug('allowing invalid certificates');
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
      clientDebug('connected locally');
      this.#localEstablished = true;
      remoteSocket.resume();

      let stream = remoteSocket;

      // Use host header transform to replace the host header
      clientDebug.enabled && clientDebug('transform Host header to %s', this.tunnelConfig.hostName);
      stream = remoteSocket.pipe(new HeaderHostTransform(this.tunnelConfig));

      // Connect the streams
      stream.pipe(localSocket).pipe(remoteSocket);

      // when local closes, also get a new remote
      localSocket.once('close', hadError => {
        clientDebug.enabled && clientDebug('local connection closed [%s]', hadError);
      });
    });

    return localSocket
  };

  open() {

    debug.enabled && clientDebug(
      'establishing tunnel %s <> %s',
      format.remoteAddress(this.tunnelLease),
      format.localAddress(this.tunnelConfig)
    );

    // connection to localtunnel server
    const remoteSocket = this.#connectRemote();
    if (remoteSocket.destroyed) {
      clientDebug('remote destroyed');
      this.#emitter.emit('tunnel-dead', 'Remote server not connected')
      return;
    }
    let localSocket = this.#connectLocal(remoteSocket);
    
    const remoteClose = () => {
      clientDebug('remote close');
      localSocket.end();
      this.#emitter.emit('tunnel-dead', 'remote server closed unexpectedly');
      localSocket.destroy();
      try {
        remoteSocket.destroy();
      } finally {
        // do nothing
      }
    }

    remoteSocket.once('close', remoteClose);

    // TODO some languages have single threaded servers which makes opening up
    // multiple local connections impossible. We need a smarter way to scale
    // and adjust for such instances to avoid beating on the door of the server
    localSocket.once('error', (err: DuplexConnectionError) => {
      clientDebug('local error %s', err.message);
      localSocket.end();

      remoteSocket.removeListener('close', remoteClose);

      if (err.code !== 'ECONNREFUSED'
          && err.code !== 'ECONNRESET') {
        return remoteSocket.end();
      }

      // retrying connection to local server
      setTimeout(() => localSocket = this.#connectLocal(remoteSocket), 1000);
    });

    remoteSocket.on('data', data => {
      const match = data.toString().match(/^(\w+) (\S+)/);
      if (match) {
        this.#emitter.emit('pipe-request',
          match[1],
          match[2],
        );
      }
    });

    // tunnel is considered open when remote connects
    remoteSocket.once('connect', () => {
      this.#remoteEstablished = true;
      this.#emitter.emit('tunnel-open');
    });
  }
};
