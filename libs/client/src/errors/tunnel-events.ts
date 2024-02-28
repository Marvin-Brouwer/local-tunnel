import { type UpstreamTunnelError } from "./upstream-tunnel-errors"
import { type ProxyTunnelError } from "./proxy-tunnel-error"
import { type DownstreamTunnelError } from "./downstream-tunnel-errors"

/**
 * Event listener options for the `@local-tunnel/client`
 */
export type TunnelEventListener<T> = 
    & TunnelOpenHandler<T> 
    & TunnelCloseHandler<T>
    & UpstreamErrorHandler<T>
    & ProxyErrorHandler<T>
    & DownstreamErrorHandler<T>
    & TunnelRequestHandler<T>

/**
 * Event emitter options for the `@local-tunnel/client`
 */
export type TunnelEventEmitter = {
    on: TunnelEventListener<TunnelEventEmitter>,
    emit: 
        & TunnelOpenEmitter<TunnelEventEmitter> 
        & TunnelCloseEmitter<TunnelEventEmitter>
        & UpstreamErrorEmitter<TunnelEventEmitter>
        & ProxyErrorEmitter<TunnelEventEmitter>
        & DownstreamErrorEmitter<TunnelEventEmitter>
        & TunnelRequestEmitter<TunnelEventEmitter>
}


type UpstreamErrorEmitter<T> = (eventName: 'upstream-error', error: UpstreamTunnelError) => T
type UpstreamErrorHandler<T> = (eventName: 'upstream-error', listener: (error: UpstreamTunnelError) => void) => T

type ProxyErrorEmitter<T> = (eventName: 'proxy-error', error: ProxyTunnelError) => T
type ProxyErrorHandler<T> = (eventName: 'proxy-error', listener: (error: ProxyTunnelError) => void) => T

type DownstreamErrorEmitter<T> = (eventName: 'downstream-error', error: DownstreamTunnelError) => T
type DownstreamErrorHandler<T> = (eventName: 'downstream-error', listener: (error: DownstreamTunnelError) => void) => T

type TunnelOpenEmitter<T> = (eventName: 'tunnel-open') => T
type TunnelOpenHandler<T> = (eventName: 'tunnel-open', listener: () => void) => T
type TunnelCloseEmitter<T> = (eventName: 'tunnel-close') => T
type TunnelCloseHandler<T> = (eventName: 'tunnel-close', listener: () => void) => T

type TunnelRequestEmitter<T> = (eventName: 'pipe-request', method: string, path: string) => T
type TunnelRequestHandler<T> = (eventName: 'pipe-request', listener: (method: string, path: string) => void) => T