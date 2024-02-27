import { AddressInfo } from "net";
import { format } from "../logger";
import { LocalTunnelError } from "./local-tunnel-error";
import { cleanSocketError, type SocketError } from "./socket-error";

export abstract class ProxyTunnelError extends LocalTunnelError {
    public static isProxyTunnelError(error: Error): error is ProxyTunnelError {
        return error.constructor.name == ProxyTunnelError.name;
    }

    public abstract readonly reason: string
} 

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