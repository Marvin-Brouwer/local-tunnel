import { Duplex, EventEmitter, Readable, Writable, pipeline } from 'node:stream';
import { applyConfig, type TunnelConfig, type ClientConfig } from './client-config';
import { getTunnelLease, type TunnelLease } from '../tunnel/tunnel-lease';
import { TunnelEventEmitter, TunnelEventListener } from '../tunnel/tunnel-events';
import { createUpstreamConnection } from '../tunnel/upstream-connection';
import { stringStream } from '../tunnel/streams/string-stream';
import { DuplexConnectionError } from '../tunnel/errors';
import { createDownstreamConnection } from '../tunnel/downstream-connection';

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
    #upstream: Duplex;
    #downstream: Duplex;

    #status: 'open' | 'closed'

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
        // this.#cluster = new TunnelCluster(tunnelConfig, tunnelLease, this.#emitter);
    }

    public async open(): Promise<this> {
        if (this.status === 'open') {
            console.warn('Tunnel was already open, noop.');
            return this;
        }
        this.#status = 'open';

        const testResponse = [
            'HTTP/1.1 200 OK',
            'Content-Type: text/html; charset=UTF-8',
            'Content-Encoding: UTF-8',
            'Accept-Ranges: bytes',
            'Connection: keep-alive',
            '',
            '<p>Test</p>'
        ];
        this.#upstream = await createUpstreamConnection(this.tunnelLease, this.#emitter);
        this.#downstream = await createDownstreamConnection(this.tunnelConfig, this.#emitter);

        this.#upstream.once('data', (chunk: Buffer) => {
            console.log('data')
        })
        const test = () => new Duplex({
            read(size) {
                console.log('size', size);
            },
            write(chunk, encoding, callback) {
                console.log('chunk', chunk);
                
                callback();
            },
        })
        // textResponse.push(testResponse.join('\n') + '\n\n', 'utf-8');
        
            this.#upstream
            .pipe(this.#downstream)
            .pipe(this.#upstream);

        return this;
    }

    public async close(): Promise<this> {
        if (this.status === 'closed') {
            console.warn('Tunnel was already closed, noop.');
            return this;
        }
        this.#status = 'closed';

        this.#emitter.emit('app-close');

        return this;
    }

    public on: TunnelEventListener<this> = (eventName, listener) => {
        this.#emitter.on(eventName, listener);
        return this;
    }
}