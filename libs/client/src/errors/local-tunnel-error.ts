/**
 * A simple base class for all {@link Error}s thrown by `@local-tunnel/*`.  
 * It contains a static `isLocalTunnelError` check to determine whether the error is thrown by this library.  
 */
export abstract class LocalTunnelError extends Error {

     /** @inheritdoc */
    public get name() {
        return this.constructor.name;
    }

    /**
     * Simple check to verify an {@link Error} is one extending {@link LocalTunnelError}
     */
    public static isLocalTunnelError(error: Error): error is LocalTunnelError {
        return error.constructor.name == LocalTunnelError.name;
    }
} 