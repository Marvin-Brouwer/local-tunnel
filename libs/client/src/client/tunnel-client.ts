import { type Duplex, EventEmitter } from 'node:stream';
import { applyConfig, type TunnelConfig, type ClientConfig } from './client-config';
import { getTunnelLease, type TunnelLease } from '../tunnel/tunnel-lease';
import { TunnelEventEmitter, TunnelEventListener } from '../tunnel/tunnel-events';
import { createUpstreamConnection } from '../tunnel/upstream-connection';
import { createDownstreamConnection } from '../tunnel/downstream-connection';
import { createFallbackConnection } from '../tunnel/fallback-connection';
import '../tunnel/transforms/header-host-transform';

// TODO, make the tunnel lease a constructor parameter again if we can't get the reconnect to work the way we'd like.

export const createLocalTunnel = async (config: ClientConfig): Promise<TunnelClient> => {

    const tunnelConfig = applyConfig(config);

    return new TunnelClient(
        tunnelConfig
    )
}

export class TunnelClient {

    #emitter: TunnelEventEmitter;
    #upstream: Duplex;
    #downstream: Duplex;
    #fallback: Duplex;

    private tunnelLease: TunnelLease | undefined;

    #status: 'open' | 'closed' | 'reconnecting' | 'connecting'

    public get status() {
        return this.#status
    }
    public get url() {
        return this.tunnelLease?.tunnelUrl ?? '[not connected]'
    }
    public get requestedUrl() {
        const schema = import.meta.env.VITE_SERVER_SCHEMA ?? 'https';
        return `${schema}://${this.tunnelConfig.server.subdomain ?? '[random]'}.${this.tunnelConfig.server.hostName}`
    }
    public get password() {
        return this.tunnelLease?.client.publicIp
    }

    constructor(
        readonly tunnelConfig: TunnelConfig
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
        this.#fallback = await createFallbackConnection(this.tunnelConfig, this.#emitter);
        this.#fallback.pause();

        return this.#openConnection();
    }

    async #openConnection(): Promise<this> {
        
        this.tunnelLease = await getTunnelLease(this.tunnelConfig);
        this.#emitter.setMaxListeners(this.tunnelLease.maximumConnections);

        this.#upstream = await createUpstreamConnection(this.tunnelLease, this.#emitter);
        this.#upstream
            .transformHeaderHost(this.tunnelConfig)
            .pipe(this.#fallback)
            .pipe(this.#upstream);
        this.#fallback
            .resume();
        
        this.#status = 'open';

        const connectDownstream =  async () => {
        
            this.#downstream = await createDownstreamConnection(this.tunnelConfig, this.#emitter);
            const downStreamConnectError = () => {
                console.log('dse');
                // Close all
                this.#upstream.unpipe()
                this.#fallback.unpipe();
                this.#downstream.unpipe();
                // Attach fallback
                this.#upstream
                    .transformHeaderHost(this.tunnelConfig)
                    .pipe(this.#fallback)
                    .pipe(this.#upstream);
                this.#fallback
                    .resume();

                this.#status = 'reconnecting'
                this.#downstream.end((() => {
                    setTimeout(connectDownstream.bind(this), 5000);
                }).bind(this));
            }
            const downstreamConnected = () => {
                this.#downstream.off('finish', downStreamConnectError);
                this.#downstream.off('error', downStreamConnectError);

                // Detach fallback page
                this.#fallback.pause();
                this.#upstream.unpipe()
                this.#fallback.unpipe();
                // Attach upstream
                this.#upstream
                    .transformHeaderHost(this.tunnelConfig)
                    .pipe(this.#downstream)
                    .pipe(this.#upstream);

                this.#downstream.once('finish', downStreamConnectError);
                this.#downstream.once('error', downStreamConnectError);
            }
            this.#downstream.once('finish', downStreamConnectError);
            this.#downstream.once('error', downStreamConnectError);
            this.#downstream.once('connect', downstreamConnected);
        }

        await connectDownstream();

        return this;
    }

    public async close(): Promise<this> {
        if (this.status === 'closed') {
            console.warn('Tunnel was already closed, noop.');
            return this;
        }
        this.#status = 'closed';

        // TODO, better to close all of them instead of misusing the emitter
        this.#emitter.emit('app-close');

        return this;
    }

    public on: TunnelEventListener<this> = (eventName, listener) => {
        this.#emitter.on(eventName, listener);
        return this;
    }
}