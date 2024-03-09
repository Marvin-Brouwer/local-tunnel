import { type TunnelConfig } from '../client/client-config';
import { createWarning } from '../errors/tunnel-events';
import { LeaseFetchRejectedError, LeaseFetchResponseError } from '../errors/upstream-tunnel-errors';

const randomDomain = Symbol.for('?new');

export type TunnelLease = {

	id: string,

	tunnelUrl: URL,
	cachedTunnelUrl: URL | undefined,

	client: {
		publicIp: string | undefined
	},

	remote: {
		ip: string | undefined,
		target: string,
		port: number
	},

	httpsEnabled: boolean
	maximumConnections: number
}

type TunnelLeaseResponse = {
	id: string,
	ip: string,
	port: number,
	url: string,
	cached_url: string,
	max_conn_count: number | undefined
}

const getLeaseUrl = (config: TunnelConfig): string => {
	const schema = import.meta.env.VITE_SERVER_SCHEMA ?? 'https';
	const { subdomain } = config.server;
	const assignedDomain = subdomain ?? randomDomain.description;

	return `${schema}://${config.server.hostName}/${assignedDomain}`;
};

// eslint-disable-next-line max-len
const createTunnelLease = (
	config: TunnelConfig, leaseResponse: TunnelLeaseResponse, clientIp: string | undefined
): TunnelLease => ({
	id: leaseResponse.id,

	tunnelUrl: new URL(leaseResponse.url),
	cachedTunnelUrl: leaseResponse.cached_url ? new URL(leaseResponse.cached_url) : undefined,

	client: {
		publicIp: clientIp
	},

	remote: {
		ip: leaseResponse.ip,
		// Prefer the ip if returned from the server
		target: leaseResponse.ip ?? config.server.hostName,
		port: leaseResponse.port
	},

	httpsEnabled: !!config.https,
	maximumConnections: leaseResponse.max_conn_count || 1
});

export const getTunnelLease = async (config: TunnelConfig, onWarning: NodeJS.WarningListener): Promise<TunnelLease> => {
	const url = getLeaseUrl(config);
	const leaseFetchResponse = await fetch(url)
		.catch((err) => { throw new LeaseFetchRejectedError(config, err); });

	if (!leaseFetchResponse.ok) { throw new LeaseFetchResponseError(config, leaseFetchResponse); }

	// This may be a good spot for ZOD if we ever take in the server app too.
	const leaseResponse = await leaseFetchResponse.json() as TunnelLeaseResponse;
	const clientIp = await fetch('https://api.ipify.org')
		.then((response) => response.text())
		.catch((err) => {
			onWarning(createWarning(
				'PasswordCheckRejected',
				'Unable to determine tunnel password',
				(err as Error).cause?.toString() ?? (err as Error).message
			));
			return undefined;
		});

	return createTunnelLease(
		config, leaseResponse, clientIp
	);
};
