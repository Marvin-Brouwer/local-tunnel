import { parseUrl } from '@local-tunnel/client';
import { InvalidArgumentError } from 'commander';

export function validateUrl(value: string) {
	const result = parseUrl(value);
	if (result.success) {
		return result.data;
	}
	throw new InvalidArgumentError(result.error.errors[0].message);
}
