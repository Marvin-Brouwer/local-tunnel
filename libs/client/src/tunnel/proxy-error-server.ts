import { type IncomingMessage, type Server, createServer } from 'node:http';
import { posix } from 'node:path';

import htmlResponse from './proxy-error-page.html?raw';
import { type TunnelLease } from './tunnel-lease';
import { type TunnelConfig } from '../client/client-config';
import { DownstreamTunnelRejectedError, UnknownDownstreamTunnelError } from '../errors/downstream-tunnel-errors';
import { type SocketError, isRejectedCode } from '../errors/socket-error';
import { type TunnelEventEmitter } from '../errors/tunnel-events';
import { createLogger, format } from '../logger';
import { awaitCallback, awaitValue } from '../promise-helper';

const logger = createLogger('localtunnel:proxy:host');

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

	return awaitValue<string>((resolve) => request.on('data', (chunk) => {
		resolve(chunk.toString());
	}));
};

type SocketFailure = {
	cause: SocketError
}
const isSocketFailure = (error: Error | SocketFailure): error is SocketFailure => Object.hasOwn(error, 'cause');

const formatError = (error: Error | SocketError) => JSON.stringify(
	{
		[(error as Error).name]: error
	}, null, 2
).replaceAll('\\n', ' ');

export const createProxyErrorServer = (
	tunnelConfig: TunnelConfig, tunnelLease: TunnelLease, emitter: TunnelEventEmitter, abortSignal: AbortSignal
) => new Promise<Server>((resolve) => {
	if (logger.enabled) logger.log('establishing proxy host');

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
			response.statusCode = 200;
			response.statusMessage = 'keepalive';
			response.writeHead(200, {
				'Content-Type': 'text/plain',
				Allow: 'OPTIONS',
				'Access-Control-Allow-Methods': 'OPTIONS'
			});
			return response.end();
		}

		// TODO Remove once server issues fixed
		// eslint-disable-next-line
		console.log('REQUEST', urlParts);

		try {
			const body = await getRequestBody(request);
			await fetch(`${format.localAddress(tunnelConfig)}${urlPath}?${urlQuery}`, {
				method: request.method,
				mode: 'cors',
				body,
				referrer: request.headers.referer,
				redirect: 'manual',
				signal: abortSignal,
				headers: {
					...mapHeaders(request.rawHeaders),
					'x-forwarded-host': tunnelLease.cachedTunnelUrl?.host ?? tunnelLease.tunnelUrl.host
				}
			})
				.then(async (fetchResponse) => {
					response.statusCode = fetchResponse.status;
					response.statusMessage = fetchResponse.statusText;
					response.writeHead(fetchResponse.status, {
						...Object.fromEntries(fetchResponse.headers.entries()),
						'Content-Type': fetchResponse.headers.get('Content-Type') || 'text/plain'
					});
					const data = await fetchResponse.arrayBuffer();
					if (response.writableEnded) return;
					await awaitCallback((cb) => {
						response.write(Buffer.from(data), cb);
					});
					response.end();
				})
				.catch(async (failureOrError: SocketFailure | Error) => {
					if ((failureOrError as Error).name === 'AbortError') return response.end();
					if (!isSocketFailure(failureOrError)) throw failureOrError;
					const socketError = failureOrError.cause;

					const connectionError = isRejectedCode(socketError)
						? new DownstreamTunnelRejectedError(tunnelConfig, socketError)
						: new UnknownDownstreamTunnelError(tunnelConfig, socketError);

					if (logger.enabled) {
						logger.log('unhandled error occurred while forwarding request %o', connectionError);
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
			if ((error as Error).name === 'AbortError') return response.end();
			const unknownError = new UnknownDownstreamTunnelError(tunnelConfig, error as Error);

			if (logger.enabled) {
				logger.log('unknown error occurred while forwarding request %j', unknownError);
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

	fallbackHost.keepAliveTimeout = 0;
	fallbackHost.headersTimeout = 0;
	fallbackHost.maxConnections = 0;
	fallbackHost.maxRequestsPerSocket = tunnelLease.maximumConnections + 1;

	fallbackHost.listen({
		port: 0, signal: abortSignal, readableAll: true, writableAll: true
	}, () => {
		if (logger.enabled) {
			logger.log('fallback host funning on http:%s', format.address(fallbackHost.address()!));
		}

		resolve(fallbackHost);
	});
});
