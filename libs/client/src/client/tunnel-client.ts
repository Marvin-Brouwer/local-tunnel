import { type ClientConfig } from './client-config';

export type LocalHostConfiguration = {
    port: number,
    host?: string,
    https?: boolean
}

export interface LocalTunnelClient extends ClientConfig<LocalTunnelClient> {
    
}

export const createLocalTunnelClient = (localHost: LocalHostConfiguration): LocalTunnelClient => {

}