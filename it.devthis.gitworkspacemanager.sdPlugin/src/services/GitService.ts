import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import { RepoState } from '../types';

const execAsync = promisify(exec);

export class GitService {
  private gitPath: string;

  constructor(gitPath: string = 'git') {
    this.gitPath = gitPath;
  }

  async checkGitInstalled(): Promise<boolean> {
    try {
      await execAsync(`"${this.gitPath}" --version`);
      return true;
    } catch {
      return false;
    }
  }

  async isValidRepo(repoPath: string): Promise<boolean> {
    try {
      await execAsync(`"${this.gitPath}" -C "${repoPath}" rev-parse --git-dir`);
      return true;
    } catch {
      return false;
    }
  }

  async getRepoName(repoPath: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`"${this.gitPath}" -C "${repoPath}" rev-parse --show-toplevel`);
      const parts = stdout.trim().split(/[/\\]/);
      return parts[parts.length - 1];
    } catch {
      const parts = repoPath.split(/[/\\]/);
      return parts[parts.length - 1] || repoPath;
    }
  }

  async getCurrentBranch(repoPath: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`"${this.gitPath}" -C "${repoPath}" rev-parse --abbrev-ref HEAD`);
      return stdout.trim();
    } catch {
      return 'unknown';
    }
  }

  async getAheadBehind(repoPath: string): Promise<{ ahead: number; behind: number }> {
    try {
      const { stdout } = await execAsync(
        `"${this.gitPath}" -C "${repoPath}" rev-list --left-right --count @{u}...HEAD 2>/dev/null`
      );
      const [behind, ahead] = stdout.trim().split('\t').map(Number);
      return { ahead: ahead || 0, behind: behind || 0 };
    } catch {
      return { ahead: 0, behind: 0 };
    }
  }

  async isDirty(repoPath: string): Promise<{ dirty: boolean; dirtyFiles: number; stagedFiles: number }> {
    try {
      const { stdout } = await execAsync(`"${this.gitPath}" -C "${repoPath}" status --porcelain`);
      const lines = stdout.trim().split('\n').filter(l => l.length > 0);
      const staged = lines.filter(l => !l.startsWith(' ') && !l.startsWith('?')).length;
      const unstaged = lines.filter(l => l[1] !== ' ').length;
      return {
        dirty: lines.length > 0,
        dirtyFiles: lines.length,
        stagedFiles: staged,
      };
    } catch {
      return { dirty: false, dirtyFiles: 0, stagedFiles: 0 };
    }
  }

  async getRemoteUrl(repoPath: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync(`"${this.gitPath}" -C "${repoPath}" remote get-url origin`);
      return stdout.trim();
    } catch {
      return null;
    }
  }

  async getUpstream(repoPath: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync(
        `"${this.gitPath}" -C "${repoPath}" rev-parse --abbrev-ref @{u} 2>/dev/null`
      );
      return stdout.trim() || null;
    } catch {
      return null;
    }
  }

  async isDetachedHead(repoPath: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`"${this.gitPath}" -C "${repoPath}" rev-parse --abbrev-ref HEAD`);
      return stdout.trim() === 'HEAD';
    } catch {
      return false;
    }
  }

  async hasConflicts(repoPath: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`"${this.gitPath}" -C "${repoPath}" diff --name-only --diff-filter=U`);
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  async isMergeInProgress(repoPath: string): Promise<boolean> {
    return this.fileExists(repoPath, '.git/MERGE_HEAD');
  }

  async isRebaseInProgress(repoPath: string): Promise<boolean> {
    return this.fileExists(repoPath, '.git/rebase-merge') || this.fileExists(repoPath, '.git/rebase-apply');
  }

  async isCherryPickInProgress(repoPath: string): Promise<boolean> {
    return this.fileExists(repoPath, '.git/CHERRY_PICK_HEAD');
  }

  private fileExists(repoPath: string, relativePath: string): boolean {
    return fs.existsSync(`${repoPath}/${relativePath}`);
  }

  async getStatus(repoPath: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync(`"${this.gitPath}" -C "${repoPath}" status --short`);
      return stdout.trim().split('\n').filter(l => l.length > 0);
    } catch {
      return [];
    }
  }

  async fetch(repoPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      await execAsync(`"${this.gitPath}" -C "${repoPath}" fetch --quiet`, { timeout: 30000 });
      return { success: true };
    } catch (e: any) {
      const stderr = e.stderr || e.message || '';
      if (stderr.includes('Could not resolve host') || stderr.includes('unable to connect') || stderr.includes('Network')) {
        return { success: false, error: 'Network error' };
      }
      if (stderr.includes('Permission denied') || stderr.includes('Authentication failed') || stderr.includes('could not read')) {
        return { success: false, error: 'Auth error' };
      }
      if (stderr.includes('timed out')) {
        return { success: false, error: 'Timeout' };
      }
      return { success: false, error: stderr.trim() || 'Fetch failed' };
    }
  }

  async pull(repoPath: string, strategy: 'merge' | 'rebase'): Promise<{ success: boolean; error?: string }> {
    try {
      const cmd = strategy === 'rebase'
        ? `"${this.gitPath}" -C "${repoPath}" pull --rebase`
        : `"${this.gitPath}" -C "${repoPath}" pull`;
      await execAsync(cmd, { timeout: 60000 });
      return { success: true };
    } catch (e: any) {
      const stderr = e.stderr || e.message || '';
      if (stderr.includes('CONFLICT') || stderr.includes('conflict')) {
        return { success: false, error: 'Merge conflicts' };
      }
      if (stderr.includes('not a git repository')) {
        return { success: false, error: 'Repository not found' };
      }
      return { success: false, error: stderr.trim() || 'Pull failed' };
    }
  }

  async push(repoPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      await execAsync(`"${this.gitPath}" -C "${repoPath}" push`, { timeout: 60000 });
      return { success: true };
    } catch (e: any) {
      const stderr = e.stderr || e.message || '';
      if (stderr.includes('rejected') || stderr.includes('non-fast-forward')) {
        return { success: false, error: 'Push rejected - pull first' };
      }
      return { success: false, error: stderr.trim() || 'Push failed' };
    }
  }

  isNoUpstream(ahead: number, behind: number, upstream: string | null): boolean {
    return upstream === null;
  }

  async getState(repoPath: string): Promise<RepoState> {
    const invalidState: RepoState = {
      branch: '', ahead: 0, behind: 0, dirty: false, dirtyFiles: 0,
      stagedFiles: 0, conflicts: false, upstream: null, repoName: '',
      remoteUrl: null, detachedHead: false, mergeInProgress: false,
      rebaseInProgress: false, cherryPickInProgress: false, noUpstream: false,
      valid: false, error: 'Repository not found', lastFetch: null,
      statusLines: [],
    };

    const isValid = await this.isValidRepo(repoPath);
    if (!isValid) {
      return { ...invalidState, repoName: repoPath.split(/[/\\]/).pop() || repoPath };
    }

    const [
      branch,
      aheadBehind,
      dirtyResult,
      remoteUrl,
      upstream,
      detachedHead,
      conflicts,
      mergeInProgress,
      rebaseInProgress,
      cherryPickInProgress,
      repoName,
      statusLines,
    ] = await Promise.all([
      this.getCurrentBranch(repoPath),
      this.getAheadBehind(repoPath),
      this.isDirty(repoPath),
      this.getRemoteUrl(repoPath),
      this.getUpstream(repoPath),
      this.isDetachedHead(repoPath),
      this.hasConflicts(repoPath),
      this.isMergeInProgress(repoPath),
      this.isRebaseInProgress(repoPath),
      this.isCherryPickInProgress(repoPath),
      this.getRepoName(repoPath),
      this.getStatus(repoPath),
    ]);

    return {
      branch,
      ahead: aheadBehind.ahead,
      behind: aheadBehind.behind,
      dirty: dirtyResult.dirty,
      dirtyFiles: dirtyResult.dirtyFiles,
      stagedFiles: dirtyResult.stagedFiles,
      conflicts,
      upstream,
      repoName,
      remoteUrl,
      detachedHead,
      mergeInProgress,
      rebaseInProgress,
      cherryPickInProgress,
      noUpstream: upstream === null,
      valid: true,
      error: null,
      lastFetch: null,
      statusLines,
    };
  }
}
