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
exports.GitService = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs = __importStar(require("fs"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class GitService {
    gitPath;
    constructor(gitPath = 'git') {
        this.gitPath = gitPath;
    }
    async checkGitInstalled() {
        try {
            await execAsync(`"${this.gitPath}" --version`);
            return true;
        }
        catch {
            return false;
        }
    }
    async isValidRepo(repoPath) {
        try {
            await execAsync(`"${this.gitPath}" -C "${repoPath}" rev-parse --git-dir`);
            return true;
        }
        catch {
            return false;
        }
    }
    async getRepoName(repoPath) {
        try {
            const { stdout } = await execAsync(`"${this.gitPath}" -C "${repoPath}" rev-parse --show-toplevel`);
            const parts = stdout.trim().split(/[/\\]/);
            return parts[parts.length - 1];
        }
        catch {
            const parts = repoPath.split(/[/\\]/);
            return parts[parts.length - 1] || repoPath;
        }
    }
    async getCurrentBranch(repoPath) {
        try {
            const { stdout } = await execAsync(`"${this.gitPath}" -C "${repoPath}" rev-parse --abbrev-ref HEAD`);
            return stdout.trim();
        }
        catch {
            return 'unknown';
        }
    }
    async getAheadBehind(repoPath) {
        try {
            const { stdout } = await execAsync(`"${this.gitPath}" -C "${repoPath}" rev-list --left-right --count @{u}...HEAD 2>/dev/null`);
            const [behind, ahead] = stdout.trim().split('\t').map(Number);
            return { ahead: ahead || 0, behind: behind || 0 };
        }
        catch {
            return { ahead: 0, behind: 0 };
        }
    }
    async isDirty(repoPath) {
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
        }
        catch {
            return { dirty: false, dirtyFiles: 0, stagedFiles: 0 };
        }
    }
    async getRemoteUrl(repoPath) {
        try {
            const { stdout } = await execAsync(`"${this.gitPath}" -C "${repoPath}" remote get-url origin`);
            return stdout.trim();
        }
        catch {
            return null;
        }
    }
    async getUpstream(repoPath) {
        try {
            const { stdout } = await execAsync(`"${this.gitPath}" -C "${repoPath}" rev-parse --abbrev-ref @{u} 2>/dev/null`);
            return stdout.trim() || null;
        }
        catch {
            return null;
        }
    }
    async isDetachedHead(repoPath) {
        try {
            const { stdout } = await execAsync(`"${this.gitPath}" -C "${repoPath}" rev-parse --abbrev-ref HEAD`);
            return stdout.trim() === 'HEAD';
        }
        catch {
            return false;
        }
    }
    async hasConflicts(repoPath) {
        try {
            const { stdout } = await execAsync(`"${this.gitPath}" -C "${repoPath}" diff --name-only --diff-filter=U`);
            return stdout.trim().length > 0;
        }
        catch {
            return false;
        }
    }
    async isMergeInProgress(repoPath) {
        return this.fileExists(repoPath, '.git/MERGE_HEAD');
    }
    async isRebaseInProgress(repoPath) {
        return this.fileExists(repoPath, '.git/rebase-merge') || this.fileExists(repoPath, '.git/rebase-apply');
    }
    async isCherryPickInProgress(repoPath) {
        return this.fileExists(repoPath, '.git/CHERRY_PICK_HEAD');
    }
    fileExists(repoPath, relativePath) {
        return fs.existsSync(`${repoPath}/${relativePath}`);
    }
    async getStatus(repoPath) {
        try {
            const { stdout } = await execAsync(`"${this.gitPath}" -C "${repoPath}" status --short`);
            return stdout.trim().split('\n').filter(l => l.length > 0);
        }
        catch {
            return [];
        }
    }
    async fetch(repoPath) {
        try {
            await execAsync(`"${this.gitPath}" -C "${repoPath}" fetch --quiet`, { timeout: 30000 });
            return { success: true };
        }
        catch (e) {
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
    async pull(repoPath, strategy) {
        try {
            const cmd = strategy === 'rebase'
                ? `"${this.gitPath}" -C "${repoPath}" pull --rebase`
                : `"${this.gitPath}" -C "${repoPath}" pull`;
            await execAsync(cmd, { timeout: 60000 });
            return { success: true };
        }
        catch (e) {
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
    async push(repoPath) {
        try {
            await execAsync(`"${this.gitPath}" -C "${repoPath}" push`, { timeout: 60000 });
            return { success: true };
        }
        catch (e) {
            const stderr = e.stderr || e.message || '';
            if (stderr.includes('rejected') || stderr.includes('non-fast-forward')) {
                return { success: false, error: 'Push rejected - pull first' };
            }
            return { success: false, error: stderr.trim() || 'Push failed' };
        }
    }
    isNoUpstream(ahead, behind, upstream) {
        return upstream === null;
    }
    async getState(repoPath) {
        const invalidState = {
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
        const [branch, aheadBehind, dirtyResult, remoteUrl, upstream, detachedHead, conflicts, mergeInProgress, rebaseInProgress, cherryPickInProgress, repoName, statusLines,] = await Promise.all([
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
exports.GitService = GitService;
