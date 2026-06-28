import { RepoSettings } from '../types';

export class SettingsStorage {
  private defaultSettings: RepoSettings;

  constructor(defaultSettings: RepoSettings) {
    this.defaultSettings = { ...defaultSettings };
  }

  validate(settings: Partial<RepoSettings>): RepoSettings {
    return {
      repoPath: settings.repoPath || this.defaultSettings.repoPath,
      friendlyName: settings.friendlyName || '',
      customIcon: settings.customIcon || '',
      refreshInterval: this.validateNumber(settings.refreshInterval, this.defaultSettings.refreshInterval, 5, 3600),
      pullStrategy: settings.pullStrategy === 'rebase' ? 'rebase' : this.defaultSettings.pullStrategy,
      autoFetch: typeof settings.autoFetch === 'boolean' ? settings.autoFetch : this.defaultSettings.autoFetch,
      autoReturn: typeof settings.autoReturn === 'boolean' ? settings.autoReturn : this.defaultSettings.autoReturn,
    };
  }

  sanitizeForLog(settings: RepoSettings): RepoSettings {
    return { ...settings };
  }

  getDisplayName(settings: RepoSettings): string {
    if (settings.friendlyName && settings.friendlyName.trim().length > 0) {
      return truncate(settings.friendlyName.trim(), 12);
    }
    if (settings.repoPath) {
      const parts = settings.repoPath.split(/[/\\]/).filter(Boolean);
      return truncate(parts[parts.length - 1] || settings.repoPath, 12);
    }
    return 'Config?';
  }

  private validateNumber(value: any, fallback: number, min: number, max: number): number {
    const num = Number(value);
    if (isNaN(num)) return fallback;
    return Math.max(min, Math.min(max, num));
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.substring(0, max - 2) + '..';
}
