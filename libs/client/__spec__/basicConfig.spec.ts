// TODO vi-test
// Currently this is just an API example

import { createLocalTunnel } from "../src/index";

const tunnel = await createLocalTunnel({
    port: 4321,
    // host: 'localhost',
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
tunnel.on('pipe-error', (err) => {
	console.error('ERROR', err)
})
tunnel.on('tunnel-error', (err) => {
	console.error('FAIL', err)
})
tunnel.on('tunnel-dead', (reason) => {
	console.error('DEAD', reason)
})
tunnel.on('tunnel-open', () => {
	console.info('Tunnel opened')
});
tunnel.on('tunnel-close', () => {
	console.info('Tunnel closed')
});

console.log(tunnel.url)
console.log(tunnel.password)

await tunnel.open();
// TODO tunnel.selfValidate(), where it fils in the form for you?

await tunnel.close();