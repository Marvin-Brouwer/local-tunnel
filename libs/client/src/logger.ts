import { type Debugger } from 'debug';
import { type TunnelLease } from './tunnel/tunnel-lease';
import { type TunnelConfig } from './client/client-config';
import { AddressInfo } from 'node:net';

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
    remoteAddress: (tunnelLease: TunnelLease) => {
        const schema = import.meta.env.VITE_SERVER_SCHEMA ?? 'https';
        return `${schema}://${tunnelLease.remote.target}:${tunnelLease.remote.port}`
    },
    remoteOrigin: (tunnelConfig: TunnelConfig) => {
        const schema = import.meta.env.VITE_SERVER_SCHEMA ?? 'https';
        return `${schema}://${tunnelConfig.server.hostName}`
    },
    localAddress: (tunnelConfig: TunnelConfig) => 
      `${!!tunnelConfig.https ? 'https' : 'http'}://${tunnelConfig.hostName}:${tunnelConfig.port}`,
    address: (addressInfo: AddressInfo | string) => {
        if (!isAddressInfo(addressInfo)) return addressInfo;
        if (addressInfo.family === 'IPv6') {
            if (addressInfo.address === '::') return `//localhost:${addressInfo.port}`;
            else return `//[${addressInfo.address}]:${addressInfo.port}`;
        }
        if (addressInfo.address === '127.0.0.1') return `//localhost:${addressInfo.port}`;
        else return `//${addressInfo.address}:${addressInfo.port}`;
    }
}

function isAddressInfo(addressInfo: AddressInfo | string): addressInfo is AddressInfo {
    return addressInfo.constructor.name === 'AddressInfo'
} 