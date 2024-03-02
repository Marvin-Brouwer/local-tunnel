/* eslint-disable import/no-extraneous-dependencies */

import path from 'node:path';

import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { EsLinter, linterPlugin } from 'vite-plugin-linter';

import packageConfig from './package.json' assert { type: 'json' };

const isDev = process.argv.join(' ').includes('--mode development');
const lintFix = process.argv.includes('--lint-fix');
const srcFolder = path.resolve(__dirname, 'src');
const entry = path.resolve(srcFolder, 'index.ts');
const packageNameDefinition = packageConfig.name.split('/');
const packageName = packageNameDefinition[1];
const outputDir = 'dist';

export default defineConfig((configEnv) => ({
	plugins: [
		linterPlugin({
			include: [
				path.resolve(__dirname, './src/**/*.ts'),
				path.resolve(__filename),
			],
			linters: [
				new EsLinter({
					configEnv,
					serveOptions: {
						clearCacheOnStart: true,
						fix: lintFix,
					},
					buildOptions: {
						useEslintrc: true,
						fix: lintFix,
					},
				}),
			],
			build: {
				includeMode: 'filesInFolder',
			},
		}),
		// nodePolyfills({
		// 	include: [
		// 		'stream',
		// 	],
		// 	protocolImports: true,
		// }),
		dts({
			entryRoot: srcFolder,
			outDir: path.join(outputDir, 'types'),
		}),
	],
	// We need the exceptions to not mangle their names
	esbuild: {
		minifyIdentifiers: false,
		keepNames: true,
	},
	build: {
		// https://github.com/vitejs/vite/issues/13926#issuecomment-1708536097
		minify: !isDev,
		target: ['ESNext'],
		outDir: outputDir,
		sourcemap: true,
		// This is to prevent issues with workspace files reading `*.d.ts` files.
		emptyOutDir: !isDev,
		rollupOptions: {
			external: [
				/^node:/,
			],
			output: {
				compact: !isDev,
				indent: isDev,
			},
		},
		lib: {
			formats: ['cjs', 'es', 'umd'],
			entry,
			name: packageName,
			fileName: 'index',
		},
	},
}));
