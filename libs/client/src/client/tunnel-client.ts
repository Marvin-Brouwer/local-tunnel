import '../tunnel/transforms/header-host-transform';

import { type Duplex, EventEmitter } from 'node:stream';

import { type ClientConfig, type TunnelConfig, applyConfig } from './client-config';
import { type TunnelEventEmitter, type TunnelEventListener } from '../errors/tunnel-events';
import { format } from '../logger';
import { createProxyConnection } from '../tunnel/proxy-connection';
import { type TunnelLease, getTunnelLease } from '../tunnel/tunnel-lease';
import { createUpstreamConnection } from '../tunnel/upstream-connection';

export class TunnelClient {
	#emitter: EventEmitter & TunnelEventEmitter;

	#upstream: Duplex;

	#fallback: Duplex;

	#status: 'open' | 'closed' | 'connecting' | 'closing';

	public get status() {
		return this.#status;
	}

	public get url() {
		return this.tunnelLease.tunnelUrl;
	}

	public get cachedUrl() {
		return this.tunnelLease.cachedTunnelUrl;
	}

	public get localAddress() {
		return format.localAddress(this.tunnelConfig);
	}

	public get password() {
		return this.tunnelLease.client.publicIp;
	}

	constructor(
		// Can't get the linter to work with constructor args
		// eslint-disable-next-line no-unused-vars
        readonly tunnelConfig: TunnelConfig,
        // Can't get the linter to work with constructor args
        // eslint-disable-next-line no-unused-vars
        readonly tunnelLease: TunnelLease,
	) {
		this.#emitter = new EventEmitter({
			captureRejections: true,
		}) as EventEmitter & TunnelEventEmitter;
	}

	public async open(): Promise<this> {
		if (this.status === 'connecting') {
			// eslint-disable-next-line no-console
			console.warn('Tunnel was already connecting, noop.');
			return this;
		}
		if (this.status === 'open') {
			// eslint-disable-next-line no-console
			console.warn('Tunnel was already open, noop.');
			return this;
		}

		this.#status = 'connecting';
		this.#fallback = await createProxyConnection(this.tunnelConfig, this.tunnelLease, this.#emitter);
		this.#fallback.pause();

		this.#emitter.setMaxListeners(this.tunnelLease.maximumConnections);

		this.#upstream = await createUpstreamConnection(this.tunnelLease, this.#emitter);
		this.#upstream
			.transformHeaderHost(this.tunnelConfig)
			.on('data', (chunk: Buffer) => {
				const httpLeader = chunk.toString().split(/(\r\n|\r|\n)/)[0];
				const [method, path] = httpLeader.split(' ');
				this.#emitter.emit('pipe-request', method, path);
			})
			.pipe(this.#fallback)
			.pipe(this.#upstream)
			.on('close', () => {
				if (this.#status !== 'closed' && !this.#upstream.destroyed) { this.#emitter.emit('tunnel-close'); }
			});

		this.#fallback
			.resume();

		this.#status = 'open';
		this.#emitter.emit('tunnel-open');

		return this;
	}

	public async close(): Promise<this> {
		if (this.status === 'closed' || this.status === 'closing') {
			// eslint-disable-next-line no-console
			console.warn('Tunnel was already closed, noop.');
			return this;
		}

		this.#status = 'closing';

		await Promise.all([
			// eslint-disable-next-line no-promise-executor-return
			new Promise<void>((r) => this.#fallback.end(r)),
			// eslint-disable-next-line no-promise-executor-return
			new Promise<void>((r) => this.#upstream.end(r)),
		]);
		if (!this.#upstream.destroyed) { this.#emitter.emit('tunnel-closed'); }

		this.#fallback.destroy();
		this.#upstream.destroy();

		this.#status = 'closed';

		return this;
	}

	public on: TunnelEventListener<this> = (eventName, listener) => {
		this.#emitter.on(eventName, listener);
		return this;
	};
}

export const createLocalTunnel = async (config: ClientConfig): Promise<TunnelClient> => {
	const tunnelConfig = applyConfig(config);
	const tunnelLease = await getTunnelLease(tunnelConfig);

	return new TunnelClient(
		tunnelConfig,
		tunnelLease,
	);
};
