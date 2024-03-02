/* eslint-disable no-console */
/* eslint-disable no-template-curly-in-string */
/* eslint-disable no-use-before-define */

import { readFileSync } from 'node:fs';
import {
	type RequestListener, type Server, type ServerResponse, createServer,
} from 'node:http';
import path, { posix } from 'node:path';

import { type Plugin } from 'rollup';
import { type ConfigEnv } from 'vite';

type ErrorWithCode = Error & { code: string };

export type RollupServeOptions = {

	/**
	 * Change the host of the server (default: `'*'`)
	 */
	host?: string

	/**
	 * Set the port that the server will listen on
	 */
	port: number,
	configEnv?: ConfigEnv
}

let server: Server;

/**
 * Serve a dummy endpoint, mirroring the path requested.
 * @see https://github.com/thgh/rollup-plugin-serve/
 */
function serveDummy(options: RollupServeOptions): Plugin {
	// A very crude way of disabling the fake server on build
	if (options.configEnv?.command !== 'serve') {
		return {
			name: 'rollup-plugin-serve-dummy',
		};
	}

	const htmlResponse = readFileSync(path.resolve(__dirname, './dummy-server.html'));

	const requestListener: RequestListener = (request, response) => {
		const urlParts = request.url!.split('?');
		const unsafePath = decodeURI(urlParts[0]);

		// Don't allow path traversal
		const urlPath = posix.normalize(unsafePath);
		const urlQuery = urlParts.length === 0
			? new URLSearchParams()
			: new URLSearchParams(urlParts[1]);

		console.log('request', urlPath, urlQuery.toString());

		if (urlPath === '/ECONNREFUSED') {
			const fakeError = new Error('Faking connection refused') as ErrorWithCode;
			fakeError.code = 'ECONNREFUSED';
			return response.destroy(fakeError);
		}
		if (urlPath === '/ECONNRESET') {
			const fakeError = new Error('Faking connection reset') as ErrorWithCode;
			fakeError.code = 'ECONNRESET';
			return response.destroy(fakeError);
		}

		const canonical = request.headers['x-forwarded-host']?.toString()
			?? `//${request.headers.host ?? (`localhost:${options.port}`)}`;

		let statusCode = !urlQuery.has('statusCode')
			? 200
			: parseInt(urlQuery.get('statusCode')!, 10);

		if (urlQuery.has('redirect')) {
			statusCode = 307;
			response.setHeader('Location', urlQuery.get('redirect')!);
		}

		const content = htmlResponse
			.toString()
			.replaceAll('${urlPath}', urlPath)
			.replaceAll('${canonical}', canonical)
			.replaceAll('${statusCode}', statusCode.toString());

		return found(response, statusCode, 'text/html', content);
	};

	// release previous server instance if rollup is reloading configuration in watch mode
	if (server) {
		server.close();
	} else {
		closeServerOnTermination();
	}

	// Assemble url for error and info messages
	const url = `http://${options.host ?? '*'}:${options.port}`;

	// If HTTPS options are available, create an HTTPS server
	server = createServer(requestListener);
	server.listen({ port: options.port, host: options.host }, () => {
		console.info(`dummy server running on ${url}`);
	});

	// Handle common server errors
	server.on('error', (e: ErrorWithCode) => {
		if (e.code === 'EADDRINUSE') {
			console.error(`${url} is in use, either stop the other server or use a different port.`);
			process.exit();
		} else {
			throw e;
		}
	});

	return {
		name: 'rollup-plugin-serve-dummy',
	};
}

function found(response: ServerResponse, statusCode: number, mimeType: string, content: string) {
	response.writeHead(statusCode, { 'Content-Type': mimeType || 'text/plain' });
	response.end(content, 'utf-8');
}

function closeServerOnTermination() {
	const terminationSignals = ['SIGINT', 'SIGTERM', 'SIGQUIT', 'SIGHUP'];
	terminationSignals.forEach((signal) => {
		process.on(signal, () => {
			if (server) {
				server.close();
				process.exit();
			}
		});
	});
}

export default serveDummy;
