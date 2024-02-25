import { createLogger, format } from "../logger";
import { Duplex } from "node:stream";
import net, { AddressInfo } from 'node:net';
import { DuplexConnectionError } from "./errors";
import { type TunnelEventEmitter } from './tunnel-events';
import { createServer, type Server } from 'node:http'
import { type TunnelConfig } from '../client/client-config';
import htmlResponse from './fallback-connection.html?raw';

const connectionLogger = createLogger('localtunnel:fallback:connection');
const hostLogger = createLogger('localtunnel:fallback:host');

export const createFallbackConnection = async (tunnelConfig: TunnelConfig, emitter: TunnelEventEmitter) => {

	let host = await createHost(tunnelConfig, emitter);
    const address = (host.address() as AddressInfo);
	let connection = await createConnection(address, emitter);

	emitter.on('app-close', () => {
		connection.removeAllListeners();
		connection.end();
		connection.destroy();
	})
	connection.on('close', async () => {
		console.log('fallback', 'close');
	})
	connection.on('drain', async () => {
		console.log('fallback', 'drain');
	})
	connection.on('end', async () => {
		console.log('fallback', 'end');
	})
	connection.on('disconnect', async () => {
		console.log('fallback', 'disconnect');
	})
	connection.on('finish', async () => {
		console.log('fallback', 'finish');
	})
	connection.on('error', async (e) => {
		console.log('fallback', 'e', e);
	})

	return connection;
};

const createHost = (tunnelConfig: TunnelConfig, emitter: TunnelEventEmitter) => new Promise<Server>((resolve, reject) => {

	hostLogger.enabled
		&& hostLogger.log('establishing fallback host');

    const response = htmlResponse.replaceAll('${address}', format.localAddress(tunnelConfig));

	const fallbackHost = createServer((req, res) => {
        res.write(response);
        res.end();
    });


    fallbackHost.listen({ port: 0 }, () => {
		connectionLogger.enabled
			&& connectionLogger.log('fallback host funning on http:%s', format.address(fallbackHost.address() as AddressInfo));

		resolve(fallbackHost);
    });
});

const createConnection = (address: AddressInfo, emitter: TunnelEventEmitter) => new Promise<Duplex>((resolve, reject) => {
	connectionLogger.enabled
		&& connectionLogger.log('establishing remote connection to http:%s', format.address(address));

	const remoteSocket: Duplex = net
		.createConnection({
			host: address.address,
			port: address.port,
			allowHalfOpen: true,
			keepAlive: true
		});

	// TODO specific errors
	remoteSocket.on('error', (err: DuplexConnectionError) => {
		connectionLogger.enabled && connectionLogger.log('socket error %j', err);

		// emit connection refused errors immediately, because they
		// indicate that the tunnel can't be established.
		if (err.code === 'ECONNREFUSED') {
			reject(new Error(
				`connection refused: http:${format.address(address)} (check your firewall settings)`
			));
			return;
		}

		console.log(err)
	});

	remoteSocket.once('connect', () => {
		connectionLogger.enabled
			&& connectionLogger.log('connection to fallback http:%s UP', format.address(address));

		resolve(remoteSocket);
	});
});