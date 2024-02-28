import { createLogger, format } from "../logger";
import { Duplex } from "node:stream";
import net from 'node:net';
import { SocketError, isRejectedCode } from "../errors/socket-error";
import { type TunnelEventEmitter } from '../errors/tunnel-events';
import { type TunnelLease } from "./tunnel-lease";
import { UnknownUpstreamTunnelError, UpstreamTunnelRejectedError } from "../errors/upstream-tunnel-errors";

const logger = createLogger('localtunnel:upstream:connection');

export const createUpstreamConnection = async (tunnelLease: TunnelLease, emitter: TunnelEventEmitter) => {

	const connection = await createConnection(tunnelLease, emitter);

	// This seems to be necessary to prevent the tunnel from closing, event though keepalive is set to true
	const intervalHandle = setInterval(() => {
		fetch(`${tunnelLease.tunnelUrl}?keepalive`, { method: 'options' }).catch(() => {
			// don't care about any error.
		})
	}, 2000);
	
	connection.on('close', async () => {
		clearInterval(intervalHandle);
	});

	return connection;
};


const createConnection = (tunnelLease: TunnelLease, emitter: TunnelEventEmitter) => new Promise<Duplex>((resolve) => {
	logger.enabled
		&& logger.log('establishing remote connection to %s', format.remoteAddress(tunnelLease));

	const remoteSocket: Duplex = net
		.createConnection({
			host: tunnelLease.remote.target,
			port: tunnelLease.remote.port,
			allowHalfOpen: true,
			keepAlive: true
		});

	const mapError = (error: SocketError) => {
		if (isRejectedCode(error)) {
			return  new UpstreamTunnelRejectedError(tunnelLease, error);
		}

		return new UnknownUpstreamTunnelError(tunnelLease, error);
	}

	const initialConnectionError = (error: SocketError) => {
		const upstreamError = mapError(error);
		emitter.emit('upstream-error', upstreamError);
		remoteSocket.destroy();

		// We don't need to reject here, errors are handled by the implementer.
		resolve(remoteSocket);
	}

	remoteSocket.once('error', initialConnectionError);
	remoteSocket.once('connect', () => {
		remoteSocket.once('data', () => 
			remoteSocket.off('error', initialConnectionError)
		);

		logger.enabled
			&& logger.log('connection to %s UP', format.remoteAddress(tunnelLease));

		remoteSocket.on('error', (error: SocketError) => {
			logger.enabled && logger.log('socket error %j', error);
			const upstreamError = mapError(error);
			emitter.emit('upstream-error', upstreamError);
		});

		resolve(remoteSocket);
	});
});