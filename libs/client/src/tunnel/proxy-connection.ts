import { createLogger, format } from "../logger";
import { Duplex } from "node:stream";
import net, { type AddressInfo } from 'node:net';
import { type SocketError, isRejectedCode } from '../errors/socket-error';
import { type TunnelEventEmitter } from '../errors/tunnel-events';
import { createServer, type IncomingMessage, type Server } from 'node:http'
import { type TunnelConfig } from '../client/client-config';
import htmlResponse from './proxy-error-page.html?raw';
import { posix } from "node:path";
import { type TunnelLease } from "./tunnel-lease";
import { DownstreamTunnelRejectedError, UnknownDownstreamTunnelError } from "../errors/downstream-tunnel-errors";
import { ProxyTunnelRejectedError, UnknownProxyTunnelError } from "../errors/proxy-tunnel-error";

const connectionLogger = createLogger('localtunnel:proxy:connection');
const hostLogger = createLogger('localtunnel:proxy:host');

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
				.catch(async (failureOrError: SocketFailure | Error) => {

					if (!isSocketFailure(failureOrError)) throw failureOrError;
					const socketError = failureOrError.cause;

					const connectionError = isRejectedCode(socketError)
						? new DownstreamTunnelRejectedError(tunnelConfig, socketError)
						: new UnknownDownstreamTunnelError(tunnelConfig, socketError)

					connectionLogger.enabled
						&& connectionLogger.log('unhandled error occurred while forwarding request %o', connectionError);

					response.write(unavailableResponse
						.replaceAll('${errorCode}', connectionError.reason)
						.replaceAll('${errorDetails}', formatError(connectionError))
					);
					return response.end();
				})

		} catch (error) {

			const unknownError = new UnknownDownstreamTunnelError(tunnelConfig, error);

			connectionLogger.enabled
				&& connectionLogger.log('unknown error occurred while forwarding request %j', unknownError)

			response.write(unavailableResponse
				.replaceAll('${errorCode}', unknownError.reason)
				.replaceAll('${errorDetails}', formatError(unknownError))
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

	const proxySocket: Duplex = net
		.createConnection({
			host: address.address,
			port: address.port,
			allowHalfOpen: true,
			keepAlive: true
		});

	const mapError = (error: SocketError) => {
		if (isRejectedCode(error)) {
			return  new ProxyTunnelRejectedError(address, error);
		}

		return new UnknownProxyTunnelError(address, error);
	}
	
	const initialConnectionError = (error: SocketError) => {
		const proxyError = mapError(error);
		emitter.emit('proxy-error', proxyError);
		proxySocket.destroy();
		
		reject(proxyError);
	}

	proxySocket.once('error', initialConnectionError);
	proxySocket.once('connect', () => {
		proxySocket.once('data', () => 
			proxySocket.off('error', initialConnectionError)
		);

		connectionLogger.enabled
			&& connectionLogger.log('connection to fallback http:%s UP', format.address(address));

		proxySocket.on('error', (error: SocketError) => {
			connectionLogger.enabled && connectionLogger.log('socket error %j', error);
			const proxyError = mapError(error);
			emitter.emit('proxy-error', proxyError);
		});

		resolve(proxySocket);
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

type SocketFailure = {
	cause: SocketError
}
const isSocketFailure = (error: Error | SocketFailure): error is SocketFailure =>  
	Object.hasOwn(error, 'cause')


const formatError = (error: Error | SocketError) => {
	return JSON.stringify({
		[(error as Error).name]: error
	}, null, 2).replaceAll('\\n', ' ')
}