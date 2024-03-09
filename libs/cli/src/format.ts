import chalk from 'chalk';

export const link = (url: URL | string) => chalk.underline.blueBright(url.toString());

export const error = (err: Error) => (
	// eslint-disable-next-line prefer-template
	`${chalk.bold.red(err.name)}:\n  ${chalk.italic(`"${err.message}"`)}`
	// eslint-disable-next-line no-constant-condition
	+ (import.meta.env.DEV ? `\n${chalk.italic.gray(err.stack)}` : '')
);
export const warning = (warn: Error) => (
	// eslint-disable-next-line prefer-template
	`${chalk.bold.yellowBright(warn.name)}:\n  ${chalk.yellow.italic(`"${warn.message}"`)}`
	// eslint-disable-next-line no-constant-condition
	+ (import.meta.env.DEV ? `\n${chalk.italic.gray(warn.stack)}` : '')
);

export const timestamp = (dateTime: Date) => chalk.green(dateTime.toISOString());

export const password = (pass: string) => chalk.yellow.bold.italic(`'${pass}'`);
