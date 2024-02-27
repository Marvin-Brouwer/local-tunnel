import { isDestroyedSocketError, isSocketError } from "./socket-error";

export abstract class LocalTunnelError extends Error {
    public get name() {
        return this.constructor.name;
    }
    public static isLocalTunnelError(error: Error): error is LocalTunnelError {
        return error.constructor.name == LocalTunnelError.name;
    }
} 