/* eslint-disable import/no-extraneous-dependencies */

import path from 'path';

import { defineConfig } from 'vite';
import { EsLinter, linterPlugin } from 'vite-plugin-linter';

import packageConfig from './package.json' assert { type: 'json' };
import serveDummy from './plugins/dummy-server';

const isDev = process.argv.join(' ').includes('--mode development');
const entry = path.resolve(__dirname, 'src/index.ts');
const packageNameDefinition = packageConfig.name.split('/');
const packageName = packageNameDefinition[1];
const outputDir = 'lib';

export default defineConfig((configEnv) => ({
	plugins: [
		linterPlugin({
			include: [
				path.resolve(__dirname, './src/**/*.ts'),
				path.resolve(__filename),
			],
			linters: [
				new EsLinter({
					configEnv: {
						...configEnv,
						command: isDev ? 'serve' : 'build',
						mode: isDev ? 'development' : 'production',
					},
					serveOptions: {
						clearCacheOnStart: true,
						fix: false,
					},
					buildOptions: {
						useEslintrc: true,
						fix: false,
					},
				}),
			],
			build: {
				includeMode: 'filesInFolder',
			},
		}),
		serveDummy({
			configEnv: {
				...configEnv,
				command: isDev ? 'serve' : 'build',
				mode: isDev ? 'development' : 'production',
			},
			port: 8080,
		}),
	],
	// We need the exceptions to not mangle their names
	esbuild: {
		minifyIdentifiers: false,
		keepNames: true,
	},
	build: {
		minify: !isDev,
		target: ['ESNext'],
		outDir: outputDir,
		sourcemap: true,
		// Making ssr removes the need for almost all the polyfills
		ssr: true,
		rollupOptions: {
			external: [
				'@local-tunnel/client',
				'chalk',
				/^node:/,
			],
			treeshake: true,
			output: {
				compact: !isDev,
				indent: isDev,
				inlineDynamicImports: true,
				banner: '#!/usr/bin/env node \n\n',
			},
		},
		lib: {
			formats: ['cjs'],
			entry,
			name: packageName,
			fileName: () => 'lt.js',
		},
	},
}));
