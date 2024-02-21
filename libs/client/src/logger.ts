import { type Debugger } from 'debug';

type LoggerFactory = (namespace: string) => Pick<Debugger, 'enabled' |'log'>;
let loggerFactory: LoggerFactory = () => ({
    enabled: false,
    log: () => void 0
})

if (import.meta.env.VITE_DEBUG) {
    const debug = require('debug')
    debug.enable(import.meta.env.VITE_DEBUG);

    loggerFactory  = (namespace: string) => {
        const logger = debug(namespace); 

        return {
            enabled: logger.enabled,
            log: logger
        }
    }
}

export const createLogger = loggerFactory;