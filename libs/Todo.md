# Todo for libs

## rollup-plugin-local-tunnel

At some point we'd like to make a plugin for vite/astro/rollup so we can tunnel our dev server to the outside world.  
This may just be either a vite/astro middleware, or maybe a rollup plugin would be enough.  
The rollup plugin has preference since that would be applicable in the widest scope.  

- Use virtual import to expose the tunnel too:  
  <https://rollupjs.org/plugin-development/#a-simple-example>
- <https://dev.to/brense/vite-dev-server-adding-middleware-3mp5>
