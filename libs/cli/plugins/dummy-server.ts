import { createServer, type RequestListener, type Server } from 'node:http'
import { posix } from 'node:path'
import { type Plugin } from 'rollup'

export type RollupServeOptions = {

  /**
   * Change the host of the server (default: `'*'`)
   */
  host?: string

  /**
   * Set the port that the server will listen on
   */
  port: number
}

let server: Server;

/**
 * Serve a dummy endpoint, mirroring the path requested.
 * @see https://github.com/thgh/rollup-plugin-serve/
 */
function serveDummy (options: RollupServeOptions): Plugin {

  options.port = options.port

  const requestListener: RequestListener = (request, response) => {
    // Remove querystring
    const unsafePath = decodeURI(request.url.split('?')[0])

    // Don't allow path traversal
    const urlPath = posix.normalize(unsafePath);
    if (urlPath === '/ECONNREFUSED') {
      const fakeError = new Error('Faking connection refused');
      (fakeError as any).code = 'ECONNREFUSED';
      response.destroy(fakeError);
    }

    const content = `
      <html>
        <head>
          <title>${urlPath}</title>
        </head>
        <body>
          <h1>Test response</h1>
          <p><pre>${urlPath}</pre></p>
        </body>
      </html>
    `;
    return found(response, 'text/html', content);
  }

  // release previous server instance if rollup is reloading configuration in watch mode
  if (server) {
    server.close()
  } else {
    closeServerOnTermination()
  }

  // Assemble url for error and info messages
  const url = `http://${options.host ?? '*'}:${options.port}`;

  // If HTTPS options are available, create an HTTPS server
  server = createServer(requestListener)
  server.listen({ port: options.port, host: options.host }, () => {
    console.info(`dummy server running on ${url}`);
  });


  // Handle common server errors
  server.on('error', e => {
    if ((e as any).code === 'EADDRINUSE') {
      console.error(url + ' is in use, either stop the other server or use a different port.')
      process.exit()
    } else {
      throw e
    }
  })

  return {
    name: 'rollup-plugin-serve-dummy'
  }
}

function found (response, mimeType, content) {
  response.writeHead(200, { 'Content-Type': mimeType || 'text/plain' })
  response.end(content, 'utf-8')
}

function closeServerOnTermination () {
  const terminationSignals = ['SIGINT', 'SIGTERM', 'SIGQUIT', 'SIGHUP']
  terminationSignals.forEach(signal => {
    process.on(signal, () => {
      if (server) {
        server.close()
        process.exit()
      }
    })
  })
}

export default serveDummy;