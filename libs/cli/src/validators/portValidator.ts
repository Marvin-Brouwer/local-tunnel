import { InvalidArgumentError } from 'commander';

export function validatePort(value: string) {
    
    const parsedValue = parseInt(value, 10);
    if (isNaN(parsedValue)) throw new InvalidArgumentError(`Value is not a number.`);
    
    return parsedValue;
}