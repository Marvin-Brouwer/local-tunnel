import fs from 'node:fs';
import net, { type TcpSocketConnectOpts } from 'node:net';
import { type Duplex } from 'node:stream';
import tls from 'node:tls';

import { type TunnelConfig } from '../client/client-config';
import { DownstreamTunnelRejectedError, UnknownDownstreamTunnelError } from '../errors/downstream-tunnel-errors';
import { type SocketError, isRejectedCode } from '../errors/socket-error';
import { createLogger, format } from '../logger';

const logger = createLogger('localtunnel:downstream:connection');

const createConnection = (tunnelConfig: TunnelConfig) => new Promise<Duplex>((resolve, reject) => {
	if (logger.enabled) logger.log('establishing local connection to %s', format.localAddress(tunnelConfig));

	const localSocketAddress: TcpSocketConnectOpts = {
		host: tunnelConfig.localHost.host,
		port: tunnelConfig.localHost.port === ''
			? undefined!
			: +tunnelConfig.localHost.port
	};

	const { https } = tunnelConfig;

	// connection to local http server
	const remoteSocket: Duplex = (() => {
		if (!https) {
			return net.createConnection({
				...localSocketAddress,
				allowHalfOpen: true,
				keepAlive: true,
				noDelay: true
			});
		}

		const cert = !https.cert ? {} : {
			cert: fs.readFileSync(https.cert.pemLocation),
			key: fs.readFileSync(https.cert.keyLocation),
			ca: https.cert.certificateAuthorityLocation
				? [fs.readFileSync(https.cert.certificateAuthorityLocation),]
				: undefined
		};

		return tls
			.connect({
				...localSocketAddress,
				rejectUnauthorized: !https.skipCertificateValidation,
				...cert
			})
			.setNoDelay(true)
			.setKeepAlive(true);
	})();

	const mapError = (error: SocketError) => {
		if (isRejectedCode(error)) {
			return new DownstreamTunnelRejectedError(tunnelConfig, error);
		}

		return new UnknownDownstreamTunnelError(tunnelConfig, error);
	};

	remoteSocket.on('error', (error: SocketError) => {
		if (logger.enabled) logger.log('socket error %j', error);

		reject(mapError(error));
	});

	remoteSocket.on('connect', () => {
		if (logger.enabled) logger.log('connection to %s UP', format.localAddress(tunnelConfig));

		resolve(remoteSocket);
	});
});

/**
 * Even though this connection is currently not in use, in favor of the fetch() in the proxy connection
 * We might need this for the websocket setup.
 */
export const createDownstreamConnection = async (tunnelConfig: TunnelConfig) => {
	const connection = await createConnection(tunnelConfig);

	return connection;
};
