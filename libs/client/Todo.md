# TODO

## Figure out client disconnect

For some reason the tunnels seem to disconnect. Figure out what's different between this setup and the original package.

## Figure out more robust connection

The original package has a "flaw", where it crashes once a server doesn't respond.  
This is probably expected behavior, however, development servers are quirky so we'd like to account for that.

### Implement a retry policy

On the back of the connection that doesn't break on a non-response, we might like to add a retry policy for connecting to the local endpoint.

## Possibly validate the configuration better

It may be neat to use ZOD to validate the configuration for things like urls and possibly valid port numbers etc.  

## Specialized error classes

Just to make the errors self-documenting, it makes sense to have custom errors for scenarios.  

## Improve regexes

Some regexes are used for basic things, like replacing a host header in a pipe-transform.  
There has to be a better way without using regex.  
