# TODO

## Setup proper executable node

- Configure `package.json` to be executable.
- Configure `vite.config.mts` to append `#...` executable header to bin file.  

## Simplify cli setup

The cli can be simplified a lot.
If you just go for something like these:

```none
> lt http://localhost:8080 --host localtunnel-dev --named test
> lt https://localhost:4321 --host localtunnel-dev --named astro --skip-cert-check
```

We can make the parsing of the url decide whether it's https or not.  
CommanderJS may have some features we can use for that.  

## Add proper cli help

This just needs to happen.  