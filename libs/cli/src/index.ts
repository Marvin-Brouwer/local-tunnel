/* eslint-disable import/no-import-module-exports */

import chalk from 'chalk';
import { program } from 'commander';

import { mapHttpArgument, registerHttp } from './commands/http';
import { mapHttpsArgument, registerHttps } from './commands/https';
import * as format from './format';
import packageConfig from '../package.json' assert { type: 'json' };

const isNpmDlx = (executionPath: string) => (
	// X:\\...\\npm-cache\\_npx\\e3035ddd66a30df3\\node_modules\\@local-tunnel\\cli\\lib\\index.js
	executionPath.includes('npm-cache') && executionPath.includes('_npx')
);
const isPnpmDlx = (executionPath: string) => (
	// X:\\...\\.pnpm-store\\v3\\tmp\\dlx-10592\\node_modules\\@local-tunnel\\cli\\lib\\index.js
	executionPath.includes('.pnpm') && executionPath.includes('tmp') && executionPath.includes('dlx-')
);
const isYarnDlx = (executionPath: string) => (
	// X:\\...\\Yarn\\Berry\\cache\\@local-tunnel-cli-npm-3.0.0-alpha.4-f8c47b2075-8.zip
	// \\node_modules\\@local-tunnel\\cli\\lib\\index.js
	executionPath.includes('yarn') && executionPath.includes('.zip')
);

/**
 * Since we run via dlx,we reflect back the command used in the help sceen.
*/
const getName = () => {
	const executionPath = new URL(import.meta.url).pathname.toLowerCase();

	if (isNpmDlx(executionPath)) {
		// eslint-disable-next-line no-console
		console.log();
		return `npx ${packageConfig.name}`;
	}
	if (isPnpmDlx(executionPath)) {
		// eslint-disable-next-line no-console
		console.log();
		return `pnpm dlx ${packageConfig.name}`;
	}
	if (isYarnDlx(executionPath)) {
		// eslint-disable-next-line no-console
		console.log();
		return `yarn dlx ${packageConfig.name}`;
	}

	return 'lt';
};

const commandName = getName();

program
	.name(commandName)
	.description(packageConfig.description)
	.allowExcessArguments(false)
	.allowUnknownOption(false)
	.helpCommand(true)
	.helpOption(false);

process.on('uncaughtException', (err) => {
	// eslint-disable-next-line no-console
	console.error(format.error(err));
});

// No top level async allowed for commonJs
Promise.resolve()
	.then(() => registerHttp(program, commandName))
	.then(() => registerHttps(program, commandName))
	// eslint-disable-next-line no-console
	.then(() => console.log(chalk.bold(packageConfig.name), chalk.italic(`@${packageConfig.version}`)))
	// eslint-disable-next-line no-console
	.then(() => console.log())
	/**
	 * This function exists to make the cli framework distinguish between http and https,
	 * Without having to compromise on typing urls
	 */
	.then(() => program.parse(process.argv
		.flatMap(mapHttpsArgument)
		.flatMap(mapHttpArgument)));
