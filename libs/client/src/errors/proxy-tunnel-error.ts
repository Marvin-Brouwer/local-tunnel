import { AddressInfo } from "net";
import { format } from "../logger";
import { LocalTunnelError } from "./local-tunnel-error";
import { cleanSocketError, type SocketError } from "./socket-error";

/**
 * Base error indicating something failed in the connection to the `proxy` tunnel connection.  
 * Meaning, the the `@local-tunnel/client` host, responsible liaising between the `upstream` and `downstream` connection.  
 *   
 * **Note:** Since the `proxy` is hosted on your local environment, these errors should be scarce.  
 * If you encounter any, please report a bug at {@link https://github.com/Marvin-Brouwer/local-tunnel/issues}
 */
export abstract class ProxyTunnelError extends LocalTunnelError {
    public static isProxyTunnelError(error: Error): error is ProxyTunnelError {
        return error.constructor.name == ProxyTunnelError.name;
    }

    public abstract readonly reason: string
} 

/**
 * Error indicating the `proxy` tunnel rejected connection.   
 *   
 * **Note:** Since the `proxy` is hosted on your local environment, these errors should be scarce.  
 * If you encounter any, please report a bug at {@link https://github.com/Marvin-Brouwer/local-tunnel/issues}
 */
export class ProxyTunnelRejectedError extends LocalTunnelError {
    public static isProxyTunnelRejectedError(error: Error): error is ProxyTunnelRejectedError {
        return error.constructor.name == ProxyTunnelRejectedError.name;
    }

    public get reason() {
        return this.socketError.code;
    }
    
    constructor(address: AddressInfo, private readonly socketError: SocketError) {
        super();
        
        this.socketError = cleanSocketError(socketError);
        this.message = 
            `The Proxy tunnel ${format.address(address)} rejected the connection.` + '\n' +
            `Check your firewall for outbound rules to the tunnel or inbound rules for port ${address.port}`;
    }
}

/**
 * Error indicating the `proxy` tunnel or host had an unexpected error.   
 *   
 * **Note:** We like to keep the unexpected errors to a minimum.  
 * If you encounter any, please report a bug at {@link https://github.com/Marvin-Brouwer/local-tunnel/issues}
 */
export class UnknownProxyTunnelError extends LocalTunnelError {
    public static isUnknownProxyTunnelError(error: Error): error is UnknownProxyTunnelError {
        return error.constructor.name == UnknownProxyTunnelError.name;
    }

    public get reason() {
        return this.socketError.code;
    }
    
    constructor(address: AddressInfo, private readonly socketError: SocketError) {
        super();
        
        this.socketError = cleanSocketError(socketError);
        this.message = 
            `The connection to Proxy tunnel ${format.address(address)} threw an unexpected exception.`;
    }
}