import { program } from 'commander';

import { mapHttpArgument, registerHttp } from './commands/http';
import { mapHttpsArgument, registerHttps } from './commands/https';
import packageConfig from '../package.json' assert { type: 'json' };

const isNpmDlx = (commandArgs: string[]) => (
	commandArgs.some((arg) => arg === 'npx')
);
const isPnpmDlx = (commandArgs: string[]) => (
	commandArgs.some((arg) => arg === 'pnpm') && commandArgs.some((arg) => arg === 'dlx')
);
const isYarnDlx = (commandArgs: string[]) => (
	commandArgs.some((arg) => arg === 'yarn') && commandArgs.some((arg) => arg === 'dlx')
);

/**
 * Since we support dlx, global install, and normal dependency install,
 * we reflect back the command used in the help sceen.
*/
const getName = () => {
	const commandArgs = process.argv.slice(0, 3);
	// TODO: Remove once tested
	// eslint-disable-next-line
	console.log(commandArgs)
	if (isNpmDlx(commandArgs)) return `npx ${packageConfig.name}`;
	if (isPnpmDlx(commandArgs)) return `pnpm dlx ${packageConfig.name}`;
	if (isYarnDlx(commandArgs)) return `yarn dlx ${packageConfig.name}`;

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
