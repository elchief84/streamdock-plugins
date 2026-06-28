"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsStorage = void 0;
class SettingsStorage {
    defaultSettings;
    constructor(defaultSettings) {
        this.defaultSettings = { ...defaultSettings };
    }
    validate(settings) {
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
    sanitizeForLog(settings) {
        return { ...settings };
    }
    getDisplayName(settings) {
        if (settings.friendlyName && settings.friendlyName.trim().length > 0) {
            return truncate(settings.friendlyName.trim(), 12);
        }
        if (settings.repoPath) {
            const parts = settings.repoPath.split(/[/\\]/).filter(Boolean);
            return truncate(parts[parts.length - 1] || settings.repoPath, 12);
        }
        return 'Config?';
    }
    validateNumber(value, fallback, min, max) {
        const num = Number(value);
        if (isNaN(num))
            return fallback;
        return Math.max(min, Math.min(max, num));
    }
}
exports.SettingsStorage = SettingsStorage;
function truncate(s, max) {
    if (s.length <= max)
        return s;
    return s.substring(0, max - 2) + '..';
}
