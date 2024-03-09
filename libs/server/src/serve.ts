// @ts-ignore
import createServer from 'localtunnel-server/server'; // eslint-disable-line 7016
import { type AddressInfo } from 'net';
import debug from 'debug';
import { type Debug } from 'debug';

(debug as Debug).enable([
    "*",
    '-koa-router',
    '-koa:application',
].join(', '));

export const serve = () => {
    const server = createServer({
        max_tcp_sockets: 10,
        secure: false,
        domain: 'localtunnel-dev',
    });

    server.listen(80, '127.0.0.1', () => {
        console.info('server listening on port: %d', (server.address() as AddressInfo).port);
    });

    process.on('uncaughtException', (err) => {
        console.error(err);
    });

    process.on('unhandledRejection', (reason, _promise) => {
        console.error(reason);
    });
};