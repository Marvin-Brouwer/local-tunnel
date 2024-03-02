import { program } from 'commander';

import { mapHttpArgument, registerHttp } from './commands/http';
import { mapHttpsArgument, registerHttps } from './commands/https';
import packageConfig from '../package.json' assert { type: 'json' };

program
	.name('lt')
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
