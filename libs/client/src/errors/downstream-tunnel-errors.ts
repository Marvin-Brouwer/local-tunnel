import { type TunnelConfig } from "../client/client-config";
import { format } from "../logger";
import { LocalTunnelError } from "./local-tunnel-error";
import { type SocketError, isSocketError, cleanSocketError } from './socket-error';

/**
 * Base error indicating something failed in the connection to the `downstream` tunnel connection.  
 * Meaning, the tunnel you registered to expose to the `local-tunnel` server.
 */
export abstract class DownstreamTunnelError extends LocalTunnelError {
    public static isDownstreamTunnelError(error: Error): error is DownstreamTunnelError {
        return error.constructor.name == DownstreamTunnelError.name;
    }

    public abstract readonly reason: string
} 

/**
 * Error indicating the `downstream` tunnel rejected connection.   
 *   
 * This is most likely due to the local service restarting or not running at all.  
 * If this is not the case, you should check your firewall settings.
 */
export class DownstreamTunnelRejectedError extends LocalTunnelError {
    public static isDownstreamTunnelRejectedError(error: Error): error is DownstreamTunnelRejectedError {
        return error.constructor.name == DownstreamTunnelRejectedError.name;
    }

    public get reason() {
        return this.socketError.code;
    }
    
    constructor(tunnelConfig: TunnelConfig, private readonly socketError: SocketError) {
        super();
        
        this.socketError = cleanSocketError(socketError);
        this.message = 
            `The downstream tunnel ${format.localAddress(tunnelConfig)} rejected the connection.` + '\n' +
            `Check whether the service is running and/or check your firewall for inbound rules to port ${tunnelConfig.port}`;
    }
}

/**
 * Error indicating the `downstream` tunnel or host had an unexpected error.   
 *   
 * **Note:** We like to keep the unexpected errors to a minimum.  
 * If you encounter any, please report a bug at {@link https://github.com/Marvin-Brouwer/local-tunnel/issues}
 */
export class UnknownDownstreamTunnelError extends LocalTunnelError {
    public static isUnknownDownstreamTunnelError(error: Error): error is UnknownDownstreamTunnelError {
        return error.constructor.name == UnknownDownstreamTunnelError.name;
    }

    public get reason() {
        if (isSocketError(this.innerError))
            return this.innerError.code;
        return 'UNKNOWN_' + this.innerError.constructor.name;
    }
    
    constructor(tunnelConfig: TunnelConfig, private readonly innerError: SocketError | Error) {
        super();
        
        this.innerError = cleanSocketError(innerError);
        this.message = 
            `The connection to downstream tunnel ${format.localAddress(tunnelConfig)} threw an unexpected exception.`;
    }
}