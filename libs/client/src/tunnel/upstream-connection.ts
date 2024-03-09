import net from 'node:net';
import { type Duplex } from 'node:stream';

import { type TunnelLease } from './tunnel-lease';
import { type SocketError, isRejectedCode } from '../errors/socket-error';
import { type TunnelEventEmitter } from '../errors/tunnel-events';
import { UnknownUpstreamTunnelError, UpstreamTunnelRejectedError } from '../errors/upstream-tunnel-errors';
import { createLogger, format } from '../logger';

export const createUpstreamConnection = (
	id: number, tunnelLease: TunnelLease, emitter: TunnelEventEmitter | undefined, abortSignal: AbortSignal
) => new Promise<Duplex>((resolve) => {
	const logger = createLogger(`localtunnel:upstream:connection[${id}]`);

	if (logger.enabled) {
		logger.log('establishing remote connection to %s', format.remoteAddress(tunnelLease));
	}

	const remoteSocket: Duplex = net
		.createConnection({
			host: tunnelLease.remote.target,
			port: tunnelLease.remote.port,
			allowHalfOpen: true,
			keepAlive: true,
			signal: abortSignal
		});

	const mapError = (error: SocketError) => {
		if (isRejectedCode(error)) {
			return new UpstreamTunnelRejectedError(tunnelLease, error);
		}

		return new UnknownUpstreamTunnelError(tunnelLease, error);
	};

	const initialConnectionError = (error: SocketError) => {
		const upstreamError = mapError(error);
		emitter?.emit('upstream-error', upstreamError);
		remoteSocket.destroy();

		// We don't need to reject here, errors are handled by the implementer.
		resolve(remoteSocket);
	};

	remoteSocket.once('error', initialConnectionError);
	remoteSocket.once('connect', () => {
		remoteSocket.once('data', () => remoteSocket.off('error', initialConnectionError));

		if (logger.enabled) logger.log('connection to %s UP', format.remoteAddress(tunnelLease));

		remoteSocket.on('error', (error: SocketError) => {
			if (abortSignal.aborted) return;
			if (logger.enabled) logger.log('socket error %j', error);
			const upstreamError = mapError(error);
			emitter?.emit('upstream-error', upstreamError);
		});

		resolve(remoteSocket);
	});
});
