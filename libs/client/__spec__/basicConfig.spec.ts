// TODO vi-test
// Currently this is just an API example

import { createLocalTunnelClient } from "../src";

const client = createLocalTunnelClient({
    port: 4321,
    // host: 'localhost',
    // server: {
    //     hostName: ...,
    //     subDomain: ...
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

client.on('request', (method, path) => {
	console.info(method, path)
})
client.on('error', (err) => {
	console.error('ERROR', err)
})
client.on('initialized', (url) => {
	console.info('Tunnel initialized', url)
});
client.on('close', () => {
	console.info('Tunnel closed')
});

const tunnel = await client.listen();

console.log(tunnel.url)
console.log(tunnel.password)
// TODO tunnel.selfValidate(), where it fils in the form for you?

tunnel.close();