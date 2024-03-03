[//]: # (Header)

[package-shield-u-cli]: https://www.npmjs.com/package/@local-tunnel/cli/
[package-shield-i-cli]: https://img.shields.io/badge/cli-lightgray?style=flat-square&label=%40local-tunnel&labelColor=gray&color=lightgray
[package-shield-v-cli]: https://img.shields.io/npm/v/%40local-tunnel%2Fcli?style=flat-square
[package-shield-d-cli]: https://img.shields.io/npm/dt/%40local-tunnel%2Fcli?style=flat-square

[package-shield-u-client]: https://www.npmjs.com/package/@local-tunnel/client/
[package-shield-i-client]: https://img.shields.io/badge/client-lightgray?style=flat-square&label=%40local-tunnel&labelColor=gray&color=lightgray
[package-shield-v-client]: https://img.shields.io/npm/v/%40local-tunnel%2Fclient?style=flat-square
[package-shield-d-client]: https://img.shields.io/npm/dt/%40local-tunnel%2Fclient?style=flat-square

[repo-stars-url]: https://github.com/Marvin-Brouwer/local-tunnel/stargazers
[repo-stars-shield]: https://img.shields.io/github/stars/Marvin-Brouwer/local-tunnel.svg?color=brightgreen&style=flat-square
[license-url]: /LICENSE
[license-shield]: https://img.shields.io/badge/license-MIT-gold.svg?style=flat-square
[repo-releasenotes-url]: /CHANGELOG.md
[repo-releasenotes-shield]: https://img.shields.io/badge/Release_notes-gray.svg?style=flat-square

[discord-url]: https://discord.gg/fkw3Tmyu
[discord-shield]: https://img.shields.io/discord/958295823001722890?label=discord&logo=discord&style=flat-square

# `@local-tunnel/*`

> [!NOTE]  
> This library is forked from [`localtunnel/localtunnel`](https://github.com/localtunnel/localtunnel).  
> We do not own any rights to [localtunnel.me](https://localtunnel.me), nor do we have any influence on their server implementation.  
> Please refer to [`localtunnel/server`](https://github.com/localtunnel/server) for any concerns or problems you have with connecting or otherwise using [localtunnel.me](https://localtunnel.me).

<h3>

| [![CLI repo folder][package-shield-i-cli]](./libs/cli#readme)  				| [![CLI version][package-shield-v-cli] ![CLI downloads][package-shield-d-cli]][package-shield-u-cli] |
|:---	|:---	|
| [![Client repo folder][package-shield-i-client]](./libs/client#readme) | [![Client version][package-shield-v-client] ![Client downloads][package-shield-d-client]][package-shield-u-client] |
  
| [![Stars][repo-stars-shield]][repo-stars-url] | [![License][license-shield]][license-url] | [![Release notes][repo-releasenotes-shield]][repo-releasenotes-url] | [![Discord][discord-shield]][discord-url] |
|:---	|:---	|:---	|:---	|

</h3>
<hr/>

`@local-tunnel` exposes your localhost to the world for easy testing and sharing!  
No need to mess with DNS or deploy just to have others test out your changes.

Possible use-cases include:

- Browser testing tools like [`browserling`](https://www.browserling.com/)
- External api callback services like [`twilio`](https://www.twilio.com/) or developing for [`chromecast`](https://developers.google.com/cast/docs/registration).

## Why fork [`localtunnel/localtunnel`](https://github.com/localtunnel/localtunnel)?

The original library this is based on, seems to be rather stale.  
We had some issues with the pipeline ending the connection on [`AstroJs`](https://astro.build/) rebuilds.  
So, we modernized and rebuild to make it work with a fallback.  

## Why not use [`ngrok`](https://ngrok.com/)?

We had some issues with using [`ngrok`](https://ngrok.com/) on a `chromecast`.
Furthermore, you'll have to get a paid subscription on [`ngrok`](https://ngrok.com/) to get a named subdomain. [localtunnel.me](https://localtunnel.me) supports free named subdomains (if the name is not in use).  

> [!TIP]  
> If you're working with a large team, or if you have a lot of traffic, you might benefit from getting a paid [`ngrok`](https://ngrok.com/) server.  
> We don't know about the uptime or load [localtunnel.me](https://localtunnel.me) supports.  
> It is a free service, after all.

## Quick start

To create a tunnel locally run any of the following commands, depending on your package manager of choice.  

```console
npx @local-tunnel/cli help
```

```console
pnpm dlx @local-tunnel/cli help
```

```console
yarn dlx @local-tunnel/cli help
```

If you'd like, `@localtunnel/cli` can also be installed globally, or as a package dependency, after which you can invoke the CLI by running:  

```console
local-tunnel help
```

or:

```console
lt help
```

The CLI help is pretty comprehensive so no online docs are included for the CLI tool.  

## Development

The solution is setup to watch with a single command.  
To get started, run `pnpm i` on the project root.  
Next, run `pnpm watch` on the project root, and all workspaces will start watching for changes and compiling libraries.  

Individual libraries will have documented cli commands to host and test the tunnel.  
For setting up a local server see: [~/libs/server](./libs/server/Readme.md).  
For connecting to a local-tunnel server see: [~/libs/server](./libs/cli/Readme.md).  
