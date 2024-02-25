import { createLogger, format } from "../logger";
import { Duplex } from "node:stream";
import net from 'node:net';
import { DuplexConnectionError } from "./errors";
import { type TunnelEventEmitter } from './tunnel-events';
import { type TunnelLease } from "./tunnel-lease";

const logger = createLogger('localtunnel:upstream:connection');

export const createUpstreamConnection = async (tunnelLease: TunnelLease, emitter: TunnelEventEmitter) => {

	let connection = await createConnection(tunnelLease, emitter);

	// This seems to be necessary to prevent the tunnel from closing, event though keepalive is set to true
	const intervalHandle = setInterval(() => {
		fetch(`${tunnelLease.tunnelUrl}?keepalive`).catch(() => {
			// don't care about any error.
		})
	}, 2000);

	emitter.on('app-close', () => {
		clearInterval(intervalHandle);
		connection.removeAllListeners();
		connection.end();
		connection.destroy();
	})
	connection.on('close', async () => {
		console.log('upstream', 'close');
	})
	connection.on('drain', async () => {
		console.log('upstream', 'drain');
	})
	connection.on('end', async () => {
		console.log('upstream', 'end');
	})
	connection.on('disconnect', async () => {
		console.log('upstream', 'disconnect');
	})
	connection.on('finish', async () => {
		console.log('upstream', 'finish');
	})
	connection.on('error', async (e) => {
		console.log('upstream', 'e', e);
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

		console.log(err)
	});


	const initialConnectionError = (e: DuplexConnectionError) => {
		emitter.emit('initial-connection-failed');
		remoteSocket.destroy();
		reject(e);
	}

	remoteSocket.once('error', initialConnectionError);
	remoteSocket.once('connect', () => {
		logger.enabled
			&& logger.log('connection to %s UP', format.remoteAddress(tunnelLease));

		remoteEstablished = true;
		resolve(remoteSocket);
	});
});