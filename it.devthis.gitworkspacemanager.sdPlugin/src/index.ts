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

function getActiveRepoContext(): string | null {
  const gs = ensureGlobalSettings();
  return gs.activeRepoContext || null;
}

function getWatcherEntry(context: string): any {
  return watcher.getEntry(context) || null;
}

function updateButton(context: string, state: RepoState): void {
  const entry = getWatcherEntry(context);
  const settings: RepoSettings = entry?.settings || { ...DEFAULT_SETTINGS };
  const displayName = storage.getDisplayName(settings);
  const active = context === getActiveRepoContext();
  const svg = renderer.renderRepoButton(state, displayName, active);
  plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
}

function reRenderRepo(context: string): void {
  const state = watcher.getState(context);
  if (state) {
    updateButton(context, state);
  }
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
  },

  keyUp({ context, payload, device }: any) {
    log.info('repo keyUp', context);
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

function createSubAction(label: string, actionType: string | null): Actions {
  return new Actions({
    default: {},

    _willAppear({ context, payload }: any) {
      const repoPath = getActiveRepoPath();
      if (repoPath) {
        const name = repoPath.split(/[/\\]/).pop() || repoPath;
        const svg = renderer.renderActionWithRepo(label, name);
        plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
      } else {
        const svg = renderer.renderActionButton(label, '#4a4a4a');
        plugin.setImage(context, `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`);
      }
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

plugin.folder = new Actions({
  default: {},

  _willAppear({ context, payload }: any) {
    const repoPath = getActiveRepoPath();
    const svg = repoPath
      ? renderer.renderActionWithRepo('Folder', repoPath.split(/[/\\]/).pop() || repoPath)
      : renderer.renderActionButton('Folder', '#4a4a4a');
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

