# TODO

## Copy over contribution docs

Copy over contribution docs and github templates from other projects.
Possibly, change some stuff to conventional commits for autogenerating release notes.

## Setup test pipelines in github

All tests should be run on PR to prevent breaking merges.

## Setup semantic release/release me

We don't want to be releasing to npm manually, use one of those setups to make the releases less painful than the original package.  

- <https://infinum.com/handbook/frontend/node/managing-node-npm-versions>
- <https://github.com/npm/cli/blob/latest/.release-please-manifest.json>
- <https://dev.to/archinmodi/simplify-your-release-process-with-the-release-please-github-action-3l34>
- <https://www.hamzak.xyz/blog-posts/release-please-vs-semantic-release#:~:text=One%20key%20difference%20between%20release,into%20a%20project's%20build%20process>
- Automatically publish and maintain npm packages:  
  <https://youtu.be/0Z0nAJjmQRg?si=W6IgYRqOe6I6sEW4>
  
## Test package with install global and dlx

See if the name resolver works the way we think it does.  
