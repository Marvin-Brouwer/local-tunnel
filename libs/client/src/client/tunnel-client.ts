import { type Duplex, EventEmitter } from 'node:stream';
import { applyConfig, type TunnelConfig, type ClientConfig } from './client-config';
import { getTunnelLease, type TunnelLease } from '../tunnel/tunnel-lease';
import { TunnelEventEmitter, TunnelEventListener } from '../tunnel/tunnel-events';
import { createUpstreamConnection } from '../tunnel/upstream-connection';
import { createDownstreamConnection } from '../tunnel/downstream-connection';
import { createFallbackConnection } from '../tunnel/fallback-connection';
import '../tunnel/transforms/header-host-transform';
import { type DuplexConnectionError } from '../tunnel/errors';

// TODO, make the tunnel lease a constructor parameter again if we can't get the reconnect to work the way we'd like.

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
    #downstream: Duplex;
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
        this.#fallback = await createFallbackConnection(this.tunnelConfig, this.tunnelLease, this.#emitter);
        this.#fallback.pause();

        return this.#openConnection();
    }

    async #openConnection(): Promise<this> {

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
                    // .pipe(new Transform({
                    //     emitClose: true,
                    //     final(callback) {
                    //         this.pause();
                            
                    //     },
                    //     transform(chunk, encoding, callback) {
                    //         const data = chunk.toString();
                    //         if (!data.includes('?keepalive')) 
                    //         console.log('tf', data);
                    //         callback(null, chunk);                            
                    //     },
                    //     // write(c, e, cb) {
                    //     //     const data = c.toString();
                    //     //     if (!data.includes('?keepalive')) 
                    //     //         console.log('write', data);
                    //     //     this.push(c, e);
                    //     //     cb();
                    //     // }
                    // }))
                    .pipe(this.#upstream);

                this.#downstream.once('finish', downStreamConnectError);
                this.#downstream.once('error', downStreamConnectError);
            }
            this.#downstream.once('finish', downStreamConnectError);
            this.#downstream.once('error', downStreamConnectError);
            this.#downstream.once('connect', downstreamConnected);
        }

        // await connectDownstream();

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
        await Promise.all([
            new Promise(r => this.#fallback.end(r)),
            new Promise(r => this.#upstream.end(r)),
            new Promise(r => this.#downstream.end(r))
        ])

        return this;
    }

    public on: TunnelEventListener<this> = (eventName, listener) => {
        this.#emitter.on(eventName, listener);
        return this;
    }
}