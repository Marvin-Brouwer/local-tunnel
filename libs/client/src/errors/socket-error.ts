export type SocketError = DestroyedSocketError | UnknownSocketError
export const isSocketError = (error: Error): error is SocketError => 
    error.constructor.name === "SocketError"

export const isRejectedCode = (error: SocketError): boolean => 
    ['ECONNRESET', 'ECONNREFUSED'].includes(error.code);

export type DestroyedSocketError = Error & {
	code: string 
    errno: number,
    syscall: "connect" | string,
    address: string,
    port: number
}
export const isDestroyedSocketError = (error: Error): error is DestroyedSocketError => 
     isSocketError(error) && Object.hasOwn(error, 'address') && !Object.hasOwn(error, 'socket')

export type UnknownSocketError = Error & {
	code: string 
	socket: SocketInformation,
}
export type SocketInformation = {
    localAddress: string,
    localPort: number,
    remoteAddress: string,
    remotePort: number,
    remoteFamily: "IPv6" |  "IPv4",
    bytesWritten: number,
    bytesRead: number
}
export const isUnknownSocketError = (error: Error): error is UnknownSocketError => 
    isSocketError(error) && Object.hasOwn(error, 'socket')

    
export const cleanSocketError = <T extends SocketError | Error>(error: T): T => {
    if (import.meta.env.DEV) return error;
    
    error.stack = undefined!;
    if (isSocketError(error)) {
        if (isDestroyedSocketError(error)){
            error.address = undefined!;
            error.port = undefined!;
        } else {
            error.socket = undefined!;
        }
    }
}