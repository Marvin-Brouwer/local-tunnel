import { applyConfig, type ClientConfig } from './client-config';

export const createLocalTunnelClient = (config: ClientConfig): LocalTunnelClient => {

    const tunnelConfig = applyConfig(config);
}