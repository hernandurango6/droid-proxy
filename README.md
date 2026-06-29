# DroidProxy CommandCode Lab

Isolated Windows lab for DroidProxy with experimental CommandCode routing.

It starts the bundled `cli-proxy-api.exe` on `127.0.0.1:8418` and exposes a DroidProxy-compatible proxy on all network interfaces at port `8417`.

It also serves a local dashboard on:

```text
http://YOUR_PC_IP:8419
```

The bundled CLIProxyAPI Management Center is available through the backend:

```text
http://127.0.0.1:8418/management.html
```

Generated settings and config are saved under `%USERPROFILE%\.cli-proxy-api\`:

```text
droidproxy-commandcode-lab-settings.json   # management secret key, CommandCode keys, Factory model selection
droidproxy-commandcode-lab-config.yaml     # backend config generated from resources/config.template.yaml
```

## Requirements

- Windows
- Node.js 18+

## Start

```powershell
npm start
```

Use this endpoint in Droid/Factory from this PC or another device on the same network:

```text
http://YOUR_PC_IP:8417/v1
```

Open the dashboard:

```text
http://YOUR_PC_IP:8419
```

By default the frontend proxy and dashboard listen on `0.0.0.0`. The backend management API remains local-only on `127.0.0.1:8418`.

If Windows reports the wrong LAN IP in the dashboard, set the advertised host before starting:

```powershell
$env:DROIDPROXY_PUBLIC_HOST="192.168.1.50"
npm start
```

To force local-only mode:

```powershell
$env:DROIDPROXY_HOST="127.0.0.1"
$env:DROIDPROXY_DASHBOARD_HOST="127.0.0.1"
npm start
```

To use different ports:

```powershell
$env:DROIDPROXY_PORT="8417"
$env:DROIDPROXY_BACKEND_PORT="8418"
$env:DROIDPROXY_DASHBOARD_PORT="8419"
npm start
```

## Factory Custom Models

The dashboard can apply DroidProxy model aliases to:

```text
%USERPROFILE%\.factory\settings.json
```

It removes stale `custom:droidproxy:*` / `custom:CC:*` entries, appends the current DroidProxy catalog, and creates a timestamped backup next to `settings.json` before writing.

## OAuth Login

```powershell
npm run login:claude
npm run login:codex
npm run login:kimi
npm run login:antigravity
npm run login:gemini
npm run login:xai
```

Tokens are stored by `cli-proxy-api.exe` under:

```text
%USERPROFILE%\.cli-proxy-api
```

Provider flags used internally:

```text
claude      -> -claude-login
codex       -> -codex-login
kimi        -> -kimi-login
antigravity -> -antigravity-login
gemini      -> -login
xai         -> -xai-login
```

## Commands

```powershell
node src/cli.js start
node src/cli.js login claude
node src/cli.js login codex
node src/cli.js login kimi
node src/cli.js login antigravity
node src/cli.js login gemini
node src/cli.js login xai
node src/cli.js accounts
node src/cli.js config
node src/cli.js help
```

## Notes

- `8417` is the public local proxy endpoint.
- `8418` is the private backend endpoint.
- `8418/management.html` is the advanced CLIProxyAPI Management Center.
- `8419` is the lightweight DroidProxy launcher dashboard.
- Claude visible-thinking beta header rewriting is implemented in the frontend proxy.
- Codex fast mode injects `service_tier: "priority"` for `gpt-5.4` and `gpt-5.5` when enabled by environment variable.
- CommandCode models support local API-key round robin from the dashboard, environment variables, or `~/.commandcode/auth.json`.
- In lab mode, orphaned `cli-proxy-api.exe` processes are not killed on start unless `DROIDPROXY_KILL_ORPHANED_BACKEND=1`.
- For details on the CommandCode conversion pipeline, see `commandcode-routing.md`.

## CommandCode API Keys

The dashboard has a CommandCode Keys panel. Paste one key per line, comma-separated keys, or a JSON array and click Save Keys. Saved keys are stored in:

```text
%USERPROFILE%\.cli-proxy-api\droidproxy-commandcode-lab-settings.json
```

Saved keys are used in round robin for `commandcode:*` / `cmc:*` models. Environment variables still work and are combined with dashboard-saved keys and `~/.commandcode/auth.json`.

Environment flags:

```powershell
$env:DROIDPROXY_COMMANDCODE_API_KEYS = "key_1,key_2,key_3,key_4"
$env:DROIDPROXY_COMMANDCODE_URL = "https://api.commandcode.ai/alpha/generate"
$env:DROIDPROXY_GPT54_FAST_MODE = "1"
$env:DROIDPROXY_GPT55_FAST_MODE = "1"
$env:DROIDPROXY_DEBUG = "1"
$env:DROIDPROXY_REQUEST_RETRY = "3"
$env:DROIDPROXY_REQUEST_TIMEOUT = "10m"
```

`DROIDPROXY_COMMANDCODE_API_KEYS` and `COMMANDCODE_API_KEYS` accept comma-separated, semicolon-separated, newline-separated, or JSON-array values. The older single-key variables `DROIDPROXY_COMMANDCODE_API_KEY` and `COMMANDCODE_API_KEY` still work.