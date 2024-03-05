/* eslint-disable import/no-import-module-exports */

import { program } from 'commander';

import { mapHttpArgument, registerHttp } from './commands/http';
import { mapHttpsArgument, registerHttps } from './commands/https';
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
 * Since we support dlx, global install, and normal dependency install,
 * we reflect back the command used in the help sceen.
*/
const getName = () => {
	// TODO: Remove once tested
	const executionPath = new URL(import.meta.url).pathname.toLowerCase();
	// eslint-disable-next-line
	console.log(executionPath);
	if (isNpmDlx(executionPath)) return `npx ${packageConfig.name}`;
	if (isPnpmDlx(executionPath)) return `pnpm dlx ${packageConfig.name}`;
	if (isYarnDlx(executionPath)) return `yarn dlx ${packageConfig.name}`;

	return 'lt';
};

program
	.name(getName())
	.description(packageConfig.description)
	.allowExcessArguments(false)
	.allowUnknownOption(false)
	.helpCommand(true)
	.helpOption(false);

// No top level async allowed for commonJs
Promise.resolve()
	.then(() => registerHttp(program))
	.then(() => registerHttps(program))
/**
     * This function exists to make the cli framework distinguish between http and https,
     * Without having to compromise on typing urls
     */
	.then(() => program.parse(process.argv
		.flatMap(mapHttpsArgument)
		.flatMap(mapHttpArgument)));
