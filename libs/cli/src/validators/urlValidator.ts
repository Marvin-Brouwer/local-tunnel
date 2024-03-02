import { InvalidArgumentError } from 'commander';

export function validateUrl(value: string) {
	let url: URL;
	try {
		url = new URL(value);
	} catch (err) {
		throw new InvalidArgumentError(`Value is not a valid origin url. ${err.message}`);
	}

	if (url.pathname !== '/') throw new InvalidArgumentError('Value contains a path, this is not supported.');
	if (url.search !== '') throw new InvalidArgumentError('Value contains a query, this is not supported.');
	if (url.hash !== '') throw new InvalidArgumentError('Value contains a hash, this is not supported.');

	return url;
}
