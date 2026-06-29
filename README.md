# DroidProxy CommandCode Lab

Windows desktop app and CLI lab for DroidProxy with experimental CommandCode routing.

**Recommended:** install the **DroidProxy** desktop app (Tauri). It runs the proxy, backend, and React UI from the system tray.

**CLI lab mode** (`npm start`) remains supported for headless use, CI, and scripting. It starts the same bundled `cli-proxy-api.exe` backend and OpenAI-compatible proxy, plus a **legacy** browser dashboard on port `8419`.

Generated settings and config are saved under `%USERPROFILE%\.cli-proxy-api\`:

```text
droidproxy-commandcode-lab-settings.json   # management secret key, CommandCode keys, Factory model selection
droidproxy-commandcode-lab-config.yaml     # backend config generated from resources/config.template.yaml
```

## Requirements

- Windows
- Node.js 18+ (CLI lab mode only)
- WebView2 runtime (desktop app — preinstalled on Windows 11)

## Desktop app (recommended)

Build the Windows installer from the monorepo root:

```powershell
pnpm install
pnpm desktop:build
```

Artifacts:

```text
apps/desktop/src-tauri/target/release/bundle/nsis/DroidProxy_0.1.0_x64-setup.exe
```

The installer bundles:

- `DroidProxy.exe` — Tauri shell (tray, settings, Management UI)
- `droidproxy-sidecar.exe` — proxy `:8417`, control API `:8420`
- `cli-proxy-api.exe` — backend `:8418` (unchanged binary)

After install, DroidProxy starts the sidecar and backend automatically. Default proxy endpoint:

```text
http://127.0.0.1:8417/v1
```

Enable **Allow LAN access** in Settings to bind the proxy on all interfaces. Enable **Start with Windows** to launch minimized to the tray (`--hidden`).

The advanced CLIProxyAPI Management Center is available at:

```text
http://127.0.0.1:8418/management.html
```

CI publishes unsigned installers via the `Desktop Release` workflow (`workflow_dispatch` or `desktop-v*` tags). Authenticode signing is reserved for GA builds.

Development:

```powershell
pnpm desktop:dev
```

## CLI lab mode (headless / CI)

```powershell
npm start
```

Use this endpoint in Droid/Factory from this PC or another device on the same network:

```text
http://YOUR_PC_IP:8417/v1
```

By default the frontend proxy listens on `0.0.0.0` (all interfaces). The backend management API remains local-only on `127.0.0.1:8418`.

### Legacy browser dashboard (`:8419`)

The HTML dashboard at `http://127.0.0.1:8419` is **deprecated**. Prefer the desktop app for OAuth, CommandCode keys, Factory models, and status. The lab dashboard is kept for compatibility during migration and shows a deprecation banner.

To expose the legacy dashboard on your LAN (not recommended):

```powershell
$env:DROIDPROXY_DASHBOARD_HOST="0.0.0.0"
npm start
```

Then open:

```text
http://YOUR_PC_IP:8419
```

If Windows reports the wrong LAN IP in logs or the dashboard, set the advertised host before starting:

```powershell
$env:DROIDPROXY_PUBLIC_HOST="192.168.1.50"
npm start
```

To force local-only mode for both proxy and dashboard:

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

The desktop app and legacy dashboard can apply DroidProxy model aliases to:

```text
%USERPROFILE%\.factory\settings.json
```

They remove stale `custom:droidproxy:*` / `custom:CC:*` entries, append the current DroidProxy catalog, and create a timestamped backup next to `settings.json` before writing.

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
- `8419` is the **legacy** lightweight DroidProxy browser dashboard (CLI lab mode only; deprecated).
- `8420` is the sidecar control API (desktop app; loopback only).
- Claude visible-thinking beta header rewriting is implemented in the frontend proxy.
- Codex fast mode injects `service_tier: "priority"` for `gpt-5.4` and `gpt-5.5` when enabled by environment variable.
- CommandCode models support local API-key round robin from the desktop UI, legacy dashboard, environment variables, or `~/.commandcode/auth.json`.
- In lab mode, orphaned `cli-proxy-api.exe` processes are not killed on start unless `DROIDPROXY_KILL_ORPHANED_BACKEND=1`.
- For details on the CommandCode conversion pipeline, see `commandcode-routing.md`.

## CommandCode API Keys

The desktop app and legacy dashboard have a CommandCode Keys panel. Paste one key per line, comma-separated keys, or a JSON array and click Save Keys. Saved keys are stored in:

```text
%USERPROFILE%\.cli-proxy-api\droidproxy-commandcode-lab-settings.json
```

Saved keys are used in round robin for `commandcode:*` / `cmc:*` models. Environment variables still work and are combined with saved keys and `~/.commandcode/auth.json`.

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