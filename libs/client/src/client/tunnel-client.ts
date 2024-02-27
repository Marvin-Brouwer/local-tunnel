import '../tunnel/transforms/header-host-transform';

import { type Duplex, EventEmitter } from 'node:stream';
import { applyConfig, type TunnelConfig, type ClientConfig } from './client-config';
import { getTunnelLease, type TunnelLease } from '../tunnel/tunnel-lease';
import { TunnelEventEmitter, TunnelEventListener } from '../tunnel/tunnel-events';
import { createUpstreamConnection } from '../tunnel/upstream-connection';
import { createProxyConnection } from '../tunnel/proxy-connection';
import { type DuplexConnectionError } from '../tunnel/errors';

export const createLocalTunnel = async (config: ClientConfig): Promise<TunnelClient> => {

    const tunnelConfig = applyConfig(config);
    const tunnelLease = await getTunnelLease(tunnelConfig);

    return new TunnelClient(
        tunnelConfig,
        tunnelLease
    )
}

export class TunnelClient {

    #emitter: TunnelEventEmitter;
    #upstream: Duplex;
    #fallback: Duplex;

    #status: 'open' | 'closed' | 'reconnecting' | 'connecting'

    public get status() {
        return this.#status
    }
    public get url() {
        return this.tunnelLease.tunnelUrl
    }
    public get requestedUrl() {
        const schema = import.meta.env.VITE_SERVER_SCHEMA ?? 'https';
        return `${schema}://${this.tunnelConfig.server.subdomain ?? '[random]'}.${this.tunnelConfig.server.hostName}`
    }
    public get password() {
        return this.tunnelLease.client.publicIp
    }

    constructor(
        readonly tunnelConfig: TunnelConfig,
        readonly tunnelLease: TunnelLease
    ) {
        this.#emitter = new EventEmitter({ captureRejections: true }) as TunnelEventEmitter;
    }

    public async open(): Promise<this> {
        if (this.status === 'connecting' || this.status === 'reconnecting') {
            console.warn('Tunnel was already connecting, noop.');
            return this;
        }
        if (this.status === 'open') {
            console.warn('Tunnel was already open, noop.');
            return this;
        }
        
        this.#status === 'connecting';
        this.#fallback = await createProxyConnection(this.tunnelConfig, this.tunnelLease, this.#emitter);
        this.#fallback.pause();

        this.#emitter.setMaxListeners(this.tunnelLease.maximumConnections);

        this.#upstream = await createUpstreamConnection(this.tunnelLease, this.#emitter);
        this.#upstream
            .transformHeaderHost(this.tunnelConfig)
            .pipe(this.#fallback)
            .pipe(this.#upstream);

        this.#fallback
            .resume();
        
        this.#status = 'open';

        this.#upstream.on('error', async (err: DuplexConnectionError) => {
            // If the upstream server get's closed
            if (err.code === 'ECONNRESET') {
                this.#emitter.emit('upstream-error', err);
                await this.close();
                this.#emitter.emit('tunnel-dead');
                return;
            }
        })


        return this;
    }

    public async close(): Promise<this> {
        if (this.status === 'closed') {
            console.warn('Tunnel was already closed, noop.');
            return this;
        }
        
        this.#status = 'closed';

        await Promise.all([
            new Promise(r => this.#fallback.end(r)),
            new Promise(r => this.#upstream.end(r))
        ])
        this.#fallback.destroy();
        this.#upstream.destroy();

        return this;
    }

    public on: TunnelEventListener<this> = (eventName, listener) => {
        this.#emitter.on(eventName, listener);
        return this;
    }
}