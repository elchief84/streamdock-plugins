import { GitService } from './GitService';
import { RepoSettings, RepoState } from '../types';

interface WatcherEntry {
  context: string;
  settings: RepoSettings;
  state: RepoState;
  timer: NodeJS.Timeout | null;
  callback: (context: string, state: RepoState) => void;
}

export class RepositoryWatcher {
  private git: GitService;
  private watchers: Map<string, WatcherEntry> = new Map();

  constructor(git: GitService) {
    this.git = git;
  }

  getEntry(context: string): WatcherEntry | undefined {
    return this.watchers.get(context);
  }

  register(context: string, settings: RepoSettings, callback: (context: string, state: RepoState) => void): void {
    this.unregister(context);

    const entry: WatcherEntry = {
      context,
      settings,
      state: this.emptyState(),
      timer: null,
      callback,
    };

    this.watchers.set(context, entry);

    if (settings.autoFetch && settings.repoPath) {
      this.startPolling(entry);
    }

    this.refresh(context);
  }

  unregister(context: string): void {
    const entry = this.watchers.get(context);
    if (entry?.timer) {
      clearInterval(entry.timer);
      entry.timer = null;
    }
    this.watchers.delete(context);
  }

  async refresh(context: string): Promise<RepoState> {
    const entry = this.watchers.get(context);
    if (!entry || !entry.settings.repoPath) {
      const empty = this.emptyState();
      entry?.callback(context, empty);
      return empty;
    }

    const gitInstalled = await this.git.checkGitInstalled();
    if (!gitInstalled) {
      const state = this.emptyState();
      state.error = 'Git not found';
      state.repoName = entry.settings.repoPath.split(/[/\\]/).pop() || '?';
      entry.state = state;
      entry.callback(context, state);
      return state;
    }

    const isValid = await this.git.isValidRepo(entry.settings.repoPath);
    if (!isValid) {
      const state = this.emptyState();
      state.error = 'Repository not found';
      state.repoName = entry.settings.repoPath.split(/[/\\]/).pop() || '?';
      entry.state = state;
      entry.callback(context, state);
      return state;
    }

    if (entry.settings.autoFetch) {
      const fetchResult = await this.git.fetch(entry.settings.repoPath);
      if (!fetchResult.success) {
        const state = this.emptyState();
        state.error = fetchResult.error || 'Fetch failed';
        state.repoName = await this.git.getRepoName(entry.settings.repoPath);
        state.valid = true;
        entry.state = state;
        entry.callback(context, state);
        return state;
      }
    }

    const state = await this.git.getState(entry.settings.repoPath);
    state.lastFetch = entry.settings.autoFetch ? Date.now() : null;
    entry.state = state;
    entry.callback(context, state);
    return state;
  }

  async executeActionOnRepo(
    repoPath: string,
    action: 'fetch' | 'pull' | 'push' | 'sync',
    pullStrategy: 'merge' | 'rebase' = 'merge'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      switch (action) {
        case 'fetch':
          return await this.git.fetch(repoPath);
        case 'pull':
          return await this.git.pull(repoPath, pullStrategy);
        case 'push':
          return await this.git.push(repoPath);
        case 'sync': {
          const fetchResult = await this.git.fetch(repoPath);
          if (!fetchResult.success) return fetchResult;

          const state = await this.git.getState(repoPath);
          if (state.behind > 0) {
            const pullResult = await this.git.pull(repoPath, pullStrategy);
            if (!pullResult.success) return pullResult;
          }
          if (state.ahead > 0) {
            const pushResult = await this.git.push(repoPath);
            if (!pushResult.success) return pushResult;
          }
          return { success: true };
        }
        default:
          return { success: false, error: 'Unknown action' };
      }
    } catch (e: any) {
      return { success: false, error: e.message || 'Action failed' };
    }
  }

  getRepoPath(context: string): string | null {
    return this.watchers.get(context)?.settings.repoPath || null;
  }

  getRepoSettings(context: string): RepoSettings | null {
    return this.watchers.get(context)?.settings || null;
  }

  getState(context: string): RepoState | null {
    return this.watchers.get(context)?.state || null;
  }

  async loadLog(context: string, offset: number = 0): Promise<void> {
    const entry = this.watchers.get(context);
    if (!entry || !entry.settings.repoPath) return;

    const entries = await this.git.getLog(entry.settings.repoPath, 5, offset);
    entry.state.logEntries = entries;
    entry.state.logOffset = offset;
    entry.callback(context, entry.state);
  }

  private startPolling(entry: WatcherEntry): void {
    const intervalMs = Math.max(entry.settings.refreshInterval, 5) * 1000;
    entry.timer = setInterval(() => {
      this.refresh(entry.context);
    }, intervalMs);
  }

  private emptyState(): RepoState {
    return {
      branch: '', ahead: 0, behind: 0, dirty: false, dirtyFiles: 0,
      stagedFiles: 0, conflicts: false, upstream: null, repoName: '',
      remoteUrl: null, detachedHead: false, mergeInProgress: false,
      rebaseInProgress: false, cherryPickInProgress: false, noUpstream: false,
      valid: false, error: null, lastFetch: null, statusLines: [],
      logEntries: [], logOffset: 0,
    };
  }
}
