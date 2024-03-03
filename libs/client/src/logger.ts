import { type AddressInfo } from 'node:net';

// eslint-disable-next-line import/no-extraneous-dependencies
import { type Debugger } from 'debug';

import { type TunnelConfig } from './client/client-config';
import { type TunnelLease } from './tunnel/tunnel-lease';

// eslint-disable-next-line no-unused-vars
type LoggerFactory = (namespace: string) => Pick<Debugger, 'enabled' |'log'>;
const fallbackLoggerFactory = (): LoggerFactory => () => ({
	enabled: false,
	log: () => { },
});

export const createLogger = (namespace: string) => {
	if (import.meta.env.VITE_DEBUG === 'false') {
		return fallbackLoggerFactory()(namespace) as Debugger;
	}

	// eslint-disable-next-line global-require, @typescript-eslint/no-var-requires, import/no-extraneous-dependencies
	const { debug } = require('debug');

	debug.enable(import.meta.env.VITE_DEBUG);
	const logger = debug(namespace);
	return {
		log: logger,
		enabled: logger.enabled,
	};
};

function isAddressInfo(addressInfo: AddressInfo | string): addressInfo is AddressInfo {
	return addressInfo.constructor.name === 'AddressInfo';
}

export const format = {
	remoteAddress: (tunnelLease: TunnelLease) => {
		const schema = import.meta.env.VITE_SERVER_SCHEMA ?? 'https';
		return `${schema}://${tunnelLease.remote.target}:${tunnelLease.remote.port}`;
	},
	remoteOrigin: (tunnelConfig: TunnelConfig) => {
		const schema = import.meta.env.VITE_SERVER_SCHEMA ?? 'https';
		return `${schema}://${tunnelConfig.server.hostName}`;
	},
	localAddress: (tunnelConfig: TunnelConfig) => tunnelConfig.localHost.href,
	address: (addressInfo: AddressInfo | string) => {
		if (!isAddressInfo(addressInfo)) return addressInfo;
		if (addressInfo.family === 'IPv6') {
			if (addressInfo.address === '::') return `//localhost:${addressInfo.port}`;
			return `//[${addressInfo.address}]:${addressInfo.port}`;
		}
		if (addressInfo.address === '127.0.0.1') return `//localhost:${addressInfo.port}`;
		return `//${addressInfo.address}:${addressInfo.port}`;
	},
};
