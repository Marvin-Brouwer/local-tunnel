import { type Debugger } from 'debug';

type LoggerFactory = (namespace: string) => Pick<Debugger, 'enabled' |'log'>;
let loggerFactory: LoggerFactory = () => ({
    enabled: false,
    log: void 0
})

if (import.meta.env.VITE_DEBUG) {
    const debug = require('debug')
    debug.enable(import.meta.env.VITE_DEBUG);

    loggerFactory  = (namespace: string) => debug(namespace);
}

export const createLogger = loggerFactory;