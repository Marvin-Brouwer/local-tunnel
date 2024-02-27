import { type TunnelConfig } from "../client/client-config";
import { format } from "../logger";
import { LocalTunnelError } from "./local-tunnel-error";
import { type SocketError, isSocketError, cleanSocketError } from './socket-error';

export abstract class DownstreamTunnelError extends LocalTunnelError {
    public static isDownstreamTunnelError(error: Error): error is DownstreamTunnelError {
        return error.constructor.name == DownstreamTunnelError.name;
    }

    public abstract readonly reason: string
} 

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
            `The Downstream tunnel ${format.localAddress(tunnelConfig)} rejected the connection.` + '\n' +
            `Check whether the service is running and/or your firewall for inbound rules to port ${tunnelConfig.port}`;
    }
}

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