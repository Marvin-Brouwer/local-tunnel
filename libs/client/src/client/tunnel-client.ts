import '../tunnel/transforms/header-host-transform';

import { EventEmitter, setMaxListeners } from 'node:events';
import { type Duplex } from 'node:stream';

import { type ClientConfig, type TunnelConfig, applyConfig } from './client-config';
import { type TunnelEventEmitter, type TunnelEventListener } from '../errors/tunnel-events';
import { format } from '../logger';
import { keepAlive } from '../tunnel/keep-alive';
import { createProxyConnection } from '../tunnel/proxy-connection';
import { type TunnelLease, getTunnelLease } from '../tunnel/tunnel-lease';
import { createUpstreamConnection } from '../tunnel/upstream-connection';

export class TunnelClient {
	#emitter: EventEmitter & TunnelEventEmitter;

	#upstream?: Duplex;

	#proxy?: Duplex;

	#upstreamAbortController: AbortController;

	#status: 'open' | 'closed' | 'connecting' | 'closing' = 'closed';

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

	// eslint-disable-next-line function-paren-newline
	constructor(
		// Can't get the linter to work with constructor args
		// eslint-disable-next-line no-unused-vars
		readonly tunnelConfig: TunnelConfig,
		// Can't get the linter to work with constructor args
		// eslint-disable-next-line no-unused-vars
		readonly tunnelLease: TunnelLease) {
		this.#emitter = new EventEmitter({
			captureRejections: true
		}) as EventEmitter & TunnelEventEmitter;

		this.#upstreamAbortController = new AbortController();
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

		this.#upstreamAbortController = new AbortController();
		this.#status = 'connecting';
		this.#proxy = await createProxyConnection(
			this.tunnelConfig, this.tunnelLease, this.#emitter, this.#upstreamAbortController.signal
		);
		this.#proxy.pause();

		// We can set these to 0, since the upstream connection doesn't allow any more connections than configured
		this.#emitter.setMaxListeners(0);
		setMaxListeners(0, this.#upstreamAbortController.signal);

		this.#upstream = await createUpstreamConnection(
			this.tunnelLease, this.#emitter, this.#upstreamAbortController.signal
		);
		this.#upstream
			.transformHeaderHost(this.tunnelConfig)
			.on('data', (chunk: Buffer) => {
				const httpLeader = chunk.toString().split(/(\r\n|\r|\n)/)[0];
				const [method, path,] = httpLeader.split(' ');
				this.#emitter.emit(
					'pipe-request', method, path
				);
			})
			.pipe(this.#proxy)
			.pipe(this.#upstream)
			.on('close', () => {
				if (this.#status !== 'closed' && !this.#upstream?.destroyed) { this.#emitter.emit('tunnel-close'); }
			});

		this.#proxy
			.resume();

		keepAlive(this.tunnelLease, this.#upstreamAbortController.signal);

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
			new Promise<void>((r) => this.#proxy?.end(r) ?? r()),
			// eslint-disable-next-line no-promise-executor-return
			new Promise<void>((r) => this.#upstream?.end(r) ?? r()),
		]);
		this.#upstreamAbortController.abort('closing connection');
		if (!this.#upstream?.destroyed) { this.#emitter.emit('tunnel-closed'); }

		this.#proxy?.destroy();
		this.#upstream?.destroy();

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

	return new TunnelClient(tunnelConfig,
		tunnelLease);
};
