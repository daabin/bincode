"use strict";
/**
 * Configuration file watcher
 * Provides hot-reload for configuration changes
 */
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
exports.ConfigWatcher = void 0;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const os = __importStar(require("node:os"));
const CONFIG_FILE = path.join(os.homedir(), '.bincode', 'config.json');
class ConfigWatcher {
    watcher = null;
    callbacks = new Set();
    currentConfig = {};
    constructor() {
        this.loadConfig();
    }
    loadConfig() {
        try {
            if (fs.existsSync(CONFIG_FILE)) {
                const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
                this.currentConfig = JSON.parse(content);
            }
        }
        catch {
            this.currentConfig = {};
        }
    }
    /**
     * Start watching config file for changes
     */
    start() {
        if (this.watcher)
            return;
        try {
            this.watcher = fs.watch(CONFIG_FILE, (eventType) => {
                if (eventType === 'change') {
                    this.loadConfig();
                    for (const callback of this.callbacks) {
                        try {
                            callback(this.currentConfig);
                        }
                        catch {
                            // Ignore callback errors
                        }
                    }
                }
            });
        }
        catch {
            // File watching not supported (e.g., non-local filesystem)
        }
    }
    /**
     * Stop watching config file
     */
    stop() {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
    }
    /**
     * Register a callback for config changes
     */
    onChange(callback) {
        this.callbacks.add(callback);
        return () => {
            this.callbacks.delete(callback);
        };
    }
    /**
     * Get current config
     */
    getConfig() {
        return { ...this.currentConfig };
    }
}
exports.ConfigWatcher = ConfigWatcher;
