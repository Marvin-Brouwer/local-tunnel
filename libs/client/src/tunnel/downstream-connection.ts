import { createLogger, format } from "../logger";
import { Duplex } from "node:stream";
import net, { TcpSocketConnectOpts } from 'node:net';
import { SocketError, isRejectedCode } from "../errors/socket-error";
import { type TunnelEventEmitter } from '../errors/tunnel-events';
import { type TunnelConfig } from "../client/client-config";
import fs from 'node:fs';
import tls from 'node:tls';
import { DownstreamTunnelRejectedError, UnknownDownstreamTunnelError } from "../errors/downstream-tunnel-errors";


const logger = createLogger('localtunnel:downstream:connection');

/**
 * Even though this connection is currently not in use, in favor of the fetch() in the proxy connection
 * We might need this for the websocket setup.
 */
export const createDownstreamConnection = async (tunnelConfig: TunnelConfig, emitter: TunnelEventEmitter) => {

	const connection = await createConnection(tunnelConfig, emitter);

	return connection;
};


const createConnection = (tunnelConfig: TunnelConfig, emitter: TunnelEventEmitter) => new Promise<Duplex>((resolve, reject) => {
	logger.enabled
		&& logger.log('establishing local connection to %s', format.localAddress(tunnelConfig));

	const localSocketAddress: TcpSocketConnectOpts = {
		host: tunnelConfig.localHost.host,
		port: tunnelConfig.localHost.port === ''
			? undefined
			: +tunnelConfig.localHost.port,
	};

	const { https } = tunnelConfig;

	// connection to local http server
	const remoteSocket: Duplex = (() => {

		if (!https) return net.createConnection({
			...localSocketAddress,
			allowHalfOpen: true,
			keepAlive: true,
			noDelay: true,
		});

		const cert = !https.cert ? {} : {
			cert: fs.readFileSync(https.cert.pemLocation),
			key: fs.readFileSync(https.cert.keyLocation),
			ca: https.cert.certificateAuthorityLocation
				? [fs.readFileSync(https.cert.certificateAuthorityLocation)]
				: undefined,
		}

		return tls
			.connect({
				...localSocketAddress,
				rejectUnauthorized: !https.skipCertificateValidation,
				...cert
			})
			.setNoDelay(true)
			.setKeepAlive(true)
	})();

	const mapError = (error: SocketError) => {
		if (isRejectedCode(error)) {
			return  new DownstreamTunnelRejectedError(tunnelConfig, error);
		}

		return new UnknownDownstreamTunnelError(tunnelConfig, error);
	}

	remoteSocket.on('error', (error: SocketError) => {
		logger.enabled && logger.log('socket error %j', error);

		reject(mapError(error))
	});

	remoteSocket.on('connect', () => {
		logger.enabled
			&& logger.log('connection to %s UP', format.localAddress(tunnelConfig));

		resolve(remoteSocket)
	});
});