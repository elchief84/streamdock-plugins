import { Plugins, Actions, log } from './utils/plugin';
import { GitService } from './services/GitService';
import { RepositoryWatcher } from './services/RepositoryWatcher';
import { SettingsStorage } from './modules/SettingsStorage';
import { ImageRenderer } from './modules/ImageRenderer';
import { DEFAULT_SETTINGS, GlobalSettings, RepoSettings, RepoState } from './types';
import * as path from 'path';
import * as fs from 'fs';

const plugin = new Plugins('gitworkspacemanager');
const git = new GitService();
const watcher = new RepositoryWatcher(git);
const storage = new SettingsStorage(DEFAULT_SETTINGS);
const renderer = new ImageRenderer();

function ensureGlobalSettings(): GlobalSettings {
  if (!Plugins.globalSettings || typeof Plugins.globalSettings !== 'object') {
    Plugins.globalSettings = { activeRepoContext: null, activeRepoPath: null };
  }
  const gs = Plugins.globalSettings;
  if (!gs.activeRepoContext) gs.activeRepoContext = null;
  if (!gs.activeRepoPath) gs.activeRepoPath = null;
  return gs as GlobalSettings;
}

function setActiveRepo(context: string, repoPath: string): void {
  const gs = ensureGlobalSettings();
  gs.activeRepoContext = context;
  gs.activeRepoPath = repoPath;
  plugin.setGlobalSettings(gs);
}

function getActiveRepoPath(): string | null {
  const gs = ensureGlobalSettings();
  return gs.activeRepoPath || null;
}

function getWatcherEntry(context: string): any {
  return watcher.getEntry(context) || null;
}

function updateButton(context: string, state: RepoState): void {
  const entry = getWatcherEntry(context);
  const settings: RepoSettings = entry?.settings || { ...DEFAULT_SETTINGS };
  const displayName = storage.getDisplayName(settings);
  const svg = renderer.renderRepoButton(state, displayName);
  plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
}

plugin.repo = new Actions({
  default: { ...DEFAULT_SETTINGS },

  _willAppear({ context, payload }: any) {
    const settings = storage.validate(payload.settings || {});
    log.info('repo willAppear', context, settings.repoPath);

    watcher.register(context, settings, (ctx: string, state: RepoState) => {
      updateButton(ctx, state);
    });
  },

  _willDisappear({ context }: any) {
    log.info('repo willDisappear', context);
    watcher.unregister(context);
  },

  _didReceiveSettings({ context, payload }: any) {
    const settings = storage.validate(payload.settings || {});
    log.info('repo didReceiveSettings', context, settings.repoPath);

    watcher.register(context, settings, (ctx: string, state: RepoState) => {
      updateButton(ctx, state);
    });
  },

  _propertyInspectorDidAppear({ context }: any) {
    const entry = getWatcherEntry(context);
    if (entry) {
      plugin.sendToPropertyInspector({
        settings: entry.settings,
        ok: true,
      });
    }
  },

  sendToPlugin({ payload, context }: any) {
    if (payload.save) {
      const settings = storage.validate(payload);
      log.info('repo sendToPlugin save', context, settings.repoPath);
      plugin.setSettings(context, settings);
    }
  },

  keyUp({ context, payload }: any) {
    log.info('repo keyUp', context);
    const state = watcher.getState(context);
    const entry = getWatcherEntry(context);
    if (!state || !state.valid) {
      plugin.showAlert(context);
      watcher.refresh(context);
      return;
    }

    if (entry) {
      setActiveRepo(context, entry.settings.repoPath);
      plugin.showOk(context);
      setTimeout(() => {
        watcher.refresh(context);
      }, 100);
    }
  },
});

function createSubAction(label: string, actionType: string | null): Actions {
  return new Actions({
    default: {},

    _willAppear({ context, payload }: any) {
      const svg = renderer.renderActionButton(label);
      plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
    },

    _willDisappear({ context }: any) {},

    keyUp({ context, payload }: any) {
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

        watcher.executeActionOnRepo(repoPath, actionType as any).then((result) => {
          if (result.success) {
            const svg = renderer.renderSuccess(label);
            plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
            plugin.showOk(context);
          } else {
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

interface LogAction extends Actions {
  logOffset: number;
}

const logAction: LogAction = Object.assign(new Actions({
  default: {},

  _willAppear({ context, payload }: any) {
    const svg = renderer.renderActionButton('Log');
    plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
    (logAction as any).logOffset = 0;
  },

  _willDisappear({ context }: any) {},

  keyUp({ context, payload }: any) {
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

  dialRotate({ context, payload }: any) {
    const ticks = payload.ticks || 0;
    if (ticks > 0) {
      logAction.logOffset = Math.max(0, (logAction.logOffset || 0) - 5);
    } else if (ticks < 0) {
      logAction.logOffset = (logAction.logOffset || 0) + 5;
    }

    const repoPath = getActiveRepoPath();
    if (!repoPath) return;

    git.getLog(repoPath, 5, logAction.logOffset || 0).then((entries) => {
      const svg = renderer.renderLog(entries, logAction.logOffset || 0);
      plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
    }).catch(() => {});
  },
}), { logOffset: 0 });

plugin.log = logAction;

plugin.status = new Actions({
  default: {},

  _willAppear({ context, payload }: any) {
    const svg = renderer.renderActionButton('Status');
    plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
  },

  _willDisappear({ context }: any) {},

  keyUp({ context, payload }: any) {
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

plugin.folder = new Actions({
  default: {},

  _willAppear({ context, payload }: any) {
    const svg = renderer.renderActionButton('Folder');
    plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
  },

  _willDisappear({ context }: any) {},

  keyUp({ context, payload }: any) {
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
    } else {
      const svg = renderer.renderError('Not found');
      plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
      plugin.showAlert(context);
    }
  },
});

plugin.back = new Actions({
  default: {},

  _willAppear({ context, payload }: any) {
    const svg = renderer.renderActionButton('Back');
    plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
  },

  _willDisappear({ context }: any) {},

  keyUp({ context, payload }: any) {
    plugin.showOk(context);
  },
});
