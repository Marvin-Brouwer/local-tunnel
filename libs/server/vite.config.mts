import packageConfig from './package.json' assert { type: 'json' };
import path from 'path';
import { defineConfig } from 'vite';

const entry = path.resolve(__dirname, 'index.ts');
const packageNameDefinition = packageConfig.name.split('/');
const packageName = packageNameDefinition[1];
const outputDir = 'lib';

export default defineConfig({
	resolve: {
		alias: {
			'debug':  path.resolve(__dirname, 'localtunnel-server', './node_modules/debug/src/index.js'),
			'./localtunnel-server/node_modules/debug':  path.resolve(__dirname, 'localtunnel-server', './node_modules/debug/src/index.js'),
			'koa': path.resolve(__dirname, 'localtunnel-server', './node_modules/koa'),
			'koa-router': path.resolve(__dirname, 'localtunnel-server', './node_modules/koa-router'),
			'tldjs': path.resolve(__dirname, 'localtunnel-server', './node_modules/tldjs'),
			'book': path.resolve(__dirname, 'localtunnel-server', './node_modules/book/logger.js'),
			'human-readable-ids': path.resolve(__dirname, 'localtunnel-server', './node_modules/human-readable-ids/index.js')
		}
	},
	build: {
		ssr: true,
		minify: false,
		target: ['ESNext'],
		outDir: outputDir,
		sourcemap: false,
        rollupOptions: {
			strictDeprecations: false,
			external: [
				/server\/localtunnel-server\/node_modules\/debug/,
				/node_modules\/koa/,
				/node_modules\/koa-router/,
				/node_modules\/tldjs/,
				/node_modules\/book/,
				/node_modules\/human-readable-ids/,
			],
			output: {
				strict: false,
				compact: false,
				indent: true,
			}
		},
		lib: {
            formats: ['cjs'],
			entry,
			name: packageName,
			fileName: 'index'
		}
	}
});