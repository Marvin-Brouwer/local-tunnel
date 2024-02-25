import { type Debugger } from 'debug';
import { type TunnelLease } from './tunnel/tunnel-lease';
import { type TunnelConfig } from './client/client-config';

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

export const format = {
    remoteAddress: (tunnelLease: TunnelLease) => 
      `https://${tunnelLease.remote.target}:${tunnelLease.remote.port}`,
    localAddress: (tunnelConfig: TunnelConfig) => 
      `${!!tunnelConfig.https ? 'https' : 'http'}://${tunnelConfig.hostName}:${tunnelConfig.port}`
}