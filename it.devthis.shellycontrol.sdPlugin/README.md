# Shelly Control — StreamDock Plugin

Control [Shelly](https://www.shelly.com/) smart relays from your VSDinside Stream Dock (or Stream Deck). Supports both Gen1 and Gen2+ devices, multiple channels, HTTP basic auth, and automatic state polling.

**Plugin UUID:** `it.devthis.shellycontrol.toggle`

---

## Features

- Toggle, turn on, or turn off a Shelly relay with a single key press
- Supports **Gen1** (`/relay/<id>?turn=<command>`) and **Gen2+** (JSON-RPC `/rpc/Switch.Set`) API
- Multi-channel support — control any relay channel on multi-channel devices
- Automatic **state polling** with configurable interval (minimum 5 seconds)
- Visual state feedback — key image changes (on/off) and title updates
- HTTP Basic Authentication for password-protected devices
- Per-key settings via Property Inspector

---

## Requirements

- **StreamDock** (or Stream Deck) hardware
- Python **3.10+**
- `websockets` library (v12 to v15):

```bash
pip install websockets
```

A Shelly device reachable on the local network.

---

## Installation

### Deploy script

From the repo root:

```bash
python3 deploy.py
```

### Manual

Copy the `it.devthis.shellycontrol.sdPlugin` directory to the platform-specific plugins folder:

| OS | Path |
|----|------|
| macOS | `~/Library/Application Support/HotSpot/StreamDock/plugins/` |
| Windows | `%APPDATA%\HotSpot\StreamDock\plugins\` |
| Linux | `~/.config/HotSpot/StreamDock/plugins/` |

Restart StreamDock after installation.

---

## Configuration

Open the Property Inspector for a Shelly Toggle key. All fields auto-save on change.

| Field | Description | Default |
|-------|-------------|---------|
| **Name** | Display label shown on the key | *(empty)* |
| **IP or host** | IP address or hostname of the Shelly device | *(empty)* |
| **Generation** | Gen2+ (JSON-RPC) or Gen1 (legacy REST) | `Gen2+` |
| **Channel / relay ID** | Relay/channel index (0-based) | `0` |
| **Command** | Toggle, only ON, or only OFF | `Toggle` |
| **Polling interval** | Seconds between state checks (minimum 5) | `15` |
| **Username** | HTTP basic auth username (optional) | *(empty)* |
| **Password** | HTTP basic auth password (optional) | *(empty)* |

### Tips

- If **host** is empty, pressing the key shows "Config?" and triggers an alert animation.
- The **name** field is for display only; it does not affect the host connection.
- Polling is per-context — each key independently tracks its `_lastPoll` timestamp.

---

## Usage

1. Assign a key to the **Shelly Toggle** action in the StreamDock software.
2. Open the Property Inspector and enter the Shelly device IP/host.
3. Select generation, channel, and command.
4. Press the key to send the command. The key image reflects the relay state (on/off).
5. The plugin polls the device at the configured interval to keep the state in sync.

---

## Architecture

### Entrypoint

`plugin.py` is launched by `run.sh` (macOS/Linux) or `run.bat` (Windows) with the standard StreamDock CLI flags:

```
-port <port> -pluginUUID <uuid> -registerEvent <event> -info <json>
```

### Communication

- **Plugin ↔ StreamDock:** WebSocket connection to `ws://127.0.0.1:<port>`
- **Plugin ↔ Shelly:** Plain HTTP (no TLS) via `urllib`

### Polling loop

A background `asyncio` task runs every 2 seconds and checks each registered key's `_lastPoll` timestamp against its configured `pollSeconds` interval. When a context is due for a poll, it fetches the relay state and updates the key visuals.

### Settings flow

1. Property Inspector sends `{save: true, ...}` via `sendToPlugin`
2. Plugin merges with defaults, stores in `settings_by_context`, calls `setSettings`
3. Plugin replies via `sendToPropertyInspector` with `{ok: true, message: ..., settings: ...}`
4. PI displays confirmation and updates form fields

### Context resolution on save

When saving from the Property Inspector, the plugin resolves the target context in this order:
1. The PI context itself (if already registered)
2. A `_actionContext` hint from the PI (used when PI was opened before the key appeared)
3. The single registered key (fallback for fresh installs)

---

## API Reference

### Gen2+ (JSON-RPC)

- **Set state:** `POST /rpc/Switch.Set` with body `{"id": <channel>, "on": true|false}`
- **Get status:** `POST /rpc` with body `{"id": 1, "method": "Shelly.GetStatus"}`
- Response contains `result.switch:<channel>.output` (boolean)

### Gen1 (REST)

- **Set state:** `GET /relay/<channel>?turn=<toggle|on|off>`
- **Get status:** `GET /relay/<channel>`
- Response contains `ison` (boolean)

### Auth

If username is set, all HTTP requests include a `Basic` Authorization header (base64-encoded `user:pass`).

---

## Logs

Logs are written to `logs/plugin.log` inside the plugin directory. The log captures:

- WebSocket send/receive payloads
- HTTP request/response details
- Settings changes (with password masked as `***`)
- State transitions and polling activity
- Full stack traces on errors

---

## Limitations

- IPv6 is not explicitly handled.
- The host is normalized to always use `http://` (no HTTPS support).
- Only one action type (`it.devthis.shellycontrol.toggle`) is registered, but multiple keys can use it independently.
- The plugin runs as a single process — all keys share the same event loop.
