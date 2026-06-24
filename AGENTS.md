# AGENTS.md — StreamDock Plugins

## Repo structure

```
StreamDock-plugins/
  it.devthis.shellycontrol.sdPlugin/   -- deployable plugin bundle
    plugin.py                          -- main plugin (single-file, ~420 lines)
    manifest.json                      -- Stream Deck SDK v2 manifest
    run.sh / run.bat                   -- launcher scripts
    requirements.txt                   -- websockets>=12,<16 (only dep)
    propertyinspector/index.html|.js   -- settings UI (no build step)
    assets/*.png                       -- icons
    logs/plugin.log                    -- runtime log (gitignored implicitly)
```

No README, no build system, no tests, no lint/typecheck config.

## Entrypoint & execution

- `run.sh`/`run.bat` launches `plugin.py` with StreamDock CLI args (named flags: `-port`, `-pluginUUID`, `-registerEvent`, `-info`).
- The `.sdPlugin` directory must be placed in the StreamDock/HotSpot plugins folder (see Deployment below).
- The plugin connects to StreamDock via `ws://127.0.0.1:<port>`, so it has no standalone mode.

## Plugin quirks (non-obvious)

- **Host normalization**: `normalize_host` auto-prepends `http://` if missing. A Shelly device must be reachable at the given IP; if `host` is empty, the key shows "Config?" on press.
- **Gen1 vs Gen2 API**: Gen2 uses JSON-RPC (`/rpc/Switch.Set`, `/rpc Shelly.GetStatus`). Gen1 uses `/relay/<id>?turn=<command>`.
- **Polling**: Hardcoded 2s loop but per-context interval from `pollSeconds` setting (min 5s). Injects `_lastPoll` timestamp into the settings dict.
- **Settings flow**: Property inspector → `sendToPlugin({save:true, ...})` → plugin stores → `setSettings` → `sendToPropertyInspector` with `{ok:true, ...}`. The PI auto-saves on every field `change` event.
- **Context resolution**: When saving from PI, the plugin tries the PI context first, then a `_actionContext` hint, then falls back to the single registered key.
- **Password masking**: `sanitized_settings` replaces `password` with `"***"` in all log output.
- **`websockets` import**: Wrapped in try/except; missing dep raises RuntimeError with Italian message.

## Single action

Only `it.devthis.shellycontrol.toggle` (Shelly Toggle). Default settings: `gen2`, channel 0, toggle command, 15s poll, show state in title.

## Deployment

Run `python3 deploy.py` from the repo root. It detects the OS and copies the plugin to:

- **macOS**: `~/Library/Application Support/HotSpot/StreamDock/plugins/`
- **Windows**: `%APPDATA%\HotSpot\StreamDock\plugins\`
- **Linux**: `~/.config/HotSpot/StreamDock/plugins/`

Restart StreamDock after first install. Debug URL: `http://localhost:23519/`

## Testing

No test framework. Manual testing via StreamDock hardware/emulator. Logs are written to `logs/plugin.log`.
