"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const plugin_1 = require("./utils/plugin");
const GitService_1 = require("./services/GitService");
const RepositoryWatcher_1 = require("./services/RepositoryWatcher");
const SettingsStorage_1 = require("./modules/SettingsStorage");
const ImageRenderer_1 = require("./modules/ImageRenderer");
const types_1 = require("./types");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const plugin = new plugin_1.Plugins('gitworkspacemanager');
const git = new GitService_1.GitService();
const watcher = new RepositoryWatcher_1.RepositoryWatcher(git);
const storage = new SettingsStorage_1.SettingsStorage(types_1.DEFAULT_SETTINGS);
const renderer = new ImageRenderer_1.ImageRenderer();
function ensureGlobalSettings() {
    if (!plugin_1.Plugins.globalSettings || typeof plugin_1.Plugins.globalSettings !== 'object') {
        plugin_1.Plugins.globalSettings = { activeRepoContext: null, activeRepoPath: null };
    }
    const gs = plugin_1.Plugins.globalSettings;
    if (!gs.activeRepoContext)
        gs.activeRepoContext = null;
    if (!gs.activeRepoPath)
        gs.activeRepoPath = null;
    return gs;
}
function setActiveRepo(context, repoPath) {
    const gs = ensureGlobalSettings();
    gs.activeRepoContext = context;
    gs.activeRepoPath = repoPath;
    plugin.setGlobalSettings(gs);
}
function getActiveRepoPath() {
    const gs = ensureGlobalSettings();
    return gs.activeRepoPath || null;
}
function getActiveRepoContext() {
    const gs = ensureGlobalSettings();
    return gs.activeRepoContext || null;
}
function getWatcherEntry(context) {
    return watcher.getEntry(context) || null;
}
function updateButton(context, state) {
    const entry = getWatcherEntry(context);
    const settings = entry?.settings || { ...types_1.DEFAULT_SETTINGS };
    const displayName = storage.getDisplayName(settings);
    const active = context === getActiveRepoContext();
    const svg = renderer.renderRepoButton(state, displayName, active);
    plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
}
function reRenderRepo(context) {
    const state = watcher.getState(context);
    if (state) {
        updateButton(context, state);
    }
}
plugin.repo = new plugin_1.Actions({
    default: { ...types_1.DEFAULT_SETTINGS },
    _willAppear({ context, payload }) {
        const settings = storage.validate(payload.settings || {});
        plugin_1.log.info('repo willAppear', context, settings.repoPath);
        watcher.register(context, settings, (ctx, state) => {
            updateButton(ctx, state);
        });
    },
    _willDisappear({ context }) {
        plugin_1.log.info('repo willDisappear', context);
        watcher.unregister(context);
    },
    _didReceiveSettings({ context, payload }) {
        const settings = storage.validate(payload.settings || {});
        plugin_1.log.info('repo didReceiveSettings', context, settings.repoPath);
        watcher.register(context, settings, (ctx, state) => {
            updateButton(ctx, state);
        });
    },
    _propertyInspectorDidAppear({ context }) {
        const entry = getWatcherEntry(context);
        if (entry) {
            plugin.sendToPropertyInspector({
                settings: entry.settings,
                ok: true,
            });
        }
    },
    sendToPlugin({ payload, context }) {
    },
    keyUp({ context, payload, device }) {
        plugin_1.log.info('repo keyUp', context);
        const state = watcher.getState(context);
        const entry = getWatcherEntry(context);
        if (!state || !state.valid) {
            plugin.showAlert(context);
            watcher.refresh(context);
            return;
        }
        if (entry) {
            const oldContext = getActiveRepoContext();
            setActiveRepo(context, entry.settings.repoPath);
            plugin.showOk(context);
            if (oldContext && oldContext !== context) {
                reRenderRepo(oldContext);
            }
            reRenderRepo(context);
            setTimeout(() => {
                watcher.refresh(context);
            }, 100);
        }
    },
});
function createSubAction(label, actionType) {
    return new plugin_1.Actions({
        default: {},
        _willAppear({ context, payload }) {
            const repoPath = getActiveRepoPath();
            if (repoPath) {
                const name = repoPath.split(/[/\\]/).pop() || repoPath;
                const svg = renderer.renderActionWithRepo(label, name);
                plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
            }
            else {
                const svg = renderer.renderActionButton(label, '#4a4a4a');
                plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
            }
        },
        _willDisappear({ context }) { },
        keyUp({ context, payload }) {
            const repoPath = getActiveRepoPath();
            if (!repoPath) {
                const svg = renderer.renderError('No repo');
                plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
                plugin.showAlert(context);
                return;
            }
            if (actionType) {
                const loadingSvg = renderer.renderLoading(label);
                plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(loadingSvg)}`);
                watcher.executeActionOnRepo(repoPath, actionType).then((result) => {
                    if (result.success) {
                        const svg = renderer.renderSuccess(label);
                        plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
                        plugin.showOk(context);
                    }
                    else {
                        const svg = renderer.renderError(result.error || 'Failed');
                        plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
                        plugin.showAlert(context);
                    }
                }).catch(() => {
                    const svg = renderer.renderError('Error');
                    plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
                    plugin.showAlert(context);
                });
            }
        },
    });
}
plugin.fetch = createSubAction('Fetch', 'fetch');
plugin.pull = createSubAction('Pull', 'pull');
plugin.push = createSubAction('Push', 'push');
plugin.sync = createSubAction('Sync', 'sync');
const logAction = Object.assign(new plugin_1.Actions({
    default: {},
    _willAppear({ context, payload }) {
        const repoPath = getActiveRepoPath();
        const svg = repoPath
            ? renderer.renderActionWithRepo('Log', repoPath.split(/[/\\]/).pop() || repoPath)
            : renderer.renderActionButton('Log', '#4a4a4a');
        plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
        logAction.logOffset = 0;
    },
    _willDisappear({ context }) { },
    keyUp({ context, payload }) {
        const repoPath = getActiveRepoPath();
        if (!repoPath) {
            const svg = renderer.renderError('No repo');
            plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
            plugin.showAlert(context);
            return;
        }
        const loadingSvg = renderer.renderLoading('Log');
        plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(loadingSvg)}`);
        git.getLog(repoPath, 5, logAction.logOffset || 0).then((entries) => {
            const svg = renderer.renderLog(entries, logAction.logOffset || 0);
            plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
        }).catch(() => {
            const svg = renderer.renderError('Error');
            plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
            plugin.showAlert(context);
        });
    },
    dialRotate({ context, payload }) {
        const ticks = payload.ticks || 0;
        if (ticks > 0) {
            logAction.logOffset = Math.max(0, (logAction.logOffset || 0) - 5);
        }
        else if (ticks < 0) {
            logAction.logOffset = (logAction.logOffset || 0) + 5;
        }
        const repoPath = getActiveRepoPath();
        if (!repoPath)
            return;
        git.getLog(repoPath, 5, logAction.logOffset || 0).then((entries) => {
            const svg = renderer.renderLog(entries, logAction.logOffset || 0);
            plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
        }).catch(() => { });
    },
}), { logOffset: 0 });
plugin.log = logAction;
plugin.status = new plugin_1.Actions({
    default: {},
    _willAppear({ context, payload }) {
        const repoPath = getActiveRepoPath();
        const svg = repoPath
            ? renderer.renderActionWithRepo('Status', repoPath.split(/[/\\]/).pop() || repoPath)
            : renderer.renderActionButton('Status', '#4a4a4a');
        plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
    },
    _willDisappear({ context }) { },
    keyUp({ context, payload }) {
        const repoPath = getActiveRepoPath();
        if (!repoPath) {
            const svg = renderer.renderError('No repo');
            plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
            plugin.showAlert(context);
            return;
        }
        const loadingSvg = renderer.renderLoading('Status');
        plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(loadingSvg)}`);
        git.getState(repoPath).then((state) => {
            const svg = renderer.renderStatus(state);
            plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
        }).catch(() => {
            const svg = renderer.renderError('Error');
            plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
            plugin.showAlert(context);
        });
    },
});
plugin.folder = new plugin_1.Actions({
    default: {},
    _willAppear({ context, payload }) {
        const repoPath = getActiveRepoPath();
        const svg = repoPath
            ? renderer.renderActionWithRepo('Folder', repoPath.split(/[/\\]/).pop() || repoPath)
            : renderer.renderActionButton('Folder', '#4a4a4a');
        plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
    },
    _willDisappear({ context }) { },
    keyUp({ context, payload }) {
        const repoPath = getActiveRepoPath();
        if (!repoPath) {
            const svg = renderer.renderError('No repo');
            plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
            plugin.showAlert(context);
            return;
        }
        const resolvedPath = path.resolve(repoPath);
        if (fs.existsSync(resolvedPath)) {
            plugin.openUrl(`file://${resolvedPath}`);
            plugin.showOk(context);
        }
        else {
            const svg = renderer.renderError('Not found');
            plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
            plugin.showAlert(context);
        }
    },
});
plugin.back = new plugin_1.Actions({
    default: {},
    _willAppear({ context, payload }) {
        const repoPath = getActiveRepoPath();
        const svg = repoPath
            ? renderer.renderActionWithRepo('Back', repoPath.split(/[/\\]/).pop() || repoPath)
            : renderer.renderActionButton('Back', '#4a4a4a');
        plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
    },
    _willDisappear({ context }) { },
    keyUp({ context, payload }) {
        plugin.showOk(context);
    },
});
