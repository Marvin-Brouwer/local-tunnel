// TODO vi-test
// Currently this is just an API example

import { createLocalTunnel } from "../src/index";

const tunnel = await createLocalTunnel({
    localHost: new URL('https://localhost:4321'),
    // server: {
    //     hostName: ...,
    //     subdomain: ...
    // },
    https: {
        skipCertificateValidation: true,
        // cert: {
        //     pemLocation: ...,
        //     keyLocation: ...,
        //     certificateAuthorityLocation: ...
        // }
    }
})

tunnel.on('pipe-request', (method, path) => {
	console.info(method, path)
})

tunnel.on('upstream-error', (err) => {
    console.error((err))
})
tunnel.on('proxy-error', (err) => {
    console.error((err))
})
tunnel.on('downstream-error', (err) => {
    console.error((err))
})
tunnel.on('tunnel-open', () => {
	console.info('Tunnel opened')
});
tunnel.on('tunnel-close', () => {
	console.info('Tunnel closed')
});

console.info(tunnel.url)
console.info(tunnel.password)

await tunnel.open();

console.info('Tunnel connected');

await tunnel.close();

console.info('Tunnel closed');