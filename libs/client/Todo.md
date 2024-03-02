# TODO

## Figure out client disconnect

For some reason the tunnels seem to disconnect. Figure out what's different between this setup and the original package.  
Current workaround: keepalive interval.

## Possibly validate the configuration better

It may be neat to use ZOD to validate the configuration for things like urls and possibly valid port numbers etc.  

## Work with chained `AbortSignal`s

We should work with `AbortSignal`s so we can cancel the program from the cli, and easily break on disconnect.
