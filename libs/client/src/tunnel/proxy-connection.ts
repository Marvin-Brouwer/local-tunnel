import { type IncomingMessage, type Server, createServer } from 'node:http';
import net, { type AddressInfo } from 'node:net';
import { posix } from 'node:path';
import { type Duplex } from 'node:stream';

import htmlResponse from './proxy-error-page.html?raw';
import { type TunnelLease } from './tunnel-lease';
import { type TunnelConfig } from '../client/client-config';
import { DownstreamTunnelRejectedError, UnknownDownstreamTunnelError } from '../errors/downstream-tunnel-errors';
import { ProxyTunnelRejectedError, UnknownProxyTunnelError } from '../errors/proxy-tunnel-error';
import { type SocketError, isRejectedCode } from '../errors/socket-error';
import { type TunnelEventEmitter } from '../errors/tunnel-events';
import { createLogger, format } from '../logger';

const connectionLogger = createLogger('localtunnel:proxy:connection');
const hostLogger = createLogger('localtunnel:proxy:host');

// This could probably be more efficient, but for now it's good enough
const mapHeaders = (headers: string[]): string[][] => {
	let headerString = '';
	headers.forEach((element, index) => {
		headerString += element;
		if (index === headers.length - 1) return;

		if (index % 2 !== 0) headerString += '\n';
		else headerString += ': ';
	});

	return headerString
		.split('\n')
		.map((rec) => rec.split(': '));
};

const getRequestBody = (request: IncomingMessage): Promise<string | undefined> => {
	if (request.method !== 'POST') return Promise.resolve(undefined);

	// eslint-disable-next-line no-promise-executor-return
	return new Promise<string>((resolve) => request.on('data', (chunk) => {
		resolve(chunk.toString());
	}));
};

type SocketFailure = {
	cause: SocketError
}
const isSocketFailure = (error: Error | SocketFailure): error is SocketFailure => Object.hasOwn(error, 'cause');

const formatError = (error: Error | SocketError) => JSON.stringify({
	[(error as Error).name]: error,
}, null, 2).replaceAll('\\n', ' ');

// eslint-disable-next-line max-len
const createHost = (tunnelConfig: TunnelConfig, tunnelLease: TunnelLease, emitter: TunnelEventEmitter) => new Promise<Server>((resolve) => {
	if (hostLogger.enabled) hostLogger.log('establishing proxy host');

	const unavailableResponse = htmlResponse
		// eslint-disable-next-line no-template-curly-in-string
		.replaceAll('${address}', format.localAddress(tunnelConfig));

	const fallbackHost = createServer(async (request, response) => {
		const urlParts = request.url!.split('?');
		const unsafePath = decodeURI(urlParts[0]);
		const keepalive = urlParts.length !== 0 && urlParts[1] === 'keepalive';
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
					'x-forwarded-host': tunnelLease.cachedTunnelUrl?.host ?? tunnelLease.tunnelUrl.host,
				},
			})
				.then(async (fetchResponse) => {
					response.statusCode = fetchResponse.status;
					response.statusMessage = fetchResponse.statusText;
					response.writeHead(fetchResponse.status, {
						...Object.fromEntries(fetchResponse.headers.entries()),
						'Content-Type': fetchResponse.headers.get('Content-Type') || 'text/plain',
					});
					const data = await fetchResponse.arrayBuffer();
					if (response.writableEnded) return;
					// eslint-disable-next-line no-promise-executor-return
					await new Promise<void>((res, rej) => response.write(Buffer.from(data), (e) => {
						if (e) rej(e);
						res();
					}));
					response.end();
				})
				.catch(async (failureOrError: SocketFailure | Error) => {
					if (!isSocketFailure(failureOrError)) throw failureOrError;
					const socketError = failureOrError.cause;

					const connectionError = isRejectedCode(socketError)
						? new DownstreamTunnelRejectedError(tunnelConfig, socketError)
						: new UnknownDownstreamTunnelError(tunnelConfig, socketError);

					if (connectionLogger.enabled) {
						connectionLogger.log('unhandled error occurred while forwarding request %o', connectionError);
					}

					emitter.emit('downstream-error', connectionError);
					response.write(unavailableResponse
						// eslint-disable-next-line no-template-curly-in-string
						.replaceAll('${errorCode}', connectionError.reason)
						// eslint-disable-next-line no-template-curly-in-string
						.replaceAll('${errorDetails}', formatError(connectionError)));
					return response.end();
				});
		} catch (error) {
			const unknownError = new UnknownDownstreamTunnelError(tunnelConfig, error);

			if (connectionLogger.enabled) {
				connectionLogger.log('unknown error occurred while forwarding request %j', unknownError);
			}

			emitter.emit('downstream-error', unknownError);
			response.write(unavailableResponse
				// eslint-disable-next-line no-template-curly-in-string
				.replaceAll('${errorCode}', unknownError.reason)
				// eslint-disable-next-line no-template-curly-in-string
				.replaceAll('${errorDetails}', formatError(unknownError)));

			response.write(unavailableResponse);
			return response.end();
		}

		if (response.writableEnded) return response;

		// This code should be unreachable
		response.write(unavailableResponse
			// eslint-disable-next-line no-template-curly-in-string
			.replaceAll('${errorCode}', 'UNKNOWN')
			// eslint-disable-next-line no-template-curly-in-string
			.replaceAll('${errorDetails}', ''));

		return response.end();
	});

	fallbackHost.listen({ port: 0 }, () => {
		if (connectionLogger.enabled) {
			connectionLogger.log('fallback host funning on http:%s', format.address(fallbackHost.address()));
		}

		resolve(fallbackHost);
	});
});

// eslint-disable-next-line max-len
const createConnection = (address: AddressInfo, emitter: TunnelEventEmitter) => new Promise<Duplex>((resolve) => {
	if (connectionLogger.enabled) {
		connectionLogger.log('establishing remote connection to http:%s', format.address(address));
	}

	const proxySocket: Duplex = net
		.createConnection({
			host: address.address,
			port: address.port,
			allowHalfOpen: true,
			keepAlive: true,
		});

	const mapError = (error: SocketError) => {
		if (isRejectedCode(error)) {
			return new ProxyTunnelRejectedError(address, error);
		}

		return new UnknownProxyTunnelError(address, error);
	};

	const initialConnectionError = (error: SocketError) => {
		const proxyError = mapError(error);
		emitter.emit('proxy-error', proxyError);
		proxySocket.destroy();

		// We don't need to reject here, errors are handled by the implementer.
		resolve(proxySocket);
	};

	proxySocket.once('error', initialConnectionError);
	proxySocket.once('connect', () => {
		proxySocket.once('data', () => proxySocket.off('error', initialConnectionError));

		if (connectionLogger.enabled) {
			connectionLogger.log('connection to fallback http:%s UP', format.address(address));
		}

		proxySocket.on('error', (error: SocketError) => {
			if (connectionLogger.enabled) connectionLogger.log('socket error %j', error);
			const proxyError = mapError(error);
			emitter.emit('proxy-error', proxyError);
		});

		resolve(proxySocket);
	});
});

// eslint-disable-next-line max-len
export const createProxyConnection = async (tunnelConfig: TunnelConfig, tunnelLease: TunnelLease, emitter: TunnelEventEmitter) => {
	const host = await createHost(tunnelConfig, tunnelLease, emitter);
	const address = (host.address() as AddressInfo);
	const connection = await createConnection(address, emitter);

	return connection;
};
