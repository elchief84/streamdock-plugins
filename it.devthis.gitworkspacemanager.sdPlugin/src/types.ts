export interface RepoSettings {
  repoPath: string;
  friendlyName?: string;
  customIcon?: string;
  refreshInterval: number;
  pullStrategy: 'merge' | 'rebase';
  autoFetch: boolean;
  autoReturn: boolean;
}

export interface RepoState {
  branch: string;
  ahead: number;
  behind: number;
  dirty: boolean;
  dirtyFiles: number;
  stagedFiles: number;
  conflicts: boolean;
  upstream: string | null;
  repoName: string;
  remoteUrl: string | null;
  detachedHead: boolean;
  mergeInProgress: boolean;
  rebaseInProgress: boolean;
  cherryPickInProgress: boolean;
  noUpstream: boolean;
  valid: boolean;
  error: string | null;
  lastFetch: number | null;
  statusLines: string[];
  logEntries: LogEntry[];
  logOffset: number;
}

export interface LogEntry {
  hash: string;
  author: string;
  message: string;
  date: string;
}

export type ActionType = 'fetch' | 'pull' | 'push' | 'sync' | 'status' | 'log' | 'folder' | 'back';

export type StatusColor = 'green' | 'blue' | 'yellow' | 'orange' | 'red' | 'gray';

export const DEFAULT_SETTINGS: RepoSettings = {
  repoPath: '',
  friendlyName: '',
  refreshInterval: 60,
  pullStrategy: 'merge',
  autoFetch: true,
  autoReturn: true,
};

export interface GlobalSettings {
  activeRepoContext: string | null;
  activeRepoPath: string | null;
}
