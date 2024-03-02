import { access, constants, statSync } from 'node:fs';
import path from 'node:path';

import { type CertificateConfig } from '@local-tunnel/client';
import { InvalidArgumentError } from 'commander';

function validatePath(name: string, value: string) {
	const absolutePath = path.isAbsolute(value)
		? value
		: path.resolve(process.cwd(), value);

	access(absolutePath, constants.R_OK, () => {
		throw new InvalidArgumentError(`File for  ${name} "${absolutePath}" was not found.`);
	});

	const fileStats = statSync(absolutePath);
	if (!fileStats.isFile()) {
		throw new InvalidArgumentError(`Path for ${name} "${absolutePath}" does not resolve to a file.`);
	}

	return value;
}

export function validateCertificatePaths(value: string): CertificateConfig {
	const values = value.split(' ');

	if (values.length === 1) { throw new InvalidArgumentError('Missing \'key-path\' in arguments.'); }
	if (values.length > 3) { throw new InvalidArgumentError('Too many arguments.'); }

	const [pemPath, keyPath] = values;
	const absolutePemPath = validatePath('pem-path', pemPath.trim());
	const absoluteKeyPath = validatePath('key-path', keyPath.trim());
	const absoluteCaPath: string = values.length !== 3 ? undefined : validatePath('ca-path', values[2].trim());

	return {
		pemLocation: absolutePemPath,
		keyLocation: absoluteKeyPath,
		certificateAuthorityLocation: absoluteCaPath,
	};
}
