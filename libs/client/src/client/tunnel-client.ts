import '../tunnel/transforms/header-host-transform';

import { type Duplex, EventEmitter } from 'node:stream';
import { applyConfig, type TunnelConfig, type ClientConfig } from './client-config';
import { getTunnelLease, type TunnelLease } from '../tunnel/tunnel-lease';
import { type TunnelEventEmitter, type TunnelEventListener } from '../errors/tunnel-events';
import { createUpstreamConnection } from '../tunnel/upstream-connection';
import { createProxyConnection } from '../tunnel/proxy-connection';
import { format } from '../logger';
import { LeaseRejectedError } from '../errors/upstream-tunnel-errors';

export const createLocalTunnel = async (config: ClientConfig): Promise<TunnelClient> => {

    const tunnelConfig = applyConfig(config);
    const tunnelLease = await getTunnelLease(tunnelConfig)
        .catch((err) => { throw new LeaseRejectedError(tunnelConfig, err); });

    return new TunnelClient(
        tunnelConfig,
        tunnelLease
    )
}

export class TunnelClient {

    #emitter: EventEmitter & TunnelEventEmitter;
    #upstream: Duplex;
    #fallback: Duplex;

    #status: 'open' | 'closed' | 'connecting' | 'closing' 

    public get status() {
        return this.#status
    }
    public get url() {
        return this.tunnelLease.tunnelUrl
    }
    public get cachedUrl() {
        return this.tunnelLease.cachedTunnelUrl
    }
    public get localAddress() {
        return format.localAddress(this.tunnelConfig);
    }
    public get password() {
        return this.tunnelLease.client.publicIp
    }

    constructor(
        readonly tunnelConfig: TunnelConfig,
        readonly tunnelLease: TunnelLease
    ) {
        this.#emitter = new EventEmitter({ captureRejections: true }) as EventEmitter & TunnelEventEmitter;
    }

    public async open(): Promise<this> {
        if (this.status === 'connecting') {
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
            .on('data', (chunk: Buffer) => {
                const httpLeader = chunk.toString().split(/(\r\n|\r|\n)/)[0]
                const [method, path] = httpLeader.split(' ');
                this.#emitter.emit('pipe-request', method, path)
            })
            .pipe(this.#fallback)
            .pipe(this.#upstream)
            .on('close', () => {
                if(this.#status !== 'closed' && !this.#upstream.destroyed)
                    this.#emitter.emit('tunnel-close');
            });

        this.#fallback
            .resume();
        
        this.#status = 'open';
		this.#emitter.emit('tunnel-open');

        return this;
    }

    public async close(): Promise<this> {
        if (this.status === 'closed' || this.status === 'closing') {
            console.warn('Tunnel was already closed, noop.');
            return this;
        }
        
        this.#status = 'closing';

        await Promise.all([
            new Promise(r => this.#fallback.end(r)),
            new Promise(r => this.#upstream.end(r))
        ])
        if (!this.#upstream.destroyed)
		    this.#emitter.emit('tunnel-closed');

        this.#fallback.destroy();
        this.#upstream.destroy();
        
        this.#status = 'closed';

        return this;
    }

    public on: TunnelEventListener<this> = (eventName, listener) => {
        this.#emitter.on(eventName, listener);
        return this;
    }
}