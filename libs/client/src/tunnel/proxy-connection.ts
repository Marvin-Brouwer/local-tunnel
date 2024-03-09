import net, { type AddressInfo } from 'node:net';
import { type Duplex } from 'node:stream';

import { ProxyTunnelRejectedError, UnknownProxyTunnelError } from '../errors/proxy-tunnel-error';
import { type SocketError, isRejectedCode } from '../errors/socket-error';
import { type TunnelEventEmitter } from '../errors/tunnel-events';
import { createLogger, format } from '../logger';

export const createProxyConnection = (
	id: number, address: AddressInfo, emitter: TunnelEventEmitter, abortSignal: AbortSignal
) => new Promise<Duplex>((resolve) => {
	const logger = createLogger(`localtunnel:proxy:connection[${id}]`);

	if (logger.enabled) {
		logger.log('establishing remote connection to http:%s', format.address(address));
	}

	const proxySocket: Duplex = net
		.createConnection({
			host: address.address,
			port: address.port,
			allowHalfOpen: true,
			keepAlive: true,
			signal: abortSignal
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

		if (logger.enabled) {
			logger.log('connection to fallback http:%s UP', format.address(address));
		}

		proxySocket.on('error', (error: SocketError) => {
			if (logger.enabled) logger.log('socket error %j', error);
			const proxyError = mapError(error);
			emitter.emit('proxy-error', proxyError);
		});

		resolve(proxySocket);
	});
});
