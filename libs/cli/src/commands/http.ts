import chalk from 'chalk';
import { type Command } from 'commander';

import {
	applyDefaultOptions, applyEaseOfUseOptions, applyOptions, getBaseOptions, openLocalTunnel,
} from './base';
import { validateUrl } from '../validators/urlValidator';

const applyHttpCommand = applyOptions(
	applyDefaultOptions,
	applyEaseOfUseOptions,
);

async function callHttpCommand(_:unknown, command: Command) {
	const {
		localHost, remoteHost, subdomain, printRequestInfo, openUrlOnConnect,
	} = getBaseOptions(command);

	await openLocalTunnel(printRequestInfo, openUrlOnConnect, {
		localHost,
		server: {
			hostName: remoteHost,
			subdomain,
		},
	});
}

/**
 * This function exists to make the cli framework distinguish between http and https,
 * Without having to compromise on typing urls
 */
export function mapHttpArgument(arg: string) {
	if (arg === 'http' || arg === 'http://' || arg === 'http://<origin>') { return ['http://<origin>']; }

	if (arg.startsWith('http://') && arg.length !== 7) { return ['http://<origin>', '--origin', arg]; }

	return arg;
}

export async function registerHttp(program: Command) {
	applyHttpCommand(program
		.command('http')
		.name('http://<origin>')
		.configureHelp({
			commandDescription() {
				return 'Open a local-tunnel to a http endpoint \n\n'
				// Fake the origin argument help text
                 + 'Arguments:\n'
                + '  http://<origin>             Local origin url, including port when applicable. \n'
                + '                              E.g. "http://localhost:8080"';
			},
		})
		.description(
			`Open a local-tunnel to a http endpoint ${chalk.italic('(lt help http)')}`,
		)
		.addOption(program
			.createOption('--origin <origin>')
			.makeOptionMandatory()
			.argParser(validateUrl)
			.hideHelp(true))
		.action(callHttpCommand));
}
