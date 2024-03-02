import { Duplex } from 'node:stream';

import { type TransformFunction } from './pipe-transform';
import { type TunnelConfig } from '../../client/client-config';
import './pipe-transform';

declare module 'node:stream' {
	// eslint-disable-next-line no-shadow
	interface Duplex {
		// eslint-disable-next-line  no-unused-vars
		transformHeaderHost: (this: Duplex, config: TunnelConfig) => Duplex
	}
}

const newLineMatch = /(?:\r\n|\r|\n)/g;
const transformHeaderHost = (config: TunnelConfig): TransformFunction => (chunk, _encoding, callback) => {
	const data = chunk
		.toString()
		.split(newLineMatch)
		.map((line) => {
			if (!line.toLowerCase().startsWith('host:')) return line;
			if (config.https && config.localHost.port === '443') return `Host: ${config.localHost.host}`;
			if (!config.https && config.localHost.port === '80') return `Host: ${config.localHost.host}`;
			return `Host: ${config.localHost.host}:${config.localHost.port}`;
		});

	callback(null, Buffer.from(data.join('\r\n')));
};

Object.defineProperty(Duplex.prototype, 'transformHeaderHost', {
	value(config: TunnelConfig): Duplex {
		const duplex = this as Duplex;
		return duplex.pipeTransform(transformHeaderHost(config));
	},
	writable: false,
	enumerable: false,
	configurable: true,
});
