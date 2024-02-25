import { Duplex } from 'node:stream'
import { TunnelConfig } from '../../client/client-config';
import './pipe-transform'
import { type TransformFunction } from './pipe-transform';

declare module 'node:stream' {
	interface Duplex {
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
			if (config.https && config.port == 443) return `Host: ${config.hostName}`;
			if (!config.https && config.port == 80) return `Host: ${config.hostName}`;
			return `Host: ${config.hostName}:${config.port}`;
		});

	callback(null, Buffer.from(data.join('\r\n')));
}

Object.defineProperty(Duplex.prototype, 'transformHeaderHost', {
	value: function (config: TunnelConfig): Duplex {
		const duplex = this as Duplex;
		return duplex.pipeTransform(transformHeaderHost(config))
	},
	writable: false,
	enumerable: false,
	configurable: true
})