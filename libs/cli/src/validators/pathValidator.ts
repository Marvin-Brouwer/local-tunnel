import { InvalidArgumentError } from 'commander';
import { statSync, access, constants } from 'node:fs';
import path from 'node:path';

export function validatePath(value: string) {
    
    const absolutePath = path.isAbsolute(value)
        ? value
        : path.resolve(process.cwd(), value);

    access(absolutePath, constants.R_OK, () => {
        throw new InvalidArgumentError(`File "${absolutePath}" was not found.`);
    });
    
    const fileStats = statSync(absolutePath);
    if (!fileStats.isFile()) throw new InvalidArgumentError(`File "${absolutePath}" is not a file.`);
    
    return value;
}