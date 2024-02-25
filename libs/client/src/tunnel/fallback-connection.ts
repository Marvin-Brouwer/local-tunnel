import { createLogger, format } from "../logger";
import { Duplex } from "node:stream";
import net, { AddressInfo } from 'node:net';
import { DuplexConnectionError } from "./errors";
import { type TunnelEventEmitter } from './tunnel-events';
import { createServer, IncomingMessage, type Server } from 'node:http'
import { type TunnelConfig } from '../client/client-config';
import htmlResponse from './fallback-connection.html?raw';
import { posix } from "node:path";
import { TunnelLease } from "./tunnel-lease";

const connectionLogger = createLogger('localtunnel:fallback:connection');
const hostLogger = createLogger('localtunnel:fallback:host');

export const createFallbackConnection = async (tunnelConfig: TunnelConfig, tunnelLease: TunnelLease, emitter: TunnelEventEmitter) => {

	let host = await createHost(tunnelConfig, tunnelLease, emitter);
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

const createHost = (tunnelConfig: TunnelConfig, tunnelLease: TunnelLease, emitter: TunnelEventEmitter) => new Promise<Server>((resolve, reject) => {

	hostLogger.enabled
		&& hostLogger.log('establishing fallback host');

    const unavailableResponse = htmlResponse
		.replaceAll('${address}', format.localAddress(tunnelConfig));

	const fallbackHost = createServer(async (request, response) => {
		const unsafePath = decodeURI(request.url.split('?')[0])
		const keepalive = request.url.split('?')[1] === 'keepalive'
		const urlPath = posix.normalize(unsafePath);

		if (request.method === 'OPTIONS' && keepalive) {
			return response.end();
		}

		try {
			const body = await getRequestBody(request);
			await fetch(format.localAddress(tunnelConfig) + urlPath, { 
				method: request.method,
				mode: 'cors',
				body,
				referrer: request.headers.referer,
				headers: {
					...mapHeaders(request.rawHeaders),
					'x-forwarded-host': tunnelLease.cachedTunnelUrl?.host ?? tunnelLease.tunnelUrl.host
				}
			})
				.then(async fetchResponse => {
					response.statusCode = fetchResponse.status;
					response.statusMessage = fetchResponse.statusText;
					const data = await fetchResponse.arrayBuffer();
					if (response.writableEnded) return;
					await new Promise<void>((res,rej) => response.write(Buffer.from(data), e => {
						if (e) rej(e);
						res();
					}));
					return response.end();
				})
				.catch(err => {
					connectionLogger.enabled
						&& connectionLogger.log('unhandled error occurred while forwarding request %j', err)
					response.write(unavailableResponse);
					return response.end();
				})

		} catch (unintendedError) {
			connectionLogger.enabled
				&& connectionLogger.log('unknown error occurred while forwarding request %j', unintendedError)
			response.write(unavailableResponse);
			return response.end();
		}

		if (response.writableEnded) return;

        response.write(unavailableResponse);
        response.end();
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

// TODO this could be more efficient
const mapHeaders = (headers: string[]): string[][] => {
	let headerString = '';
	headers.forEach((element, index) => {
		headerString += element;
		if (index === headers.length -1) return;

		if (index % 2 !== 0) headerString += '\n'
		else headerString += ': ';
	});

	return headerString
		.split('\n')
		.map(rec => rec.split(': '));
}

const getRequestBody = async (request: IncomingMessage): Promise<string | undefined> => {
	if (request.method !== 'POST') return undefined;

	return await new Promise(resolve => request.on('data', function(chunk) {
		console.log("Received body data:");
		resolve(chunk.toString());
	}));
}