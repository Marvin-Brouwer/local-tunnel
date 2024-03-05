/* eslint-disable no-console */
// This file reads better from top to bottom
/* eslint-disable no-use-before-define */

import cp from 'node:child_process';

import { type CertificateConfig, type TunnelConfig, createLocalTunnel } from '@local-tunnel/client';
import { type Command } from 'commander';

import * as format from '../format';
import { validateCertificatePaths } from '../validators/pathValidator';

// eslint-disable-next-line no-unused-vars
export function applyOptions(...applications: ((commandApplication: Command) => Command)[]) {
	return function applyConfiguredOptions(command: Command) {
		return applications.reduce((prev, application) => application(prev), command);
	};
}

export const applyDefaultOptions = (command: Command) => command
	.option(
		'-h, --remote-host <string>', 'Upstream server\'s hostname, server providing forwarding', 'localtunnel.me'
	)
	.option('-s, --subdomain <string>', 'Request a subdomain, if left out or unavailable will return a random domain');

export const applyHttpsOptions = (command: Command) => command
	.option<CertificateConfig>(
		'--local-cert "<pem-path> <key-path> [ca-path]"',
		'Path to certificate files for local HTTPS server',
		validateCertificatePaths
	)
	.option(
		'--allow-invalid-cert, --skip-cert-val',
		'Disable certificate checks for your local HTTPS server (ignore cert/key/ca options)',
		false
	);

export const applyEaseOfUseOptions = (command: Command) => command
	.option(
		'--print-requests', 'Print basic request info', false
	)
	.option(
		'-o, --open-url', 'Opens the tunnel URL in your browser, on connection', false
	);

export const getBaseOptions = (command: Command) => {
	const localHost = command.optsWithGlobals().origin as URL;
	const remoteHost = command.optsWithGlobals().remoteHost as string;
	const subdomain = command.optsWithGlobals().subdomain as string | undefined;
	const printRequestInfo = command.optsWithGlobals().printRequests as boolean;
	const openUrlOnConnect = command.optsWithGlobals().openUrl as boolean;

	return {
		localHost,
		remoteHost,
		subdomain,
		printRequestInfo,
		openUrlOnConnect
	};
};

export async function openLocalTunnel(
	printRequestInfo: boolean, openUrlOnConnect: boolean, config: TunnelConfig
) {
	const tunnel = await createLocalTunnel(config)
		.catch((err) => {
			console.error(format.error(err));
			console.error();
			process.exit(-1);
		});

	if (printRequestInfo) {
		tunnel.on('pipe-request', (method, path) => {
			if (method === 'OPTIONS' && path === '/?keepalive') return;

			const utcDate = new Date(Date.now());
			console.info(
				format.timestamp(utcDate), method, path
			);
		});
	}

	tunnel.on('upstream-error', (err) => {
		console.error(format.error(err));
		console.error();
		close(-2);
	});
	tunnel.on('proxy-error', (err) => {
		console.error(format.error(err));
		console.error();
		close(-3);
	});
	tunnel.on('downstream-error', (err) => {
		console.error(format.error(err));
	});

	console.info(`tunneling ${format.link(tunnel.localAddress)} <> ${format.link(tunnel.url)}`);
	if (tunnel.password) console.info(`password: ${format.password(tunnel.password)}`);

	/**
     * `cachedUrl` is set when using a proxy server that support resource caching.
     * This URL generally remains available after the tunnel itself has closed.
     * @see https://github.com/localtunnel/localtunnel/pull/319#discussion_r319846289
     */
	if (tunnel.cachedUrl) {
		console.info('cachedUrl:', format.link(tunnel.cachedUrl));
	}

	await tunnel.open();
	console.info();

	if (openUrlOnConnect) {
		console.info(`Opening ${format.link(tunnel.url)} in default browser...`);
		openUrl(tunnel.url.toString());
		console.info();
	}

	console.info('SIGTERM or close the cli to close the socket.');
	console.info();
	process.on('SIGABRT', close);
	process.on('SIGKILL', close);
	process.on('SIGBREAK', close);
	process.on('SIGINT', close);
	process.on('SIGQUIT', close);
	process.on('SIGTERM', close);

	tunnel.on('tunnel-close', close);

	async function close(code = 0) {
		if (code !== -1) {
			console.warn('Closing tunnel...');
			console.warn();
		}
		if (tunnel.status !== 'closed' && tunnel.status !== 'closing') { await tunnel.close(); }

		process.exit(code);
	}
}

/** https://stackoverflow.com/a/49013356/2319865 */
function openUrl(url: string) {
	const startCommand = () => {
		if (process.platform === 'darwin') return 'open';
		if (process.platform === 'win32') return 'start';
		return 'xdg-open';
	};

	cp.exec(`${startCommand()} ${url}`);
}
