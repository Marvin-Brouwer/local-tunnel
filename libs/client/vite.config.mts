/* eslint-disable import/no-extraneous-dependencies */

import path from 'node:path';

import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import eslintPlugin from 'vite-plugin-eslint';
import requireTransform from 'vite-plugin-require-transform';

import packageConfig from './package.json' assert { type: 'json' };

const isDev = process.argv.join(' ').includes('--mode development');
const srcFolder = path.resolve(__dirname, 'src');
const entry = path.resolve(srcFolder, 'index.ts');
const packageNameDefinition = packageConfig.name.split('/');
const packageName = packageNameDefinition[1];
const outputDir = 'dist';

export default defineConfig({
	plugins: [
		isDev ? requireTransform({}) : undefined,
		{
			...eslintPlugin({
				failOnWarning: false,
				failOnError: !isDev,
				useEslintrc: true,
				fix: isDev,
				errorOnUnmatchedPattern: !isDev,
				globInputPaths: true,
				overrideConfigFile: path.resolve(__dirname, '../../.eslintrc.js')
			}),
			enforce: 'post'
		},
		dts({
			entryRoot: srcFolder,
			outDir: path.join(outputDir, 'types')
		}),
	],
	// We need the exceptions to not mangle their names
	esbuild: {
		minifyIdentifiers: false,
		keepNames: true
	},
	build: {
		// https://github.com/vitejs/vite/issues/13926#issuecomment-1708536097
		minify: !isDev,
		target: ['ESNext',],
		outDir: outputDir,
		sourcemap: true,
		// This is to prevent issues with workspace files reading `*.d.ts` files.
		emptyOutDir: !isDev,
		rollupOptions: {
			external: [
				/^node:/,
				...(isDev ? ['debug',] : []),
				'zod',
			],
			treeshake: !isDev,
			output: {
				esModule: true,
				hashCharacters: 'hex',
				compact: !isDev,
				indent: isDev,
				inlineDynamicImports: true,
				globals: (name) => name
			}
		},
		lib: {
			formats: ['cjs', 'es', 'umd',],
			entry,
			name: packageName,
			fileName: 'index'
		}
	}
});
