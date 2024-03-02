# @local-tunnel/cli

TODO: Write better readme.

## Usage

Running `pnpm watch` will start a dummy server on port `8080` reflecting the path requested.  
If you now run `pnpm lt:dev:8080` in this folder too, you will run lt, setup to point to a `localtunnel-server` running on your machine.  
See: [~/libs/server](../server/Readme.md) on how to run the local server.

Alternatively, you can run `pnpm lt:dev:astro` if you're running an AstroJS project on your machine,
you can run `pnpm lt:dev:8008` to test with a configuration to a non-existing server, or you can run `pnpm lt` with custom arguments.  

> [!Note]  
> Running lt outside of the development server is not recommended when experimenting with loops and retry mechanisms.  
> You don't want to DOS the server.
