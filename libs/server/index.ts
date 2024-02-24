import createServer from 'localtunnel-server/server';
import { type AddressInfo } from 'net';
import debug from './localtunnel-server/node_modules/debug';
import { type Debug } from 'debug';

(debug as Debug).enable([
    "*",
    '-koa-router',
    '-koa:application',
].join(', '));

const server = createServer({
    max_tcp_sockets: 10,
    secure: false,
    domain: 'localtunnel-dev',
});

server.listen(80, '127.0.0.1', () => {
    console.info('server listening on port: %d', (server.address() as AddressInfo).port);
});

process.on('SIGINT', () => {
    process.exit();
});

process.on('SIGTERM', () => {
    process.exit();
});

process.on('uncaughtException', (err) => {
    console.error(err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(reason);
});

