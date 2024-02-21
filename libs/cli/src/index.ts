import packageConfig from '../package.json' assert { type: 'json' };
import cp from 'node:child_process';

import { program, InvalidArgumentError, Command } from 'commander';
import { createLocalTunnel } from '@local-tunnel/client';

program
  .name(packageConfig.name)
  .description(packageConfig.description)
  .version(packageConfig.version);

// TODO split into http and https
program
    .requiredOption<number>('-p, --local-port <number>', 'Local HTTP server port', validatePort)
    .option('-l, --local-host <string>', 'Local HTTP hostname', 'localhost')
    .option('-h, --remote-host <string>', 'Upstream server\'s hostname, server providing forwarding', 'localtunnel.me')
    .option('-s, --subdomain <string>', 'Request a subdomain, if left out or unavailable will return a random domain')

    .option<string>('--local-cert <string>', 'Path to certificate PEM file for local HTTPS server', validatePathExist)
    .option<string>('--local-key <string>', 'Path to certificate key file for local HTTPS server', validatePathExist)
    .option<string>('--local-ca <string>', 'Path to certificate authority file for self-signed certificates', validatePathExist)

    .option('--local-https', 'Tunnel traffic to a local HTTPS server', false)
    .option('--allow-invalid-cert, --skip-cert-val', 'Disable certificate checks for your local HTTPS server (ignore cert/key/ca options)', false)
    .option('--print-requests', 'Print basic request info', false)
    .option('-o, --open-url', 'Opens the tunnel URL in your browser, on connection', false)

    .action(startTunnel);

function validatePort(value: string) {
    
    const parsedValue = parseInt(value, 10);
    if (isNaN(parsedValue)) throw new InvalidArgumentError('Not a number.');
    
    return parsedValue;
}
function validatePathExist(value: string) {
    
    // TODO check path exists
    if (false) throw new InvalidArgumentError('Not a number.');
    
    return value;
}

async function startTunnel(_: never, command: Command, x, y, z){

    const port = command.optsWithGlobals().localPort as number;
    const host = command.optsWithGlobals().localHost as string;
    const remoteHost = command.optsWithGlobals().remoteHost as string;
    const subdomain = command.optsWithGlobals().subdomain as string | undefined;
    const localCert = command.optsWithGlobals().localCert as string | undefined;
    const localKey = command.optsWithGlobals().localKey as string | undefined;
    const localCa = command.optsWithGlobals().localCa as string | undefined;
    const localHttps = command.optsWithGlobals().localHttps as boolean;
    const skipCertificateValidation = command.optsWithGlobals().skipCertVal as boolean;
    const printRequestInfo = command.optsWithGlobals().printRequests as boolean;
    const openUrlOnConnect = command.optsWithGlobals().openUrl as boolean;

    const cert = (localCert === undefined || localKey === undefined)
        ? undefined
        : {
            pemLocation: localCert,
            keyLocation: localKey,
            certificateAuthorityLocation: localCa
        };
    const https = !localHttps 
        ? undefined 
        : {
            skipCertificateValidation,
            cert
        };
    const tunnel = await createLocalTunnel({
        port,
        host,
        server: {
            hostName: remoteHost,
            subdomain
        },
        https
    })
    
    if (printRequestInfo) {
        tunnel.on('pipe-request', (method, path) => {
            console.info(new Date().toString(), method, path)
        })
    }

    tunnel.on('pipe-error', (err) => {
        console.error('ERROR', err)
    })
    tunnel.on('tunnel-error', (err) => {
        console.error('ERROR', err)
    })

    console.info(`tunneling ${host}:${port} <> ${tunnel.url}`);
    if (tunnel.password) console.info(`password: ${tunnel.password}`);

    /**
     * `cachedUrl` is set when using a proxy server that support resource caching.
     * This URL generally remains available after the tunnel itself has closed.
     * @see https://github.com/localtunnel/localtunnel/pull/319#discussion_r319846289
     */
    if (tunnel.cachedUrl) {
      console.info('cachedUrl', tunnel.cachedUrl);
    }
    
    await tunnel.open();
    
    if (openUrlOnConnect) {
        console.info(`Opening ${tunnel.url} in default browser...`);
        openUrl(tunnel.url);
    }
    

    console.info('SIGTERM or close the cli to close the socket.')
    process.on('SIGABRT', close);
    process.on('SIGKILL', close);
    process.on('SIGBREAK', close);
    process.on('SIGINT', close);
    process.on('SIGQUIT', close);
    process.on('SIGTERM', close);

    async function close() {
        
        console.warn('Closing tunnel...')
        await tunnel.close();
    }
}

/** https://stackoverflow.com/a/49013356/2319865 */
function openUrl(url: string) {
	const start = (process.platform == 'darwin'
		? 'open': process.platform == 'win32'
		? 'start': 'xdg-open');
	cp.exec(start + ' ' + url);
}

program.parse(process.argv);