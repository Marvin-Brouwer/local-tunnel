# TODO

## Figure out client disconnect

For some reason the tunnels seem to disconnect. Figure out what's different between this setup and the original package.  
Current workaround: keepalive interval.

## Figure out more robust connection

The original package has a "flaw", where it crashes once a server doesn't respond.  
This is probably expected behavior, however, development servers are quirky so we'd like to account for that.
Currently, this works for the initial connection, but it still seems to crash on con refused.

## Possibly validate the configuration better

It may be neat to use ZOD to validate the configuration for things like urls and possibly valid port numbers etc.  

## Specialized error classes

Just to make the errors self-documenting, it makes sense to have custom errors for scenarios.  

## Work with chained `AbortSignal`s

We should work with `AbortSignal`s so we can cancel the program from the cli, and easily break on disconnect.