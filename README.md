# StreamDock Plugins

A collection of plugins for the [VSDinside Stream Dock](https://www.hotspot.com/) (and compatible Stream Deck) devices. Each plugin is a self-contained `.sdPlugin` bundle that can be deployed independently.

## Plugins

| Plugin | Description |
|--------|-------------|
| [Shelly Control](it.devthis.shellycontrol.sdPlugin/README.md) | Control Shelly smart relays (Gen1 and Gen2+) directly from your Stream Dock. Supports toggle, on, and off commands, state polling, and multiple channels. |
| [Git Workspace Manager](it.devthis.gitworkspacemanager.sdPlugin/) | Monitor and manage local Git repositories from your Stream Deck. One button per repo: see branch, ahead/behind, dirty state. Execute fetch, pull, push, sync with one press. |

## Deployment

Run `deploy.py` from the repo root to copy a plugin to the platform-specific StreamDock plugins folder:

```bash
python3 deploy.py [<plugin-folder>]
```

Default plugin folder: `it.devthis.shellycontrol.sdPlugin`

Examples:
```bash
python3 deploy.py it.devthis.shellycontrol.sdPlugin
python3 deploy.py it.devthis.gitworkspacemanager.sdPlugin
```

### Plugin locations by OS

| OS | Path |
|----|------|
| macOS | `~/Library/Application Support/HotSpot/StreamDock/plugins/` |
| Windows | `%APPDATA%\HotSpot\StreamDock\plugins\` |
| Linux | `~/.config/HotSpot/StreamDock/plugins/` |

Restart StreamDock after deploying a plugin. Debug URL: `http://localhost:23519/`
