let $websocket, $uuid, $action, $context, $settings, $lang, $FileID = '';

WebSocket.prototype.setGlobalSettings = function(payload) {
    this.send(JSON.stringify({
        event: "setGlobalSettings",
        context: $uuid, payload
    }));
}

WebSocket.prototype.getGlobalSettings = function() {
    this.send(JSON.stringify({
        event: "getGlobalSettings",
        context: $uuid,
    }));
}

WebSocket.prototype.sendToPlugin = function (payload) {
    this.send(JSON.stringify({
        event: "sendToPlugin",
        action: $action,
        context: $uuid,
        payload
    }));
};

WebSocket.prototype.setTitle = function (str, row = 0, num = 6) {
    let newStr = '';
    if (row) {
        let nowRow = 1, strArr = str.split('');
        strArr.forEach((item, index) => {
            if (nowRow < row && index >= nowRow * num) { nowRow++; newStr += '\n'; }
            if (nowRow <= row && index < nowRow * num) { newStr += item; }
        });
        if (strArr.length > row * num) { newStr = newStr.substring(0, newStr.length - 1); newStr += '..'; }
    }
    this.send(JSON.stringify({
        event: "setTitle",
        context: $context,
        payload: {
            target: 0,
            title: newStr || str
        }
    }));
}

WebSocket.prototype.setState = function (state) {
    this.send(JSON.stringify({
        event: "setState",
        context: $context,
        payload: { state }
    }));
};

WebSocket.prototype.setImage = function (url) {
    let image = new Image();
    image.src = url;
    image.onload = () => {
        let canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        let ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0);
        this.send(JSON.stringify({
            event: "setImage",
            context: $context,
            payload: {
                target: 0,
                image: canvas.toDataURL("image/png")
            }
        }));
    };
};

WebSocket.prototype.openUrl = function (url) {
    this.send(JSON.stringify({
        event: "openUrl",
        payload: { url }
    }));
};

WebSocket.prototype.saveData = $.debounce(function (payload) {
    this.send(JSON.stringify({
        event: "setSettings",
        context: $uuid,
        payload
    }));
});

const connectSocket = connectElgatoStreamDeckSocket;
async function connectElgatoStreamDeckSocket(port, uuid, event, app, info) {
    info = JSON.parse(info);
    $uuid = uuid; $action = info.action;
    $context = info.context;
    $websocket = new WebSocket('ws://127.0.0.1:' + port);
    $websocket.onopen = () => $websocket.send(JSON.stringify({ event, uuid }));

    $websocket.onmessage = e => {
        let data = JSON.parse(e.data);
        if (data.event === 'didReceiveSettings') {
            $settings = new Proxy(data.payload.settings, {
                get(target, property) {
                    return target[property];
                },
                set(target, property, value) {
                    target[property] = value;
                    $websocket.saveData(data.payload.settings);
                }
            });
            if (!$back) $dom.main.style.display = 'block';
        }
        $propEvent[data.event]?.(data.payload);
    };

    if (!$local) return;
    $lang = await new Promise(resolve => {
        const req = new XMLHttpRequest();
        req.open('GET', `../../${JSON.parse(app).application.language}.json`);
        req.send();
        req.onreadystatechange = () => {
            if (req.readyState === 4) {
                resolve(JSON.parse(req.responseText).Localization);
            }
        };
    });

    const walker = document.createTreeWalker($dom.main, NodeFilter.SHOW_TEXT, (e) => {
        return e.data.trim() && NodeFilter.FILTER_ACCEPT;
    });
    while (walker.nextNode()) {
        walker.currentNode.data = $lang[walker.currentNode.data];
    }

    const translate = item => {
        if (item.placeholder?.trim()) {
            item.placeholder = $lang[item.placeholder];
        }
    };
    $('input', true).forEach(translate);
    $('textarea', true).forEach(translate);
}

Array.from($('input[type="file"]', true)).forEach(item => item.addEventListener('click', () => $FileID = item.id));
const onFilePickerReturn = (url) => $emit.send(`File-${$FileID}`, JSON.parse(url));
