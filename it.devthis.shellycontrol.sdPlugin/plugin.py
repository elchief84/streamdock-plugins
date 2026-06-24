#!/usr/bin/env python3
import asyncio
import base64
import json
import os
import sys
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

try:
    import websockets  # type: ignore
except Exception:
    websockets = None

PLUGIN_UUID = "it.devthis.shellycontrol"
ACTIONS = {"it.devthis.shellycontrol.toggle"}
BASE_DIR = Path(__file__).resolve().parent
LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(exist_ok=True)
LOG_FILE = LOG_DIR / "plugin.log"

DEFAULT_SETTINGS = {
    "name": "",
    "host": "",
    "generation": "gen2",
    "channelId": 0,
    "command": "toggle",
    "username": "",
    "password": "",
    "pollSeconds": 15,
}


def log(message: str) -> None:
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    with LOG_FILE.open("a", encoding="utf-8") as f:
        f.write(f"[{ts}] {message}\n")


def log_exception(prefix: str, exc: Exception) -> None:
    log(f"{prefix}: {exc.__class__.__name__}: {exc}")
    tb = traceback.format_exc()
    if tb and tb.strip() != "NoneType: None":
        for line in tb.rstrip().splitlines():
            log(f"TRACE {line}")


class ShellyPlugin:
    def __init__(self, port: int, plugin_uuid: str, register_event: str, info: str):
        self.port = port
        self.plugin_uuid = plugin_uuid
        self.register_event = register_event
        self.info = json.loads(info) if info else {}
        self.ws = None
        self.settings_by_context = {}
        self.poll_task = None

    async def connect(self):
        if websockets is None:
            raise RuntimeError(
                "Dipendenza mancante: installa 'websockets' con 'pip install websockets'"
            )
        uri = f"ws://127.0.0.1:{self.port}"
        log(f"Connecting to {uri}")
        log(f"Register event: {self.register_event}")
        log(f"Plugin UUID: {self.plugin_uuid}")
        self.ws = await websockets.connect(uri)
        await self.send({"event": self.register_event, "uuid": self.plugin_uuid})
        self.poll_task = asyncio.create_task(self.poll_loop())
        async for raw in self.ws:
            try:
                log(f"WS RECV {raw}")
                payload = json.loads(raw)
                await self.handle_event(payload)
            except Exception as exc:
                log_exception("Error handling message", exc)

    async def send(self, payload: dict):
        if self.ws is None:
            return
        raw = json.dumps(payload)
        log(f"WS SEND {raw}")
        await self.ws.send(raw)

    async def set_title(self, context: str, title: str):
        await self.send(
            {
                "event": "setTitle",
                "context": context,
                "payload": {"title": title[:20], "target": 0},
            }
        )

    async def set_state(self, context: str, state: int):
        await self.send(
            {
                "event": "setState",
                "context": context,
                "payload": {"state": 1 if state else 0},
            }
        )

    async def show_alert(self, context: str):
        await self.send({"event": "showAlert", "context": context})

    async def show_ok(self, context: str):
        await self.send({"event": "showOk", "context": context})

    async def get_settings(self, context: str):
        await self.send({"event": "getSettings", "context": context})

    async def set_settings(self, context: str, settings: dict):
        await self.send(
            {"event": "setSettings", "context": context, "payload": settings}
        )

    async def send_to_property_inspector(self, context: str, payload: dict):
        await self.send(
            {"event": "sendToPropertyInspector", "action": "it.devthis.shellycontrol.toggle", "context": context, "payload": payload}
        )

    async def handle_event(self, msg: dict):
        event = msg.get("event")
        context = msg.get("context")
        action = msg.get("action")
        log(
            f"EVENT event={event} action={action} context={context} payloadKeys={list((msg.get('payload') or {}).keys())}"
        )

        if action and action not in ACTIONS:
            log(f"Ignoring unsupported action: {action}")
            return

        if event in {"willAppear", "didReceiveSettings"} and context:
            settings = {**DEFAULT_SETTINGS, **(msg.get("payload", {}).get("settings") or {})}
            self.settings_by_context[context] = settings
            log(f"Stored settings for {context}: {self.sanitized_settings(settings)}")
            await self.refresh_context(context)
        elif event == "didReceiveGlobalSettings":
            log("Received global settings")
        elif event == "keyDown" and context:
            settings = self.settings_by_context.get(context, DEFAULT_SETTINGS.copy())
            log(f"keyDown using settings: {self.sanitized_settings(settings)}")
            await self.execute_command(context, settings)
        elif event == "sendToPlugin" and context:
            payload = msg.get("payload", {})
            if payload.get("save"):
                target_context = context
                hinted_context = payload.get("_actionContext")
                if target_context not in self.settings_by_context:
                    if hinted_context in self.settings_by_context:
                        target_context = hinted_context
                    elif len(self.settings_by_context) == 1:
                        target_context = next(iter(self.settings_by_context.keys()))
                log(
                    f"sendToPlugin context resolve incoming={context} hinted={hinted_context} target={target_context}"
                )

                settings = {**DEFAULT_SETTINGS, **payload}
                settings.pop("save", None)
                settings.pop("_actionContext", None)
                self.settings_by_context[target_context] = settings
                log(f"Saved settings for {target_context}: {self.sanitized_settings(settings)}")
                await self.set_settings(target_context, settings)
                await self.send_to_property_inspector(
                    target_context,
                    {
                        "ok": True,
                        "kind": "ok",
                        "message": f"Salvataggio riuscito: host={settings.get('host') or '-'} gen={settings.get('generation')} ch={settings.get('channelId')}",
                        "settings": settings,
                    },
                )
                await self.refresh_context(target_context)
        elif event == "willDisappear" and context:
            self.settings_by_context.pop(context, None)
            log(f"Removed context {context}")
        elif event == "deviceDidConnect":
            log("Device connected")
        elif event == "applicationDidLaunch":
            log(f"Application launched: {msg.get('payload', {}).get('application')}")

    def sanitized_settings(self, settings: dict) -> dict:
        safe = dict(settings)
        if safe.get("password"):
            safe["password"] = "***"
        return safe

    async def refresh_context(self, context: str):
        settings = self.settings_by_context.get(context, DEFAULT_SETTINGS.copy())
        host = (settings.get("host") or "").strip()
        if not host:
            await self.set_state(context, 0)
            await self.set_title(context, settings.get("name") or "Shelly")
            await self.set_state(context, 0)
            return
        try:
            log(f"Refreshing context {context} host={host}")
            is_on = await asyncio.to_thread(self.fetch_state, settings)
            await self.update_visual_state(context, settings, is_on)
        except Exception as exc:
            log_exception(f"refresh_context failed [{host}]", exc)
            await self.set_state(context, 0)
            await self.set_title(context, self.build_title(settings, None))
            await self.set_state(context, 0)

    async def execute_command(self, context: str, settings: dict):
        host = (settings.get("host") or "").strip()
        if not host:
            await self.show_alert(context)
            await self.set_state(context, 0)
            await self.set_title(context, "Config?")
            await self.set_state(context, 0)
            return
        try:
            log(f"Executing command on {host}: {self.sanitized_settings(settings)}")
            result = await asyncio.to_thread(self.perform_command, settings)
            await self.update_visual_state(context, settings, result)
            await self.show_ok(context)
        except Exception as exc:
            log_exception(f"execute_command failed [{host}]", exc)
            await self.set_state(context, 0)
            await self.set_title(context, self.build_title(settings, None))
            await self.set_state(context, 0)
            await self.show_alert(context)

    async def update_visual_state(self, context: str, settings: dict, is_on):
        log(f"Update visual state context={context} state={is_on}")
        state = 1 if is_on else 0
        await self.set_state(context, state)
        await self.set_title(context, self.build_title(settings, is_on))
        await self.set_state(context, state)

    def build_title(self, settings: dict, is_on):
        name = (settings.get("name") or "Shelly").strip() or "Shelly"
        return name

    def auth_header(self, settings: dict):
        username = settings.get("username") or ""
        password = settings.get("password") or ""
        if not username:
            return {}
        token = base64.b64encode(f"{username}:{password}".encode()).decode()
        return {"Authorization": f"Basic {token}"}

    def http_json(self, url: str, method="GET", data=None, headers=None):
        headers = headers or {}
        body = None
        if data is not None:
            body = json.dumps(data).encode("utf-8")
            headers = {**headers, "Content-Type": "application/json"}
        log(f"HTTP {method} {url} data={data} headers={list(headers.keys())}")
        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                raw = response.read().decode("utf-8")
                log(f"HTTP RESPONSE {response.status} {url} body={raw}")
                if not raw:
                    return {}
                return json.loads(raw)
        except urllib.error.HTTPError as exc:
            error_body = exc.read().decode("utf-8", errors="replace") if hasattr(exc, "read") else ""
            log(f"HTTP ERROR {exc.code} {url} body={error_body}")
            raise
        except urllib.error.URLError as exc:
            log(f"URL ERROR {url}: {exc}")
            raise

    def perform_command(self, settings: dict):
        generation = (settings.get("generation") or "gen2").lower()
        command = (settings.get("command") or "toggle").lower()
        log(f"perform_command generation={generation} command={command}")
        if generation == "gen1":
            self.call_gen1(settings, command)
        else:
            self.call_gen2(settings, command)
        return self.fetch_state(settings)

    def fetch_state(self, settings: dict):
        generation = (settings.get("generation") or "gen2").lower()
        log(f"fetch_state generation={generation}")
        return self.fetch_state_gen1(settings) if generation == "gen1" else self.fetch_state_gen2(settings)

    def normalize_host(self, host: str) -> str:
        original = host.strip()
        if not original:
            return ""
        parsed = urllib.parse.urlparse(original if "://" in original else f"http://{original}")
        scheme = parsed.scheme or "http"
        netloc = parsed.netloc or parsed.path
        normalized = f"{scheme}://{netloc}".rstrip("/")
        log(f"normalize_host input={original} normalized={normalized}")
        return normalized

    def call_gen2(self, settings: dict, command: str):
        base = self.normalize_host(settings["host"])
        channel_id = int(settings.get("channelId", 0))
        headers = self.auth_header(settings)
        if command == "toggle":
            on = not self.fetch_state_gen2(settings)
        else:
            on = command == "on"
        url = f"{base}/rpc/Switch.Set"
        log(f"call_gen2 url={url} channel={channel_id} on={on}")
        self.http_json(url, method="POST", data={"id": channel_id, "on": on}, headers=headers)

    def fetch_state_gen2(self, settings: dict):
        base = self.normalize_host(settings["host"])
        channel_id = int(settings.get("channelId", 0))
        headers = self.auth_header(settings)
        status = self.http_json(
            f"{base}/rpc", method="POST", data={"id": 1, "method": "Shelly.GetStatus"}, headers=headers
        )
        result = status.get("result", status)
        switch_obj = result.get(f"switch:{channel_id}") or {}
        output = bool(switch_obj.get("output", False))
        log(f"fetch_state_gen2 channel={channel_id} output={output} rawKeys={list(result.keys())}")
        return output

    def call_gen1(self, settings: dict, command: str):
        base = self.normalize_host(settings["host"])
        channel_id = int(settings.get("channelId", 0))
        headers = self.auth_header(settings)
        url = f"{base}/relay/{channel_id}?turn={urllib.parse.quote(command)}"
        log(f"call_gen1 url={url}")
        self.http_json(url, headers=headers)

    def fetch_state_gen1(self, settings: dict):
        base = self.normalize_host(settings["host"])
        channel_id = int(settings.get("channelId", 0))
        headers = self.auth_header(settings)
        data = self.http_json(f"{base}/relay/{channel_id}", headers=headers)
        output = bool(data.get("ison", False))
        log(f"fetch_state_gen1 channel={channel_id} output={output} raw={data}")
        return output

    async def poll_loop(self):
        while True:
            try:
                await asyncio.sleep(2)
                for context, settings in list(self.settings_by_context.items()):
                    host = (settings.get("host") or "").strip()
                    if not host:
                        continue
                    poll_seconds = max(5, int(settings.get("pollSeconds") or 15))
                    last = settings.get("_lastPoll", 0)
                    now = time.time()
                    if now - last < poll_seconds:
                        continue
                    settings["_lastPoll"] = now
                    try:
                        log(f"Polling context={context} every={poll_seconds}s")
                        is_on = await asyncio.to_thread(self.fetch_state, settings)
                        await self.update_visual_state(context, settings, is_on)
                    except Exception as exc:
                        log_exception(f"poll_loop failed [{context}]", exc)
            except asyncio.CancelledError:
                return
            except Exception as exc:
                log_exception("poll_loop outer error", exc)


async def main():
    def parse_cli_args(argv):
        # Stream Deck/StreamDock passes named flags, e.g.:
        # -port 12345 -pluginUUID ... -registerEvent ... -info ...
        # Keep a positional fallback for local/manual runs.
        if len(argv) >= 5 and not str(argv[1]).startswith("-"):
            return int(argv[1]), argv[2], argv[3], argv[4]

        args = {}
        i = 1
        while i < len(argv):
            key = argv[i]
            if not str(key).startswith("-") or i + 1 >= len(argv):
                i += 1
                continue
            args[key.lstrip("-")] = argv[i + 1]
            i += 2

        port_raw = args.get("port")
        plugin_uuid = args.get("pluginUUID")
        register_event = args.get("registerEvent")
        info = args.get("info")
        if not (port_raw and plugin_uuid and register_event and info is not None):
            raise ValueError(
                "Missing required args. Expected either positional "
                "<port> <uuid> <registerEvent> <info> or named flags "
                "-port/-pluginUUID/-registerEvent/-info."
            )
        return int(port_raw), plugin_uuid, register_event, info

    try:
        port, plugin_uuid, register_event, info = parse_cli_args(sys.argv)
    except Exception as exc:
        print(
            "Usage: plugin.py <port> <uuid> <registerEvent> <info> "
            "or plugin.py -port <port> -pluginUUID <uuid> "
            "-registerEvent <event> -info <json>"
        )
        log_exception("Invalid startup arguments", exc)
        sys.exit(1)

    log("=" * 60)
    log(f"Process starting argv={sys.argv}")
    log(f"Python version={sys.version}")
    log(f"Working directory={os.getcwd()}")

    plugin = ShellyPlugin(port, plugin_uuid, register_event, info)
    await plugin.connect()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log("Plugin terminated with KeyboardInterrupt")
    except Exception as exc:
        log_exception("Fatal error", exc)
        raise
