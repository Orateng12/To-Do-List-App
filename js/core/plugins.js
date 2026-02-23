/**
 * Plugin System - Extensible Architecture
 * =========================================
 * Allow third-party extensions and custom functionality
 */

import { eventBus, EVENTS } from '../event-bus.js';

/**
 * Plugin Base Class
 */
export class Plugin {
    constructor(name, version = '1.0.0') {
        if (new.target === Plugin) {
            throw new Error('Plugin is an abstract class');
        }
        this.name = name;
        this.version = version;
        this.enabled = false;
        this.app = null;
        this.settings = {};
    }

    /**
     * Initialize plugin (called when app loads)
     */
    async install(app) {
        this.app = app;
        console.log(`[Plugin:${this.name}] Installed`);
    }

    /**
     * Enable plugin (called when user enables)
     */
    async enable() {
        this.enabled = true;
        this.onEnable();
        console.log(`[Plugin:${this.name}] Enabled`);
    }

    /**
     * Disable plugin
     */
    async disable() {
        this.enabled = false;
        this.onDisable();
        console.log(`[Plugin:${this.name}] Disabled`);
    }

    /**
     * Override for enable logic
     */
    onEnable() {}

    /**
     * Override for disable logic
     */
    onDisable() {}

    /**
     * Uninstall plugin
     */
    async uninstall() {
        await this.disable();
        this.app = null;
        console.log(`[Plugin:${this.name}] Uninstalled`);
    }

    /**
     * Get plugin settings
     */
    getSetting(key, defaultValue = null) {
        return this.settings[key] !== undefined ? this.settings[key] : defaultValue;
    }

    /**
     * Set plugin setting
     */
    setSetting(key, value) {
        this.settings[key] = value;
        this.onSettingsChange();
    }

    /**
     * Called when settings change
     */
    onSettingsChange() {}

    /**
     * Get plugin info
     */
    getInfo() {
        return {
            name: this.name,
            version: this.version,
            enabled: this.enabled,
            description: this.description || 'No description',
            author: this.author || 'Unknown'
        };
    }
}

/**
 * Plugin Manager - Handles plugin lifecycle
 */
export class PluginManager {
    constructor() {
        this.plugins = new Map();
        this.hooks = new Map();
        this.middleware = [];
    }

    /**
     * Register a plugin
     */
    register(plugin) {
        if (!(plugin instanceof Plugin)) {
            throw new Error('Must register a Plugin instance');
        }

        if (this.plugins.has(plugin.name)) {
            throw new Error(`Plugin "${plugin.name}" is already registered`);
        }

        this.plugins.set(plugin.name, plugin);
        console.log(`[PluginManager] Registered: ${plugin.name} v${plugin.version}`);
    }

    /**
     * Get plugin by name
     */
    get(name) {
        return this.plugins.get(name);
    }

    /**
     * Check if plugin exists
     */
    has(name) {
        return this.plugins.has(name);
    }

    /**
     * Enable plugin
     */
    async enable(name) {
        const plugin = this.plugins.get(name);
        if (!plugin) {
            throw new Error(`Plugin "${name}" not found`);
        }

        await plugin.enable();
        eventBus.emit(EVENTS.PLUGIN_ENABLED, { plugin: plugin.getInfo() });
    }

    /**
     * Disable plugin
     */
    async disable(name) {
        const plugin = this.plugins.get(name);
        if (!plugin) {
            throw new Error(`Plugin "${name}" not found`);
        }

        await plugin.disable();
        eventBus.emit(EVENTS.PLUGIN_DISABLED, { plugin: plugin.getInfo() });
    }

    /**
     * Get all enabled plugins
     */
    getEnabled() {
        return Array.from(this.plugins.values()).filter(p => p.enabled);
    }

    /**
     * Get all plugins info
     */
    getAll() {
        return Array.from(this.plugins.values()).map(p => p.getInfo());
    }

    /**
     * Register a hook
     */
    registerHook(hookName, callback, priority = 10) {
        if (!this.hooks.has(hookName)) {
            this.hooks.set(hookName, []);
        }

        this.hooks.get(hookName).push({ callback, priority });
        this.hooks.get(hookName).sort((a, b) => a.priority - b.priority);
    }

    /**
     * Execute hooks
     */
    async executeHook(hookName, data) {
        const hooks = this.hooks.get(hookName) || [];
        let result = data;

        for (const hook of hooks) {
            try {
                const pluginResult = await hook.callback(result, this);
                if (pluginResult !== undefined) {
                    result = pluginResult;
                }
            } catch (error) {
                console.error(`[Hook:${hookName}] Error:`, error);
            }
        }

        return result;
    }

    /**
     * Register middleware
     */
    use(middleware) {
        this.middleware.push(middleware);
    }

    /**
     * Execute middleware chain
     */
    async executeMiddleware(context, next) {
        const chain = [...this.middleware];

        const execute = async (index, ctx) => {
            if (index >= chain.length) {
                return next(ctx);
            }

            const middleware = chain[index];
            return middleware(ctx, () => execute(index + 1, ctx));
        };

        return execute(0, context);
    }
}

/**
 * Built-in Plugins
 */

/**
 * Pomodoro Timer Plugin
 */
export class PomodoroPlugin extends Plugin {
    constructor() {
        super('pomodoro', '1.0.0');
        this.description = 'Pomodoro timer for focused work sessions';
        this.author = 'TaskMaster';
        this.timer = null;
        this.timeRemaining = 25 * 60; // 25 minutes
        this.isRunning = false;
        this.sessionCount = 0;
    }

    onEnable() {
        this.createTimerUI();
    }

    onDisable() {
        this.stopTimer();
        const ui = document.getElementById('pomodoro-ui');
        if (ui) ui.remove();
    }

    createTimerUI() {
        const mainContent = document.querySelector('.main-content');
        if (!mainContent) return;

        const ui = document.createElement('div');
        ui.id = 'pomodoro-ui';
        ui.innerHTML = `
            <div class="pomodoro-widget">
                <div class="pomodoro-header">
                    <span>🍅 Pomodoro</span>
                    <button id="pomodoro-settings">⚙️</button>
                </div>
                <div class="pomodoro-timer" id="pomodoro-display">25:00</div>
                <div class="pomodoro-controls">
                    <button id="pomodoro-start">Start</button>
                    <button id="pomodoro-reset">Reset</button>
                </div>
                <div class="pomodoro-stats">
                    <span>Sessions: <strong id="pomodoro-sessions">0</strong></span>
                </div>
            </div>
        `;

        mainContent.insertBefore(ui, mainContent.firstChild);
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('pomodoro-start')?.addEventListener('click', () => {
            if (this.isRunning) {
                this.pauseTimer();
            } else {
                this.startTimer();
            }
        });

        document.getElementById('pomodoro-reset')?.addEventListener('click', () => {
            this.resetTimer();
        });
    }

    startTimer() {
        this.isRunning = true;
        document.getElementById('pomodoro-start').textContent = 'Pause';
        
        this.timer = setInterval(() => {
            this.timeRemaining--;
            this.updateDisplay();

            if (this.timeRemaining <= 0) {
                this.completeSession();
            }
        }, 1000);
    }

    pauseTimer() {
        this.isRunning = false;
        document.getElementById('pomodoro-start').textContent = 'Start';
        clearInterval(this.timer);
    }

    stopTimer() {
        this.pauseTimer();
        this.timeRemaining = 25 * 60;
        this.updateDisplay();
    }

    resetTimer() {
        this.pauseTimer();
        this.timeRemaining = this.getSetting('workTime', 25) * 60;
        this.updateDisplay();
    }

    updateDisplay() {
        const minutes = Math.floor(this.timeRemaining / 60);
        const seconds = this.timeRemaining % 60;
        const display = document.getElementById('pomodoro-display');
        if (display) {
            display.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    completeSession() {
        this.pauseTimer();
        this.sessionCount++;
        document.getElementById('pomodoro-sessions').textContent = this.sessionCount;
        
        // Play notification sound
        this.playNotificationSound();
        
        eventBus.emit(EVENTS.POMODORO_COMPLETED, { sessionCount: this.sessionCount });
        
        // Show toast
        eventBus.emit(EVENTS.TOAST_SHOW, {
            message: 'Pomodoro session complete! Take a break.',
            type: 'success'
        });
    }

    playNotificationSound() {
        // Simple beep using Web Audio API
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        oscillator.connect(audioCtx.destination);
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        oscillator.start();
        setTimeout(() => oscillator.stop(), 200);
    }
}

/**
 * Task Templates Plugin
 */
export class TemplatesPlugin extends Plugin {
    constructor() {
        super('templates', '1.0.0');
        this.description = 'Save and reuse task templates';
        this.author = 'TaskMaster';
        this.templates = this.loadTemplates();
    }

    loadTemplates() {
        const stored = localStorage.getItem('taskmaster-templates');
        return stored ? JSON.parse(stored) : this.getDefaultTemplates();
    }

    getDefaultTemplates() {
        return [
            {
                id: 'morning-routine',
                name: 'Morning Routine',
                tasks: [
                    { text: 'Wake up and make bed', priority: 'medium' },
                    { text: 'Morning exercise', priority: 'high' },
                    { text: 'Healthy breakfast', priority: 'medium' },
                    { text: 'Review daily goals', priority: 'high' }
                ]
            },
            {
                id: 'meeting-prep',
                name: 'Meeting Preparation',
                tasks: [
                    { text: 'Review agenda', priority: 'high' },
                    { text: 'Prepare presentation', priority: 'high' },
                    { text: 'Send pre-read materials', priority: 'medium' },
                    { text: 'Test equipment', priority: 'medium' }
                ]
            },
            {
                id: 'project-launch',
                name: 'Project Launch',
                tasks: [
                    { text: 'Final review', priority: 'high' },
                    { text: 'Deploy to production', priority: 'high' },
                    { text: 'Update documentation', priority: 'medium' },
                    { text: 'Notify stakeholders', priority: 'medium' },
                    { text: 'Monitor for issues', priority: 'high' }
                ]
            }
        ];
    }

    saveTemplate(template) {
        this.templates.push(template);
        localStorage.setItem('taskmaster-templates', JSON.stringify(this.templates));
        eventBus.emit(EVENTS.TEMPLATE_SAVED, { template });
    }

    applyTemplate(templateId) {
        const template = this.templates.find(t => t.id === templateId);
        if (!template) return;

        template.tasks.forEach(taskData => {
            eventBus.emit(EVENTS.TASK_ADDED, {
                task: {
                    ...taskData,
                    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
                    completed: false,
                    createdAt: new Date().toISOString(),
                    categories: [`template:${template.name}`]
                }
            });
        });

        eventBus.emit(EVENTS.TEMPLATE_APPLIED, { template });
        eventBus.emit(EVENTS.TOAST_SHOW, {
            message: `Applied template: ${template.name}`,
            type: 'success'
        });
    }

    onEnable() {
        this.createTemplatesUI();
    }

    onDisable() {
        const ui = document.getElementById('templates-ui');
        if (ui) ui.remove();
    }

    createTemplatesUI() {
        const sidebar = document.querySelector('.sidebar-footer');
        if (!sidebar) return;

        const ui = document.createElement('div');
        ui.id = 'templates-ui';
        ui.innerHTML = `
            <div class="templates-section">
                <h4>📋 Templates</h4>
                <select id="template-select">
                    ${this.templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                </select>
                <button id="template-apply" class="btn-small">Apply</button>
            </div>
        `;

        sidebar.appendChild(ui);

        document.getElementById('template-apply')?.addEventListener('click', () => {
            const select = document.getElementById('template-select');
            if (select) {
                this.applyTemplate(select.value);
            }
        });
    }
}

/**
 * Focus Mode Plugin
 */
export class FocusModePlugin extends Plugin {
    constructor() {
        super('focus-mode', '1.0.0');
        this.description = 'Distraction-free focus mode for single task';
        this.author = 'TaskMaster';
        this.focusTask = null;
    }

    onEnable() {
        this.createFocusUI();
    }

    onDisable() {
        this.exitFocusMode();
        const ui = document.getElementById('focus-mode-ui');
        if (ui) ui.remove();
    }

    createFocusUI() {
        const toolbar = document.querySelector('.toolbar');
        if (!toolbar) return;

        const btn = document.createElement('button');
        btn.id = 'focus-mode-btn';
        btn.className = 'toolbar-btn';
        btn.innerHTML = '🎯';
        btn.title = 'Focus Mode';
        
        toolbar.appendChild(btn);

        btn.addEventListener('click', () => {
            this.toggleFocusMode();
        });
    }

    toggleFocusMode() {
        if (this.focusTask) {
            this.exitFocusMode();
        } else {
            this.enterFocusMode();
        }
    }

    enterFocusMode() {
        // Get first active high-priority task
        const tasks = this.app?.stateManager?.getFilteredTasks() || [];
        const focusTask = tasks.find(t => !t.completed && t.priority === 'high') || tasks.find(t => !t.completed);

        if (!focusTask) {
            eventBus.emit(EVENTS.TOAST_SHOW, {
                message: 'No tasks to focus on!',
                type: 'info'
            });
            return;
        }

        this.focusTask = focusTask;
        document.body.classList.add('focus-mode');
        
        eventBus.emit(EVENTS.FOCUS_MODE_ENTERED, { task: focusTask });
        eventBus.emit(EVENTS.TOAST_SHOW, {
            message: `Focusing on: ${focusTask.text}`,
            type: 'info'
        });
    }

    exitFocusMode() {
        this.focusTask = null;
        document.body.classList.remove('focus-mode');
        eventBus.emit(EVENTS.FOCUS_MODE_EXITED);
    }
}

// Export singleton instance
export const pluginManager = new PluginManager();
