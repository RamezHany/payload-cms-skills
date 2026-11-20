# MCP clients

The snippets below are the ones in the Payload 3.x MCP plugin docs. That page says the client JSON can change and to check the client website before relying on it. Do that check when you write the config. Prefer the plugin's recommended `mcp-remote` shape when the client's current docs still show a command, and the native HTTP shape when the client's current docs show a `url`.

The bearer value is the key from the `payload-mcp-api-keys` collection. It lives in the editor's local MCP config, not in the website repository.

Local URL: `http://127.0.0.1:3000/api/mcp`. Production URL: `https://<production-host>/api/mcp`. Never an `http://` production host.

## Cursor

From the plugin docs, using `mcp-remote`:

```json
{
  "mcpServers": {
    "Payload": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "http://127.0.0.1:3000/api/mcp",
        "--header",
        "Authorization: Bearer MCP-USER-API-KEY"
      ]
    }
  }
}
```

Replace the placeholder. If Cursor's current docs accept a remote server with `url` and `headers`, that form is the "Other MCP clients" block below and does not need `mcp-remote`.

## VS Code

```json
{
  "mcp.servers": {
    "Payload": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "http://127.0.0.1:3000/api/mcp",
        "--header",
        "Authorization: Bearer MCP-USER-API-KEY"
      ]
    }
  }
}
```

## Claude Code

The plugin docs use the HTTP transport directly:

```bash
claude mcp add --transport http Payload http://127.0.0.1:3000/api/mcp \
  --header "Authorization: Bearer MCP-USER-API-KEY"
```

## Claude Desktop and other clients

The plugin docs do not ship a separate Claude Desktop file. If the installed app's docs list a remote HTTP server, use:

```json
{
  "mcpServers": {
    "Payload": {
      "type": "http",
      "url": "http://127.0.0.1:3000/api/mcp",
      "headers": {
        "Authorization": "Bearer MCP-USER-API-KEY"
      }
    }
  }
}
```

If the app only runs a local command, use the Cursor `mcp-remote` block. Confirm which of the two the current app accepts before saving.

## Listing tools

```bash
curl -i "http://127.0.0.1:3000/api/mcp" -X POST -H "Authorization: Bearer MCP-USER-API-KEY" -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -d "{\"jsonrpc\":\"2.0\",\"id\":\"1\",\"method\":\"tools/list\",\"params\":{}}"
```

The response must include find, create, and update for the allowed collections and must not include a delete tool. Creating a document is a `tools/call` to the create tool from that list. Then open the document in the admin and confirm it is a draft.

`npx @modelcontextprotocol/inspector` can call the same URL. Add the `Authorization` header there. Do not leave the inspector running against production with a key that can write.
