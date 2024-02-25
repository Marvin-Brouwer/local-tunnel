import { createLogger, format } from "../logger";
import { Duplex } from "node:stream";
import net from 'node:net';
import { DuplexConnectionError } from "./errors";
import { type TunnelEventEmitter } from './tunnel-events';
import { type TunnelConfig } from "../client/client-config";
import fs from 'node:fs';
import tls from 'node:tls';


const logger = createLogger('localtunnel:downstream:connection');

export const createDownstreamConnection = async (tunnelConfig: TunnelConfig, emitter: TunnelEventEmitter) => {

	let connection = await createConnection(tunnelConfig, emitter);

	emitter.on('app-close', () => {
		connection.removeAllListeners();
		connection.end();
		connection.destroy();
	})
	connection.on('close', async () => {
		console.log('downstream', 'close');
	})
	connection.on('drain', async () => {
		console.log('downstream', 'drain');
	})
	connection.on('end', async () => {
		console.log('downstream', 'end');
	})
	connection.on('disconnect', async () => {
		console.log('downstream', 'disconnect');
	})
	connection.on('finish', async () => {
		console.log('downstream', 'finish');
	})
	connection.on('error', async (e) => {
		console.log('downstream', 'e', e);
	})

	return connection;
};


const createConnection = (tunnelConfig: TunnelConfig, emitter: TunnelEventEmitter) => new Promise<Duplex>((resolve, reject) => {
	logger.enabled
		&& logger.log('establishing local connection to %s', format.localAddress(tunnelConfig));

	const localSocketAddress = {
		host: tunnelConfig.hostName,
		port: tunnelConfig.port,
	};

	const { https } = tunnelConfig;

	// connection to local http server
	const remoteSocket: Duplex = (() => {

		if (!https) return net.createConnection({
			...localSocketAddress,
			allowHalfOpen: true,
			keepAlive: true,
			noDelay: true,
		});

		const cert = !https.cert ? {} : {
			cert: fs.readFileSync(https.cert.pemLocation),
			key: fs.readFileSync(https.cert.keyLocation),
			ca: https.cert.certificateAuthorityLocation
				? [fs.readFileSync(https.cert.certificateAuthorityLocation)]
				: undefined,
		}

		return tls
			.connect({
				...localSocketAddress,
				rejectUnauthorized: !https.skipCertificateValidation,
				...cert
			})
			.setNoDelay(true)
			.setKeepAlive(true)
	})();

	// TODO specific errors
	remoteSocket.on('error', (err: DuplexConnectionError) => {
		logger.enabled && logger.log('socket error %j', err);

		console.log(err)
	});
	
	resolve(remoteSocket);
});