import { RepoState, StatusColor, LogEntry } from '../types';

export class ImageRenderer {
  private width = 100;
  private height = 100;

  getStatusColor(state: RepoState): StatusColor {
    if (!state.valid || state.error) return 'red';
    if (state.detachedHead) return 'gray';
    if (state.mergeInProgress || state.rebaseInProgress || state.cherryPickInProgress) return 'orange';
    if (state.conflicts) return 'red';
    if (state.dirty) return 'orange';
    if (state.noUpstream) return 'blue';
    if (state.behind > 0 && state.ahead > 0) return 'yellow';
    if (state.behind > 0) return 'yellow';
    if (state.ahead > 0) return 'blue';
    return 'green';
  }

  private colorMap: Record<StatusColor, string> = {
    green: '#2d6a4f',
    blue: '#1d3557',
    yellow: '#b5832e',
    orange: '#c2651a',
    red: '#9b2226',
    gray: '#4a4e69',
  };

  renderRepoButton(state: RepoState, displayName: string): string {
    const color = this.getStatusColor(state);
    const bg = this.colorMap[color];

    let line1 = displayName;
    let line2 = state.valid ? state.branch : '';
    let line3 = '';

    if (!state.valid || state.error) {
      line2 = state.error || 'Error';
    } else if (state.detachedHead) {
      line2 = 'Detached HEAD';
    } else if (state.mergeInProgress) {
      line2 = 'Merge in progress';
    } else if (state.rebaseInProgress) {
      line2 = 'Rebase in progress';
    } else if (state.cherryPickInProgress) {
      line2 = 'Cherry-pick...';
    } else {
      line3 = `\u2191${state.ahead} \u2193${state.behind}`;
    }

    return this.svg(bg, line1, line2, line3);
  }

  renderActionButton(label: string, bgColor: string = '#2a2a2a'): string {
    return this.svg(bgColor, label, '', '', '');
  }

  renderSuccess(label: string): string {
    return this.svg('#2d6a4f', '\u2714', label, '', '');
  }

  renderError(label: string): string {
    return this.svg('#9b2226', '\u2718', label, '', '');
  }

  renderLoading(label: string): string {
    return this.svg('#4a4e69', label, '...', '', '');
  }

  renderStatus(state: RepoState): string {
    const lines: string[] = [];
    lines.push(`Branch: ${state.branch}`);
    lines.push(`\u2191${state.ahead} \u2193${state.behind}`);
    if (state.dirtyFiles > 0) {
      lines.push(`Mod: ${state.dirtyFiles} files`);
    }
    if (state.stagedFiles > 0) {
      lines.push(`Staged: ${state.stagedFiles}`);
    }
    if (state.conflicts) lines.push('\u26a0 Conflicts!');

    return this.svg('#2a2a2a', ...lines.slice(0, 4));
  }

  renderLog(entries: LogEntry[], offset: number): string {
    const bg = '#2a2a2a';
    const lines: string[] = [];
    for (const entry of entries) {
      lines.push(`${entry.hash} ${entry.message}`);
    }
    while (lines.length < 4) lines.push('');
    return this.svg(bg, ...lines.slice(0, 4));
  }

  private svg(bg: string, ...lines: string[]): string {
    const activeLines = lines.filter(l => l);
    const count = activeLines.length;
    if (count === 0) {
      return `<svg width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${bg}" />
</svg>`;
    }

    const lineHeight = 24;
    const fontSize = count <= 2 ? 21 : 18;
    const topPad = 6;
    const startY = (this.height - (count - 1) * lineHeight) / 2 + topPad;

    let textElements = '';
    for (let i = 0; i < count; i++) {
      const y = startY + i * lineHeight;
      const isTitle = i === 0 && count >= 2;
      textElements += `
        <text x="50" y="${Math.round(y)}" font-family="sans-serif" font-weight="${isTitle ? 'bold' : 'normal'}" font-size="${isTitle ? fontSize + 2 : fontSize}px" fill="white" text-anchor="middle" dominant-baseline="middle">${this.escapeXml(activeLines[i])}</text>`;
    }

    return `<svg width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${bg}" />
  ${textElements}
</svg>`;
  }

  private escapeXml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
