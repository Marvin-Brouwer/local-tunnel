import { createLogger, format } from "../logger";
import { Duplex } from "node:stream";
import net, { AddressInfo } from 'node:net';
import { DuplexConnectionError } from "./errors";
import { type TunnelEventEmitter } from './tunnel-events';
import { createServer, IncomingMessage, type Server } from 'node:http'
import { type TunnelConfig } from '../client/client-config';
import htmlResponse from './proxy-error-page.html?raw';
import { posix } from "node:path";
import { TunnelLease } from "./tunnel-lease";

const connectionLogger = createLogger('localtunnel:fallback:connection');
const hostLogger = createLogger('localtunnel:fallback:host');

export const createProxyConnection = async (tunnelConfig: TunnelConfig, tunnelLease: TunnelLease, emitter: TunnelEventEmitter) => {

	const host = await createHost(tunnelConfig, tunnelLease, emitter);
    const address = (host.address() as AddressInfo);
	const connection = await createConnection(address, emitter);

	return connection;
};

const createHost = (tunnelConfig: TunnelConfig, tunnelLease: TunnelLease, emitter: TunnelEventEmitter) => new Promise<Server>((resolve, reject) => {

	hostLogger.enabled
		&& hostLogger.log('establishing proxy host');

    const unavailableResponse = htmlResponse
		.replaceAll('${address}', format.localAddress(tunnelConfig));

	const fallbackHost = createServer(async (request, response) => {
		const urlParts = request.url.split('?')
		const unsafePath = decodeURI(urlParts[0])
		const keepalive = urlParts.length !== 0 && urlParts[1] === 'keepalive'
		const urlPath = posix.normalize(unsafePath);
		const urlQuery = urlParts.length === 0 
		  ? new URLSearchParams()
		  : new URLSearchParams(urlParts[1]);

		if (request.method === 'OPTIONS' && keepalive) {
			return response.end();
		}

		try {
			const body = await getRequestBody(request);
			await fetch(`${format.localAddress(tunnelConfig)}${urlPath}?${urlQuery}`, { 
				method: request.method,
				mode: 'cors',
				body,
				referrer: request.headers.referer,
				redirect: 'manual',
				headers: {
					...mapHeaders(request.rawHeaders),
					'x-forwarded-host': tunnelLease.cachedTunnelUrl?.host ?? tunnelLease.tunnelUrl.host
				}
			})
				.then(async fetchResponse => {
					response.statusCode = fetchResponse.status;
					response.statusMessage = fetchResponse.statusText;
					response.writeHead(fetchResponse.status, { 
						...Object.fromEntries(fetchResponse.headers.entries()),
						'Content-Type': fetchResponse.headers.get('Content-Type') || 'text/plain' 
					})
					const data = await fetchResponse.arrayBuffer();
					if (response.writableEnded) return;
					await new Promise<void>((res,rej) => response.write(Buffer.from(data), e => {
						if (e) rej(e);
						res();
					}));
					return response.end();
				})
				.catch(async (err: SocketFailure) => {
					connectionLogger.enabled
						&& connectionLogger.log('unhandled error occurred while forwarding request %j', err);

					response.write(unavailableResponse
						.replaceAll('${errorCode}', err.cause.code)
						.replaceAll('${errorDetails}', formatError(err))
					);
					return response.end();
				})

		} catch (unintendedError) {
			connectionLogger.enabled
				&& connectionLogger.log('unknown error occurred while forwarding request %j', unintendedError)

			response.write(unavailableResponse
				.replaceAll('${errorCode}', (unintendedError as Error).name)
				.replaceAll('${errorDetails}', formatError(unintendedError))
			);

			response.write(unavailableResponse);
			return response.end();
		}

		if (response.writableEnded) return;

		response.write(unavailableResponse
			.replaceAll('${errorCode}',  'UNKNOWN')
			.replaceAll('${errorDetails}', '')
		);
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

type SocketError = Error & {
	name: string,
	socket?: any,
	code?: string 
	address?: string 
	port?: string 
}
type SocketFailure = {
	cause: SocketError
}
const formatError = (error: Error | SocketFailure) => {
	if (!import.meta.env.DEV) {
		(error as Error).stack = undefined!;
		if (Object.hasOwn(error, 'cause')) {
			(error as SocketFailure).cause.socket = undefined!;
			(error as SocketFailure).cause.address = undefined!;
			(error as SocketFailure).cause.port = undefined!;
		}
	}

	if (Object.hasOwn(error, 'cause')) {
		return JSON.stringify({
			[(error as SocketFailure).cause.name]: error.cause
		}, null, 2)
	}

	return JSON.stringify({
		[(error as Error).name]: error
	}, null, 2)
}