import '../tunnel/transforms/header-host-transform';

import { EventEmitter, setMaxListeners } from 'node:events';
import { type Server } from 'node:http';
import { type AddressInfo } from 'node:net';

import { type ClientConfig, type TunnelConfig, applyConfig } from './client-config';
import { type TunnelEventEmitter, type TunnelEventListener, createWarning } from '../errors/tunnel-events';
import { format } from '../logger';
import { awaitCallback, wait } from '../promise-helper';
import { keepAlive } from '../tunnel/keep-alive';
import { createProxyErrorServer } from '../tunnel/proxy-error-server';
import { Tunnel } from '../tunnel/tunnel';
import { type TunnelLease, getTunnelLease } from '../tunnel/tunnel-lease';

export class TunnelClient {
	#emitter: EventEmitter & TunnelEventEmitter;

	#proxyErrorServer?: Server;

	#upstreamAbortController: AbortController;

	#tunnels: Array<Tunnel>;

	#status: 'open' | 'closed' | 'connecting' | 'closing' = 'closed';

	#bufferedWarnings: Array<Error>;

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
		readonly tunnelLease: TunnelLease,
		// Can't get the linter to work with constructor args
		// eslint-disable-next-line no-unused-vars
		bufferedWarnings: Array<Error>
		// ---
	) {
		this.#emitter = new EventEmitter({
			captureRejections: true
		}) as EventEmitter & TunnelEventEmitter;

		// We can set these to 0, since the upstream connection doesn't allow any more connections than configured
		this.#emitter.setMaxListeners(0);

		this.#bufferedWarnings = bufferedWarnings;

		this.#upstreamAbortController = new AbortController();
		this.#tunnels = new Array<Tunnel>(tunnelLease.maximumConnections - this.#calculateTunnelMargin());
	}

	#calculateTunnelMargin() {
		if (this.tunnelLease.maximumConnections >= 7) return Math.ceil(this.tunnelLease.maximumConnections / 4);

		this.#bufferedWarnings.push(createWarning(
			'LowConnection',
			`Low connection count detected: ${this.tunnelLease.maximumConnections}\n`
			+ 'This may cause unintentional connection issues.',
			'tunnelLease.maximumConnections < 7'
		));
		if (this.tunnelLease.maximumConnections >= 5) return 2;

		this.#bufferedWarnings.push(createWarning(
			'LowConnection',
			`Very low connection count detected: ${this.tunnelLease.maximumConnections}\n`
			+ 'This may cause unintentional connection issues.',
			'tunnelLease.maximumConnections < 5'
		));

		return 0;
	}

	public async open(): Promise<this> {
		if (this.status === 'connecting') {
			this.#emitter.emit('warning',
				createWarning('DuplicateCall', 'TunnelClient was already connecting, noop.'));
			return this;
		}
		if (this.status === 'open') {
			this.#emitter.emit('warning',
				createWarning('DuplicateCall', 'TunnelClient was already open, noop.'));
			return this;
		}

		// eslint-disable-next-line no-restricted-syntax
		for (const warning of this.#bufferedWarnings) {
			this.#emitter.emit('warning', warning);
		}
		this.#bufferedWarnings = [];

		this.#upstreamAbortController = new AbortController();
		// We can set these to 0, since the upstream connection doesn't allow any more connections than configured
		setMaxListeners(0, this.#upstreamAbortController.signal);

		this.#status = 'connecting';

		this.#proxyErrorServer = await createProxyErrorServer(
			this.tunnelConfig, this.tunnelLease, this.#emitter, this.#upstreamAbortController.signal
		);

		await this.#createTunnels();

		keepAlive(this.tunnelLease, this.#upstreamAbortController.signal);

		this.#status = 'open';
		this.#emitter.emit('tunnel-open');

		return this;
	}

	async #createTunnels() {
		const errorServerAddress = (this.#proxyErrorServer!.address() as AddressInfo);

		for (let i = 0; i < this.#tunnels.length; i += 1) {
			const reconnectTunnel = async () => {
				if (this.#upstreamAbortController.signal.aborted) return;
				if (this.#status === 'closed' || this.#status === 'closing') return;

				const currentTunnel = this.#tunnels[i];

				this.#tunnels[i] = await currentTunnel.connect();

				await wait(100);
				await currentTunnel.close();
			};

			this.#tunnels[i] = new Tunnel(
				i,
				this.tunnelConfig,
				this.tunnelLease,
				this.#emitter,
				errorServerAddress,
				this.#upstreamAbortController.signal,
				reconnectTunnel
			);
		}

		await Promise
			.all(this.#tunnels.map(async (tunnel, i) => {
				// Stagger the initial connection, both for logging and to not fry the remote
				await wait(200 * i);
				await tunnel.connect();
			}));
	}

	public async close(): Promise<this> {
		if (this.status === 'closed' || this.status === 'closing') {
			this.#emitter.emit('warning',
				createWarning('DuplicateCall', 'TunnelClient was already closed, noop.'));
			return this;
		}

		this.#status = 'closing';

		await Promise.all([
			...this.#tunnels.map((tunnel) => tunnel.close),
		]);
		this.#proxyErrorServer?.closeIdleConnections();
		this.#proxyErrorServer?.closeAllConnections();
		await awaitCallback(this.#proxyErrorServer?.close).catch((err: Error) => {
			// Swallow "Cannot read properties of undefined (reading 'closeIdleConnections')".
			// There's some bug inside of the client, but we can kill it now anyway.
			if (err.name !== 'TypeError' || !err.message.includes('closeIdleConnections')) throw err;
		});

		this.#upstreamAbortController.abort('closing connection');
		this.#emitter.emit('tunnel-closed');
		this.#status = 'closed';

		return this;
	}

	public on: TunnelEventListener<this> = (eventName, listener) => {
		this.#emitter.on(eventName, listener);
		return this;
	};
}

export const createLocalTunnel = async (config: ClientConfig): Promise<TunnelClient> => {
	const bufferedWarnings: Array<Error> = [];

	const tunnelConfig = applyConfig(config);
	const tunnelLease = await getTunnelLease(tunnelConfig, (warning) => bufferedWarnings.push(warning));

	return new TunnelClient(
		tunnelConfig, tunnelLease, bufferedWarnings
	);
};
