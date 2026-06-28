/// <reference path="utils/common.js" />
/// <reference path="utils/action.js" />

const $local = false, $back = true, $dom = {
    main: $('.sdpi-wrapper'),
    repoPath: $('#repoPath'),
    friendlyName: $('#friendlyName'),
    refreshInterval: $('#refreshInterval'),
    pullStrategy: $('#pullStrategy'),
    autoFetch: $('#autoFetch'),
    autoReturn: $('#autoReturn'),
    saveBtn: $('#saveBtn'),
    statusMsg: $('#statusMsg'),
};

let currentSettings = {};

function showStatus(msg, isError) {
    $dom.statusMsg.style.display = 'block';
    $dom.statusMsg.textContent = msg;
    $dom.statusMsg.className = isError ? 'error' : 'success';
    setTimeout(() => {
        $dom.statusMsg.style.display = 'none';
    }, 3000);
}

function saveSettings() {
    const settings = {
        repoPath: $dom.repoPath.value.trim(),
        friendlyName: $dom.friendlyName.value.trim(),
        refreshInterval: parseInt($dom.refreshInterval.value) || 60,
        pullStrategy: $dom.pullStrategy.value,
        autoFetch: $dom.autoFetch.checked,
        autoReturn: $dom.autoReturn.checked,
    };

    $websocket.sendToPlugin({
        save: true,
        ...settings
    });
    currentSettings = settings;
    showStatus('Saved', false);
}

const $propEvent = {
    didReceiveGlobalSettings({ settings }) {
    },

    didReceiveSettings(data) {
        const settings = data.settings || {};
        currentSettings = settings;

        $dom.repoPath.value = settings.repoPath || '';
        $dom.friendlyName.value = settings.friendlyName || '';
        $dom.refreshInterval.value = settings.refreshInterval || 60;
        $dom.pullStrategy.value = settings.pullStrategy || 'merge';
        $dom.autoFetch.checked = settings.autoFetch !== false;
        $dom.autoReturn.checked = settings.autoReturn !== false;

        $dom.main.style.display = 'block';
    },

    sendToPropertyInspector(data) {
        if (data.settings) {
            const settings = data.settings;
            $dom.repoPath.value = settings.repoPath || '';
            $dom.friendlyName.value = settings.friendlyName || '';
            $dom.refreshInterval.value = settings.refreshInterval || 60;
            $dom.pullStrategy.value = settings.pullStrategy || 'merge';
            $dom.autoFetch.checked = settings.autoFetch !== false;
            $dom.autoReturn.checked = settings.autoReturn !== false;
            currentSettings = settings;
        }
    },
};

$dom.saveBtn.addEventListener('click', saveSettings);

$dom.repoPath.addEventListener('change', saveSettings);
$dom.friendlyName.addEventListener('change', saveSettings);
$dom.refreshInterval.addEventListener('change', saveSettings);
$dom.pullStrategy.addEventListener('change', saveSettings);
$dom.autoFetch.addEventListener('change', saveSettings);
$dom.autoReturn.addEventListener('change', saveSettings);
