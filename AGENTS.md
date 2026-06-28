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
  it.devthis.gitworkspacemanager.sdPlugin/  -- deployable plugin bundle
    src/                               -- TypeScript source
    plugin/                            -- compiled JS output (entry: index.js)
    manifest.json                      -- 6 actions (repo, fetch, pull, push, sync, folder)
    package.json                       -- ws, log4js deps + tsc build
    tsconfig.json                      -- CommonJS target, strict mode
    propertyInspector/index.html|.js   -- settings UI for Repository Monitor
    assets/*.png                       -- placeholder icons
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

No test framework. Manual testing via StreamDock hardware/emulator.

## Git Workspace Manager

### Build

```bash
cd it.devthis.gitworkspacemanager.sdPlugin
npm install
npm run build        # compiles TypeScript → plugin/
npm run debug-render # generates debug-render.html with all SVG states
```

### Architecture

- **Entrypoint**: `plugin/index.js` (compiled from `src/index.ts`), launched by StreamDock's built-in Node.js 20 runtime.
- **SDK**: VSDinside Node.js SDK v2 vendored as `plugin/utils/plugin.js`.
- **Modules**: `GitService` (git CLI wrapper), `RepositoryWatcher` (periodic fetch + state cache), `ImageRenderer` (dynamic SVG), `SettingsStorage` (validation).
- **Actions**: 6 actions — `repo` (main monitor with Property Inspector), `fetch`, `pull`, `push`, `sync`, `folder`.
- **Settings flow**: PI → `saveData()` (direct `setSettings`) → plugin `didReceiveSettings` → watcher re-register. The PI auto-saves on every field `change` event.
- **Active repo**: Pressing a Repository Monitor button sets it as active via global settings. Other actions (fetch/pull/push/sync/folder) read the active repo and show its name on the button.

### Non-obvious quirks

- **setImage SVG**: Images are base64-encoded SVG via `data:image/svg+xml;charset=utf8,...`. Canvas is 100×100 with centered text, white border highlight on the active repo.
- **Polling**: Per-context interval from `refreshInterval` setting (min 5s). Uses `git fetch --quiet` without modifying working tree.
- **Git errors mapped to user states**: Network error, Auth error, Repository not found, Git not found, Merge conflicts — each shown with distinct color (red) and message.
