export class Plugins {
    static language: string;
    static globalSettings: any;
    static globalContext: string | null;
    static instance: Plugins;
    [key: string]: any;
    constructor(name?: string);
    setGlobalSettings(payload: any): void;
    getGlobalSettings(): void;
    setTitle(context: string, str: string, row?: number, num?: number): void;
    setImage(context: string, url: string): void;
    setState(context: string, state: number): void;
    setSettings(context: string, payload: any): void;
    showAlert(context: string): void;
    showOk(context: string): void;
    sendToPropertyInspector(payload: any): void;
    openUrl(url: string): void;
    ws: any;
}

export class Actions {
    static currentAction: string | null;
    static currentContext: string | null;
    static actions: Record<string, string>;
    data: Record<string, any>;
    default: any;
    constructor(handlers: any);
    propertyInspectorDidAppear(data: any): void;
    willAppear(data: any): void;
    didReceiveSettings(data: any): void;
    willDisappear(data: any): void;
}

export class EventEmitter {
    subscribe(event: string, listener: (data: any) => void): void;
    unsubscribe(event: string, listener: (data: any) => void): void;
    emit(event: string, data: any): void;
}

export const log: {
    info(...args: any[]): void;
    error(...args: any[]): void;
    warn(...args: any[]): void;
    debug(...args: any[]): void;
};
