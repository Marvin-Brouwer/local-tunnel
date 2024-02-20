import packageConfig from './package.json' assert { type: 'json' };
import path from 'path';
import { defineConfig } from 'vite';

const isDev = process.argv.join(' ').includes('--mode development');
const entry = path.resolve(__dirname, 'src/index.ts');
const packageNameDefinition = packageConfig.name.split('/');
const packageName = packageNameDefinition[1];
const outputDir = 'lib';

export default defineConfig({
	build: {
		minify: !isDev,
		target: ['ESNext'],
		outDir: outputDir,
		sourcemap: true,
        rollupOptions: {
			output: {
				compact: !isDev,
				indent: isDev
			}
		},
		lib: {
            formats: ['iife'],
			entry,
			name: packageName,
			fileName: () => 'lt.js'
		}
	}
});