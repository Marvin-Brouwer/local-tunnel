import net from 'node:net';
import { type Duplex } from 'node:stream';

import { type TunnelLease } from './tunnel-lease';
import packageConfig from '../../package.json' assert { type: 'json' };
import { type SocketError, isRejectedCode } from '../errors/socket-error';
import { type TunnelEventEmitter } from '../errors/tunnel-events';
import { UnknownUpstreamTunnelError, UpstreamTunnelRejectedError } from '../errors/upstream-tunnel-errors';
import { createLogger, format } from '../logger';

const logger = createLogger('localtunnel:upstream:connection');

const createConnection = (
	tunnelLease: TunnelLease, emitter: TunnelEventEmitter, abortSignal: AbortSignal
) => new Promise<Duplex>((resolve) => {
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
		emitter.emit('upstream-error', upstreamError);
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
			emitter.emit('upstream-error', upstreamError);
		});

		resolve(remoteSocket);
	});
});

export const createUpstreamConnection = async (
	tunnelLease: TunnelLease, emitter: TunnelEventEmitter, abortSignal: AbortSignal
) => {
	const connection = await createConnection(
		tunnelLease, emitter, abortSignal
	);

	// This seems to be necessary to prevent the tunnel from closing, event though keepalive is set to true
	const intervalHandle = setInterval(() => {
		if (abortSignal.aborted || connection.closed || connection.errored) return;

		fetch(`${tunnelLease.tunnelUrl}?keepalive`, {
			method: 'options',
			signal: abortSignal,
			headers: {
				'Bypass-Tunnel-Reminder': tunnelLease.id,
				'User-Agent': encodeURIComponent(`${packageConfig.name}@${packageConfig.version}`)
			}
		}).catch(() => {
			// don't care about any error.
		});
	}, 2000);

	connection.on('close', async () => {
		clearInterval(intervalHandle);
	});

	return connection;
};
