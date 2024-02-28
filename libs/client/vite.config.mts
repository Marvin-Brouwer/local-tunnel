// @ts-ignore-next-line
import packageConfig from './package.json' assert { type: 'json' };
import path from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { nodePolyfills } from 'vite-plugin-node-polyfills'

const isDev = process.argv.join(' ').includes('--mode development');
const srcFolder = path.resolve(__dirname, 'src');
const entry = path.resolve(srcFolder, 'index.ts');
const packageNameDefinition = packageConfig.name.split('/');
const packageName = packageNameDefinition[1];
const outputDir = 'dist';

export default defineConfig({
	plugins: [
		nodePolyfills({
		  include: [
			'stream'
		  ],
		  protocolImports: true,
		}),
		dts({ 
			entryRoot: srcFolder, 
			outDir: path.join(outputDir, 'types')
		})
	],
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
				/^node\:/
			],
			output: {
				compact: !isDev,
				indent: isDev,
			}
		},
		lib: {
            formats: ['cjs', 'es', 'umd'],
			entry,
			name: packageName,
			fileName: 'index'
		}
	}
});