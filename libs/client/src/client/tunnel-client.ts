import { EventEmitter } from 'node:stream';
import { applyConfig, type TunnelConfig, type ClientConfig } from './client-config';
import { getTunnelLease, type TunnelLease } from '../tunnel/tunnel-lease';
import { TunnelEventEmitter, TunnelEventListener } from '../tunnel/tunnel-events';
import { TunnelCluster } from '../tunnel/tunnel-cluster';

export const createLocalTunnel = async (config: ClientConfig): Promise<TunnelClient> => {

    const tunnelConfig = applyConfig(config);
    const lease = await getTunnelLease(tunnelConfig);

    return new TunnelClient(
        tunnelConfig,
        lease
    )
}

export class TunnelClient {

    #emitter: TunnelEventEmitter;
    #cluster: TunnelCluster;

    #status: 'open' | 'close'

    public get status() {
        return this.#status
    }
    public get url() {
        return this.tunnelLease.tunnelUrl
    }
    public get password() {
        return this.tunnelLease.client.publicIp
    }

    constructor(
        readonly tunnelConfig: TunnelConfig,
        readonly tunnelLease: TunnelLease
    ) {
        this.#emitter = new EventEmitter({ captureRejections: true }) as TunnelEventEmitter;
        this.#emitter.setMaxListeners(tunnelLease.maximumConnections);
        this.#cluster = new TunnelCluster(tunnelConfig, tunnelLease, this.#emitter);
    }

    public async open(): Promise<this> {
        if (this.status === 'open'){
            console.warn('Tunnel was already open, noop.');
            return this;
        }

        await this.#cluster.open();

        return this;
    }

    public async close(): Promise<this> {
        if (this.status === 'open'){
            console.warn('Tunnel was already closed, noop.');
            return this;
        }
        
        await this.#cluster.close();

        return this;
    }

    public on: TunnelEventListener<this> = (eventName, listener) => {
        this.#emitter.on(eventName, listener);
        return this;
    }
}