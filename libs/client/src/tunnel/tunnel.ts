import './transforms/header-host-transform';

import { type AddressInfo } from 'node:net';
import { type Duplex, type EventEmitter } from 'node:stream';

import { createProxyConnection } from './proxy-connection';
import { type TunnelLease } from './tunnel-lease';
import { createUpstreamConnection } from './upstream-connection';
import { type TunnelConfig } from '../client/client-config';
import { type TunnelEventEmitter, type TunnelEventListener, createWarning } from '../errors/tunnel-events';
import { awaitCallback } from '../promise-helper';

export class Tunnel {
	#upstream?: Duplex;

	#closeHandler: () => Promise<void>;

	#proxy?: Duplex;

	#status: 'open' | 'closed' | 'connecting' | 'closing' = 'closed';

	public get status() {
		return this.#status;
	}

	// eslint-disable-next-line function-paren-newline
	constructor(
		// Can't get the linter to work with constructor args
		// eslint-disable-next-line no-unused-vars
		readonly id: number,
		// Can't get the linter to work with constructor args
		// eslint-disable-next-line no-unused-vars
		readonly tunnelConfig: TunnelConfig,
		// Can't get the linter to work with constructor args
		// eslint-disable-next-line no-unused-vars
		readonly tunnelLease: TunnelLease,
		// Can't get the linter to work with constructor args
		// eslint-disable-next-line no-unused-vars
		readonly emitter: TunnelEventEmitter,
		// Can't get the linter to work with constructor args
		// eslint-disable-next-line no-unused-vars
		readonly proxyErrorServerAddress: AddressInfo,
		// Can't get the linter to work with constructor args
		// eslint-disable-next-line no-unused-vars
		readonly abortSignal: AbortSignal,
		// Can't get the linter to work with constructor args
		// eslint-disable-next-line no-unused-vars
		onClose: () => Promise<void>
	) {
		this.#closeHandler = onClose.bind(this);
	}

	public async connect(): Promise<this> {
		if (this.status === 'open' || this.status === 'connecting') {
			this.emitter.emit('warning',
				createWarning('DuplicateCall', `Tunnel ${this.id} was already connected, noop.`));
			return this;
		}
		this.#proxy = await createProxyConnection(
			this.id, this.proxyErrorServerAddress, this.emitter, this.abortSignal
		);

		this.#upstream = await createUpstreamConnection(
			this.id, this.tunnelLease, this.emitter, this.abortSignal
		);

		this.#upstream
			.transformHeaderHost(this.tunnelConfig)
			.on('data', (chunk: Buffer) => {
				const httpLeader = chunk.toString().split(/(\r\n|\r|\n)/)[0];
				const [method, path,] = httpLeader.split(' ');
				this.emitter.emit(
					'pipe-request', method, path
				);
			})
			.pipe(this.#proxy!)
			.pipe(this.#upstream)
			.on('close', async () => {
				if (this.abortSignal.aborted) return;
				if (this.#status === 'closed' || this.#status === 'closing') return;

				await this.#closeHandler();
			});

		this.#proxy!
			.resume();

		return this;
	}

	public async close(): Promise<this> {
		if (this.status === 'closed' || this.status === 'closing') {
			this.emitter.emit('warning',
				createWarning('DuplicateCall', `Tunnel ${this.id} was already closed, noop.`));
			return this;
		}

		this.#status = 'closing';

		await Promise.all([
			awaitCallback(this.#proxy?.end),
			awaitCallback(this.#upstream?.end),
		]);

		this.#proxy?.destroy();
		this.#upstream?.destroy();

		this.#status = 'closed';

		return this;
	}

	public on: TunnelEventListener<this> = (eventName, listener) => {
		(this.emitter as unknown as EventEmitter).on(eventName, listener);
		return this;
	};
}
