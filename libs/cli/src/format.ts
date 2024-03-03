import chalk from 'chalk';

export const link = (url: URL | string) => chalk.underline.blueBright(url.toString());

export const error = (err: Error) => `${chalk.bold.red(err.name)}:\n  ${chalk.italic(`"${err.message}"`)}`;

export const timestamp = (dateTime: Date) => chalk.green(dateTime.toISOString());

export const password = (pass: string) => chalk.yellow.bold.italic(`'${pass}'`);
