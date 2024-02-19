// TODO vi-test
// Currently this is just an API example

import { createLocalTunnelClient } from "../src";

const client = createLocalTunnelClient({
    port: 4321,
    // host: 'localhost',
})
// .withCustomHost({ ... });
.withHttps({ 
    skipCertificateValidation: true,
    // cert: { ... }
})
// .withDomain('name', true);

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

tunnel.close();