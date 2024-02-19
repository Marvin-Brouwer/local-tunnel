import packageConfig from './package.json' assert { type: 'json' };
import path from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

const isDev = process.argv.join(' ').includes('--mode development');
const srcFolder = path.resolve(__dirname, 'src');
const entry = path.resolve(srcFolder, 'index.ts');
const packageNameDefinition = packageConfig.name.split('/');
const packageName = packageNameDefinition[1];
const outputDir = 'dist';

export default defineConfig({
	plugins: [
		dts({ 
			entryRoot: srcFolder, 
			outDir: path.join(outputDir, 'types')
		})
	],
	build: {
		minify: !isDev,
		target: ['ESNext'],
		outDir: outputDir,
        rollupOptions: {
			output: {
				compact: !isDev,
				indent: isDev,
				sourcemap: isDev
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