# Capability Layer

This folder is MCP prework. It defines stable Second Brain capabilities without starting an MCP server or changing webapp runtime behavior.

The intended future shape is:

```text
HTTP routes
        \
         shared capability/service functions
        /
MCP tools
```

For now, `manifest.js` is the contract:

- capability names
- rough input/output schemas
- current HTTP route equivalents
- risk level
- first-pass vs later/deferred scope
- MCP auth expectations

`server.js` now uses an internal `executeCapability(name, input)` boundary for the routes that map cleanly to future MCP tools. HTTP routes are responsible for request parsing, response writing, and auth. Capability execution is responsible for trusted app operations.

The MCP HTTP listener in `src/mcp/httpServer.js` now uses this same boundary through `tools/call`. Keep auth, transport, and capability logic separate:

- HTTP web routes use browser/session/app-token auth.
- MCP uses token auth on its own port.
- Both call `executeCapability(name, input)` after authentication.

Next architecture cleanup: move the implementation behind `executeCapability()` into `src/services/*` modules so HTTP routes and MCP tools remain thin adapters.
