import { EventEmitter } from "node:stream"

export type TunnelEventListener<T> = 
    & TunnelOpenHandler<T> 
    & TunnelCloseHandler<T>
    & TunnelErrorHandler<T>
    & TunnelDeadHandler<T>
    & PipeRequestHandler<T>
    & PipeErrorHandler<T>

export type TunnelEventEmitter = EventEmitter & {
    on: TunnelEventListener<TunnelEventEmitter>,
    emit: 
        & TunnelOpenEmitter<TunnelEventEmitter> 
        & TunnelCloseEmitter<TunnelEventEmitter>
        & TunnelErrorEmitter<TunnelEventEmitter>
        & TunnelDeadEmitter<TunnelEventEmitter>
        & PipeRequestEmitter<TunnelEventEmitter>
        & PipeErrorEmitter<TunnelEventEmitter>
}

type TunnelOpenHandler<T> = (eventName: 'tunnel-open', listener: () => void) => T
type TunnelCloseHandler<T> = (eventName: 'tunnel-close', listener: () => void) => T
type TunnelErrorHandler<T> = (eventName: 'upstream-error', listener: (error: Error) => void) => T
type TunnelDeadHandler<T> = (eventName: 'tunnel-dead', listener: (reason: string) => void) => T
type PipeRequestHandler<T> = (eventName: 'pipe-request', listener: (method: string, url: URL) => void) => T
type PipeErrorHandler<T> = (eventName: 'pipe-error', listener: (error: Error) => void) => T

type TunnelOpenEmitter<T> = (eventName: 'tunnel-open') => T
type TunnelCloseEmitter<T> = (eventName: 'tunnel-close') => T
type TunnelErrorEmitter<T> = (eventName: 'upstream-error', error: Error) => T
type TunnelDeadEmitter<T> = (eventName: 'tunnel-dead', reason: string) => T
type PipeRequestEmitter<T> = (eventName: 'pipe-request', method: string, url: URL) => T
type PipeErrorEmitter<T> = (eventName: 'pipe-error', error: Error) => T