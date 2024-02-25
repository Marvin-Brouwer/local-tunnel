import { createLogger, format } from "../logger";
import { Duplex } from "node:stream";
import net from 'node:net';
import { DuplexConnectionError } from "./errors";
import { type TunnelEventEmitter } from './tunnel-events';
import { type TunnelLease } from "./tunnel-lease";

const logger = createLogger('localtunnel:upstream-connection');

export const createUpstreamConnection = async (tunnelLease: TunnelLease, emitter: TunnelEventEmitter) =>  {
     let connection = await createConnection(tunnelLease, emitter);

	emitter.on('app-close', () => {
		connection.removeAllListeners();
		connection.end();
		connection.destroy();
	})
	 connection.on('close', async () => {
		console.log('close');
		// connection.destroy();
		// connection = await createUpstreamConnection(tunnelLease, emitter);
	 })
	 connection.on('drain', async () => {
		console.log('drain');
	 })
	 connection.on('end', async () => {
		console.log('end');
	 })
	 connection.on('disconnect', async () => {
		console.log('disconnect');
	 })
	 connection.on('finish', async () => {
		console.log('finish');
	 })
	 connection.on('error', async (e) => {
		console.log('e', e);
	 })

	 return connection;
};


const createConnection = (tunnelLease: TunnelLease, emitter: TunnelEventEmitter) => new Promise<Duplex>((resolve, reject) => {
    logger.enabled 
        && logger.log('establishing remote connection to %s', format.remoteAddress(tunnelLease));

    let remoteEstablished = false;

    const remoteSocket: Duplex = net
      .createConnection({
			host: tunnelLease.remote.target,
			port: tunnelLease.remote.port,
			allowHalfOpen: true,
			keepAlive: true
		});
      
    // TODO specific errors
    remoteSocket.on('error', (err: DuplexConnectionError) => {
      logger.enabled && logger.log('socket error %j', err);

      // emit connection refused errors immediately, because they
      // indicate that the tunnel can't be established.
      if (err.code === 'ECONNREFUSED' && !remoteEstablished) {		
		reject(new Error(
            `connection refused: ${format.remoteAddress(tunnelLease)} (check your firewall settings)`
		));
        return;
      }

	  console.log(err)
    });

	remoteSocket.once('connect', () => {
		logger.enabled 
			&& logger.log('connection to %s UP', format.remoteAddress(tunnelLease));

		remoteEstablished = true;
		resolve(remoteSocket);
	});
});