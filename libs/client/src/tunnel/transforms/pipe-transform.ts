import { Duplex, Transform } from 'node:stream';

type _TransformParameters = Parameters<Transform['_transform']>
type TransformParameters = [
    chunk: Buffer,
    encoding: _TransformParameters[1],
    callback: _TransformParameters[2]
]
// eslint-disable-next-line no-unused-vars
export type TransformFunction = (...args: TransformParameters) => void;
declare module 'node:stream' {
	// eslint-disable-next-line no-shadow
	export interface Duplex {
		// eslint-disable-next-line no-unused-vars
		pipeTransform: (transform: TransformFunction) => Duplex
	}
}

Object.defineProperty(
	Duplex.prototype, 'pipeTransform', {
		value(transform: TransformFunction): Duplex {
			const duplex = this as Duplex;
			return duplex.pipe(new Transform({
				transform
			}));
		},
		writable: false,
		enumerable: false,
		configurable: true
	}
);
