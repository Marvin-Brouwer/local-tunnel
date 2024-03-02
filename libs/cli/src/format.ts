export default async () => {
	// The direct import of chalk didn't work, so we make due
	// todo maybe externalizing it?
	const { default: chalk } = await import('chalk');

	return {
		link: (url: URL | string) => chalk.underline.blueBright(url.toString()),
		error: (error: Error) => `${chalk.bold.red(error.name)}:\n  ${chalk.italic(`"${error.message}"`)}`,
		timestamp: (dateTime: Date) => chalk.green(dateTime.toISOString()),
		password: (password: string) => chalk.yellow.bold.italic(`'${password}'`),
		italic: (value: string) => chalk.italic(value),
	};
};
