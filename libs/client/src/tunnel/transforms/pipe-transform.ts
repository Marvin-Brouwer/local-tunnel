import { Duplex, Transform } from "node:stream"

type _TransformParameters = Parameters<Transform['_transform']>
type TransformParameters = [
    chunk: Buffer,
    encoding: _TransformParameters[1],
    callback: _TransformParameters[2]
]
export type TransformFunction = (...args: TransformParameters) => void;
declare module 'node:stream' {
	export interface Duplex {
		pipeTransform: (transform: TransformFunction) => Duplex
	}
}

Object.defineProperty(Duplex.prototype, 'pipeTransform', {
	value: function (transform: TransformFunction): Duplex {
        const duplex = this as Duplex;
        return duplex.pipe(new Transform({
            transform
        }))
	},
	writable: false,
	enumerable: false,
	configurable: true
})