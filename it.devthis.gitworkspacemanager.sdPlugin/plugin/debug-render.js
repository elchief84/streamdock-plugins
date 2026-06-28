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
const ImageRenderer_1 = require("./modules/ImageRenderer");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const renderer = new ImageRenderer_1.ImageRenderer();
function makeState(overrides = {}) {
    return {
        branch: 'main',
        ahead: 0,
        behind: 0,
        dirty: false,
        dirtyFiles: 0,
        stagedFiles: 0,
        conflicts: false,
        upstream: 'origin/main',
        repoName: 'my-project',
        remoteUrl: 'git@github.com:user/repo.git',
        detachedHead: false,
        mergeInProgress: false,
        rebaseInProgress: false,
        cherryPickInProgress: false,
        noUpstream: false,
        valid: true,
        error: null,
        lastFetch: Date.now(),
        statusLines: [],
        ...overrides,
    };
}
const scenarios = [
    { label: 'Synced (green)', svg: renderer.renderRepoButton(makeState({ repoName: 'backend', branch: 'main', ahead: 0, behind: 0 }), 'backend') },
    { label: 'Needs push (blue)', svg: renderer.renderRepoButton(makeState({ repoName: 'api', branch: 'feature/login', ahead: 3, behind: 0 }), 'api') },
    { label: 'Needs pull (yellow)', svg: renderer.renderRepoButton(makeState({ repoName: 'frontend', branch: 'develop', ahead: 0, behind: 5 }), 'frontend') },
    { label: 'Both directions', svg: renderer.renderRepoButton(makeState({ repoName: 'core', branch: 'feature/api', ahead: 2, behind: 6 }), 'core') },
    { label: 'Dirty (orange)', svg: renderer.renderRepoButton(makeState({ repoName: 'auth-svc', branch: 'feature/auth', ahead: 1, behind: 0, dirty: true, dirtyFiles: 3 }), 'auth-svc') },
    { label: 'No upstream (blue)', svg: renderer.renderRepoButton(makeState({ repoName: 'new-project', branch: 'main', ahead: 1, behind: 0, noUpstream: true, upstream: null }), 'new-project') },
    { label: 'Detached HEAD (gray)', svg: renderer.renderRepoButton(makeState({ repoName: 'legacy', branch: 'HEAD', detachedHead: true }), 'legacy') },
    { label: 'Merge in progress', svg: renderer.renderRepoButton(makeState({ repoName: 'merge-test', mergeInProgress: true }), 'merge-test') },
    { label: 'Rebase in progress', svg: renderer.renderRepoButton(makeState({ repoName: 'rebase-test', rebaseInProgress: true }), 'rebase-test') },
    { label: 'Cherry-pick progress', svg: renderer.renderRepoButton(makeState({ repoName: 'cherry-test', cherryPickInProgress: true }), 'cherry-test') },
    { label: 'Conflicts (red)', svg: renderer.renderRepoButton(makeState({ repoName: 'conflict', branch: 'merge/broken', conflicts: true, dirty: true }), 'conflict') },
    { label: 'Git not found (red)', svg: renderer.renderRepoButton(makeState({ valid: false, error: 'Git not found', repoName: 'backend' }), 'backend') },
    { label: 'Repo not found (red)', svg: renderer.renderRepoButton(makeState({ valid: false, error: 'Repository not found', repoName: 'deleted-repo' }), 'deleted-repo') },
    { label: 'Auth error (red)', svg: renderer.renderRepoButton(makeState({ valid: true, error: 'Auth error', repoName: 'private-repo', branch: '' }), 'private-repo') },
    { label: 'Network error (red)', svg: renderer.renderRepoButton(makeState({ valid: true, error: 'Network error', repoName: 'offline-repo', branch: '' }), 'offline-repo') },
    { label: 'Unconfigured (red)', svg: renderer.renderRepoButton(makeState({ valid: false, error: null, repoName: '' }), 'Config?') },
    { label: 'Long name trunc', svg: renderer.renderRepoButton(makeState({ repoName: 'very-long-repository-name', branch: 'feature/super-long-branch-name-v2' }), 'very-long-rep..') },
    { label: 'Action: Fetch', svg: renderer.renderActionButton('Fetch') },
    { label: 'Action: Pull', svg: renderer.renderActionButton('Pull') },
    { label: 'Action: Push', svg: renderer.renderActionButton('Push') },
    { label: 'Action: Sync', svg: renderer.renderActionButton('Sync') },
    { label: 'Action: Status', svg: renderer.renderActionButton('Status') },
    { label: 'Action: Log', svg: renderer.renderActionButton('Log') },
    { label: 'Action: Folder', svg: renderer.renderActionButton('Folder') },
    { label: 'Action: Back', svg: renderer.renderActionButton('Back') },
    { label: 'Success check', svg: renderer.renderSuccess('Synced') },
    { label: 'Error cross', svg: renderer.renderError('Failed') },
    { label: 'Loading dots', svg: renderer.renderLoading('Fetching') },
    { label: 'Action+Repo: Fetch on my-proj', svg: renderer.renderActionWithRepo('Fetch', 'my-project') },
    { label: 'Action+Repo: Pull on backend', svg: renderer.renderActionWithRepo('Pull', 'backend') },
    { label: 'Action+Repo: Sync on api', svg: renderer.renderActionWithRepo('Sync', 'api') },
    { label: 'Active repo border (white)', svg: renderer.renderRepoButton(makeState({ repoName: 'backend', branch: 'main' }), 'backend', true) },
];
let html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>ImageRenderer Debug</title>
<style>
  body { background: #1a1a1a; color: #e0e0e0; font-family: -apple-system, sans-serif; padding: 20px; }
  h1 { font-size: 20px; margin-bottom: 20px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
  .card { background: #2a2a2a; border-radius: 8px; padding: 12px; text-align: center; }
  .card img { width: 100%; max-width: 200px; border-radius: 4px; }
  .card .label { margin-top: 8px; font-size: 11px; color: #888; text-transform: uppercase; }
</style></head><body>
<h1>ImageRenderer Debug — ${scenarios.length} scenarios</h1>
<div class="grid">
`;
for (const s of scenarios) {
    html += `<div class="card">
  <img src="data:image/svg+xml;charset=utf8,${encodeURIComponent(s.svg)}" />
  <div class="label">${s.label}</div>
</div>\n`;
}
html += '</div></body></html>';
const outPath = path.join(__dirname, '..', 'debug-render.html');
fs.writeFileSync(outPath, html);
console.log(`Written ${scenarios.length} scenarios to ${outPath}`);
// Open in browser
const cmd = process.platform === 'darwin' ? `open "${outPath}"` : `xdg-open "${outPath}"`;
(0, child_process_1.exec)(cmd, () => { });
