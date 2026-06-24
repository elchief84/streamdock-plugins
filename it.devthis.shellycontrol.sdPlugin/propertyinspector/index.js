let websocket = null;
let uuid = null;
let actionInfo = null;
let actionContext = null;
let piUuid = null;
let lastAction = "it.devthis.shellycontrol.toggle";
let pendingSaveTimer = null;

const ids = [
  "name", "host", "generation", "channelId", "command",
  "username", "password", "pollSeconds"
];

function getEl(id) { return document.getElementById(id); }

function setStatus(message, kind = "info") {
  const el = getEl("status");
  if (!el) return;
  el.textContent = message || "";
  el.dataset.kind = kind;
  el.style.display = message ? "block" : "none";
}

function withAutoHideStatus(message, kind = "info", delay = 2500) {
  setStatus(message, kind);
  window.clearTimeout(withAutoHideStatus._timer);
  withAutoHideStatus._timer = window.setTimeout(() => {
    const el = getEl("status");
    if (el && el.textContent === message) setStatus("");
  }, delay);
}

function getSettings() {
  return {
    save: true,
    _actionContext: actionContext || null,
    name: getEl("name").value.trim(),
    host: getEl("host").value.trim(),
    generation: getEl("generation").value,
    channelId: Number(getEl("channelId").value || 0),
    command: getEl("command").value,
    username: getEl("username").value,
    password: getEl("password").value,
    pollSeconds: Number(getEl("pollSeconds").value || 15)
  };
}

function setSettings(s = {}) {
  getEl("name").value = s.name || "";
  getEl("host").value = s.host || "";
  getEl("generation").value = s.generation || "gen2";
  getEl("channelId").value = s.channelId ?? 0;
  getEl("command").value = s.command || "toggle";
  getEl("username").value = s.username || "";
  getEl("password").value = s.password || "";
  getEl("pollSeconds").value = s.pollSeconds ?? 15;
  getEl("showStateInTitle").value = `${s.showStateInTitle !== false}`;
}

function sendToPlugin(payload) {
  if (!websocket || websocket.readyState !== 1 || (!actionContext && !piUuid)) return false;
  websocket.send(JSON.stringify({
    event: "sendToPlugin",
    action: (actionInfo && actionInfo.action) || lastAction,
    context: piUuid || actionContext,
    payload
  }));
  return true;
}

function requestSettings() {
  if (!websocket || websocket.readyState !== 1 || !actionContext) return;
  websocket.send(JSON.stringify({
    event: "getSettings",
    action: (actionInfo && actionInfo.action) || lastAction,
    context: actionContext
  }));
}

function saveNow() {
  const settings = getSettings();
  setStatus("Salvataggio in corso…", "pending");
  const sent = sendToPlugin(settings);
  window.clearTimeout(pendingSaveTimer);
  if (!sent) {
    setStatus("Salvataggio non inviato: context non disponibile", "error");
    return;
  }
  pendingSaveTimer = window.setTimeout(() => {
    const el = getEl("status");
    if (el && el.dataset.kind === "pending") {
      setStatus("Salvataggio non confermato dal plugin", "error");
    }
  }, 4000);
}

window.connectElgatoStreamDeckSocket = function(inPort, inUUID, inRegisterEvent, inInfo, inActionInfo) {
  uuid = inUUID;
  piUuid = inUUID;
  try {
    actionInfo = JSON.parse(inActionInfo || "{}");
  } catch {
    actionInfo = {};
  }
  actionContext = actionInfo.context || null;
  if (actionInfo.action) lastAction = actionInfo.action;
  websocket = new WebSocket(`ws://127.0.0.1:${inPort}`);

  websocket.onopen = () => {
    websocket.send(JSON.stringify({ event: inRegisterEvent, uuid: inUUID }));
    setStatus(`Connesso. Context: ${actionContext || "?"}`, "info");
    requestSettings();
  };

  websocket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (!actionContext && msg.context) {
      actionContext = msg.context;
      requestSettings();
    }
    if (msg.action) lastAction = msg.action;
    if (msg.event === "didReceiveSettings" && msg.context === actionContext) {
      setSettings((msg.payload && msg.payload.settings) || {});
      withAutoHideStatus("Impostazioni ricevute dal plugin", "ok", 1500);
    } else if (msg.event === "sendToPropertyInspector" && msg.context === actionContext) {
      const payload = msg.payload || {};
      window.clearTimeout(pendingSaveTimer);
      if (payload.settings) setSettings(payload.settings);
      if (payload.message) {
        withAutoHideStatus(payload.message, payload.ok ? "ok" : payload.kind || "info", 3000);
      }
    }
  };

  websocket.onerror = () => setStatus("Errore di connessione WebSocket", "error");
  websocket.onclose = () => setStatus("Connessione chiusa", "error");
};

document.getElementById("save").addEventListener("click", saveNow);
document.getElementById("reset").addEventListener("click", () => {
  setSettings({ generation: "gen2", command: "toggle", channelId: 0, pollSeconds: 15, showStateInTitle: true });
  withAutoHideStatus("Valori resettati localmente. Premi Salva.", "info", 2500);
});
ids.forEach((id) => getEl(id).addEventListener("change", () => saveNow()));
