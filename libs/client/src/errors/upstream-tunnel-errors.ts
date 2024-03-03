/* eslint-disable max-classes-per-file */

import { LocalTunnelError } from './local-tunnel-error';
import { type DestroyedSocketError, type SocketError, cleanSocketError } from './socket-error';
import { type TunnelConfig } from '../client/client-config';
import { format } from '../logger';
import { type TunnelLease } from '../tunnel/tunnel-lease';

/**
 * Base error indicating something failed in the connection to the `upstream` tunnel connection.
 * Meaning, the the `local-tunnel` server, responsible for exposing your application.
 */
export abstract class UpstreamTunnelError extends LocalTunnelError {
	public static isUpstreamTunnelError(error: Error): error is UpstreamTunnelError {
		return error.constructor.name === UpstreamTunnelError.name;
	}

    public abstract readonly reason: string
}

/**
 * Error indicating the `upstream` tunnel rejected connection.
 *
 * This is most likely due to the upstream server restarting or network errors.
 * If this is not the case, you should check your firewall settings.
 */
export class UpstreamTunnelRejectedError extends LocalTunnelError {
	public static isUpstreamTunnelRejectedError(error: Error): error is UpstreamTunnelRejectedError {
		return error.constructor.name === UpstreamTunnelRejectedError.name;
	}

	public get reason() {
		return this.socketError.code;
	}

	constructor(tunnelLease: TunnelLease, private readonly socketError: SocketError) {
		super();

		this.socketError = cleanSocketError(socketError);
		this.message = `The upstream tunnel ${format.remoteAddress(tunnelLease)} rejected the connection. \n`
            + 'Check your firewall for outbound rules to the tunnel '
			+ `or inbound rules for port ${tunnelLease.remote.port}`;
	}
}

/**
 * Error indicating the lease fetch to the `upstream` tunnel failed.
 *
 * This is most likely due to the upstream server restarting or network errors.
 * If this is not the case, you should check your firewall settings.
 */
export class LeaseFetchRejectedError extends LocalTunnelError {
	public static isLeaseRejectedFetchError(error: Error): error is LeaseFetchRejectedError {
		return error.constructor.name === LeaseFetchRejectedError.name;
	}

	public get reason() {
		return (this.error.cause as DestroyedSocketError | undefined)?.code ?? 'UNKNOWN';
	}

	constructor(tunnelConfig: TunnelConfig, private readonly error: Error) {
		super();

		this.error = cleanSocketError(error);

		this.message = `The upstream tunnel ${format.remoteOrigin(tunnelConfig)} rejected the lease request \n`
            + 'Check your firewall for outbound rules to the tunnel';
	}
}

/**
 * Error indicating the `upstream` tunnel rejected the lease request.
 *
 * This is most likely due to the upstream server restarting or network errors.
 * If this is not the case, you should check your firewall settings.
 */
export class LeaseFetchResponseError extends LocalTunnelError {
	public static isLeaseRejectedError(error: Error): error is LeaseFetchResponseError {
		return error.constructor.name === LeaseFetchResponseError.name;
	}

	public get reason() {
		return `${this.response.status} ${this.response.statusText}`;
	}

	constructor(tunnelConfig: TunnelConfig, private readonly response: Response) {
		super();

		this.message = `The upstream tunnel ${format.remoteOrigin(tunnelConfig)} rejected the lease request \n`
            + `with a response of: ${response.status} ${response.statusText} \n`
            + 'Check your firewall for outbound rules to the tunnel';
	}
}

/**
 * Error indicating the `upstream` tunnel or host had an unexpected error.
 *
 * **Note:** We like to keep the unexpected errors to a minimum.
 * If you encounter any, please report a bug at {@link https://github.com/Marvin-Brouwer/local-tunnel/issues/new?assignees=&labels=bug&template=unexpected-error.md&title=}
 */
export class UnknownUpstreamTunnelError extends LocalTunnelError {
	public static isUnknownUpstreamTunnelError(error: Error): error is UnknownUpstreamTunnelError {
		return error.constructor.name === UnknownUpstreamTunnelError.name;
	}

	public get reason() {
		return this.socketError.code;
	}

	constructor(tunnelLease: TunnelLease, private readonly socketError: SocketError) {
		super();

		this.socketError = cleanSocketError(socketError);
		this.message = `The connection to upstream tunnel ${format.remoteAddress(tunnelLease)} `
			+ 'threw an unexpected exception.';
	}
}
