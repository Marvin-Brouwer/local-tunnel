# `@local-tunnel/server`

This is just for development.
TODO: Write better readme.

## Development

Make sure you add the local domain to your hosts file.  
On windows: `C:\Windows\system32\drivers\etc\hosts`.  

```hosts
# localtunnel-server local development
## The host server instance for requesting lease
127.0.0.1       localtunnel-dev
## Named example for port 8080 
127.0.0.1       8080.localtunnel-dev
## Named example for AstroJS on port 4321
127.0.0.1       astro.localtunnel-dev
## Named example for a server that's not running on port 8008
127.0.0.1       8008.localtunnel-dev
```  

If this is setup correctly, you can run `pnpm serve` in this folder too, you will have a `localtunnel-server` running on your machine.
