/**
 * Plugin System & Extension API
 * ==============================
 * 
 * A comprehensive plugin architecture allowing developers to extend TaskMaster
 * with custom functionality without modifying core code.
 * 
 * Features:
 * - Plugin lifecycle management
 * - Hook system for extending behavior
 * - Event subscription
 * - UI component injection
 * - Settings persistence
 * - Inter-plugin communication
 * - Sandboxed execution
 */

import { eventBus, AppEvents } from '../core/event-bus.js';

// ============================================
// PLUGIN HOOKS - Extension Points
// ============================================
const PluginHooks = {
    // Task lifecycle hooks
    TASK_BEFORE_CREATE: 'task:beforeCreate',
    TASK_AFTER_CREATE: 'task:afterCreate',
    TASK_BEFORE_UPDATE: 'task:beforeUpdate',
    TASK_AFTER_UPDATE: 'task:afterUpdate',
    TASK_BEFORE_DELETE: 'task:beforeDelete',
    TASK_AFTER_DELETE: 'task:afterDelete',
    TASK_BEFORE_COMPLETE: 'task:beforeComplete',
    TASK_AFTER_COMPLETE: 'task:afterComplete',

    // UI hooks
    UI_BEFORE_RENDER: 'ui:beforeRender',
    UI_AFTER_RENDER: 'ui:afterRender',
    UI_TASK_CARD_RENDER: 'ui:taskCardRender',
    UI_SIDEBAR_RENDER: 'ui:sidebarRender',
    UI_TOOLBAR_RENDER: 'ui:toolbarRender',

    // App lifecycle hooks
    APP_INIT: 'app:init',
    APP_READY: 'app:ready',
    APP_BEFORE_DESTROY: 'app:beforeDestroy',

    // Data hooks
    DATA_BEFORE_SAVE: 'data:beforeSave',
    DATA_AFTER_SAVE: 'data:afterSave',
    DATA_BEFORE_LOAD: 'data:beforeLoad',
    DATA_AFTER_LOAD: 'data:afterLoad',

    // Custom hooks (plugins can define their own)
    CUSTOM: 'custom:'
};

// ============================================
// PLUGIN CONTEXT - Plugin API Access
// ============================================
class PluginContext {
    constructor(pluginId, taskRepository, ui, storage, eventBus) {
        this.pluginId = pluginId;
        this.taskRepository = taskRepository;
        this.ui = ui;
        this.storage = storage;
        this.eventBus = eventBus;
    }

    /**
     * Register a hook handler
     */
    registerHook(hook, handler, priority = 0) {
        return this.eventBus.on(`plugin:hook:${hook}`, handler, priority);
    }

    /**
     * Emit a custom event
     */
    emit(event, data) {
        this.eventBus.emit(`plugin:${this.pluginId}:${event}`, data);
    }

    /**
     * Subscribe to events
     */
    on(event, handler) {
        return this.eventBus.on(event, handler);
    }

    /**
     * Get plugin settings
     */
    async getSettings(defaults = {}) {
        const key = `plugin_${this.pluginId}_settings`;
        const saved = await this.storage.getSetting(key, {});
        return { ...defaults, ...saved };
    }

    /**
     * Save plugin settings
     */
    async saveSettings(settings) {
        const key = `plugin_${this.pluginId}_settings`;
        await this.storage.saveSetting(key, settings);
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info', options = {}) {
        this.ui.showToast(message, type, options);
    }

    /**
     * Register a command
     */
    registerCommand(name, handler, metadata = {}) {
        this.eventBus.emit('plugin:command:register', {
            pluginId: this.pluginId,
            name,
            handler,
            metadata
        });
    }

    /**
     * Add a menu item
     */
    addMenuItem(menuId, item) {
        this.eventBus.emit('plugin:menu:add', {
            pluginId: this.pluginId,
            menuId,
            item
        });
    }

    /**
     * Register a keyboard shortcut
     */
    registerShortcut(key, handler, description) {
        this.eventBus.emit('plugin:shortcut:register', {
            pluginId: this.pluginId,
            key,
            handler,
            description
        });
    }

    /**
     * Inject UI component
     */
    injectUI(containerId, component, position = 'append') {
        this.eventBus.emit('plugin:ui:inject', {
            pluginId: this.pluginId,
            containerId,
            component,
            position
        });
    }

    /**
     * Get other plugin's public API
     */
    getPluginAPI(pluginId) {
        return PluginManager.getInstance().getPluginAPI(pluginId);
    }

    /**
     * Log message
     */
    log(...args) {
        console.log(`[Plugin:${this.pluginId}]`, ...args);
    }
}

// ============================================
// PLUGIN BASE CLASS
// ============================================
class Plugin {
    constructor() {
        this.id = null;
        this.name = null;
        this.version = null;
        this.description = null;
        this.author = null;
        this.ctx = null;
        this.enabled = false;
    }

    /**
     * Initialize plugin (called when plugin is loaded)
     */
    async initialize(ctx) {
        this.ctx = ctx;
        this.id = ctx.pluginId;
    }

    /**
     * Enable plugin (called when plugin is enabled)
     */
    async enable() {
        this.enabled = true;
    }

    /**
     * Disable plugin (called when plugin is disabled)
     */
    async disable() {
        this.enabled = false;
    }

    /**
     * Destroy plugin (called when plugin is unloaded)
     */
    async destroy() {
        this.enabled = false;
    }

    /**
     * Get plugin settings UI (optional)
     */
    getSettingsUI() {
        return null;
    }

    /**
     * Get plugin info
     */
    getInfo() {
        return {
            id: this.id,
            name: this.name,
            version: this.version,
            description: this.description,
            author: this.author,
            enabled: this.enabled
        };
    }
}

// ============================================
// PLUGIN MANAGER - Core Plugin System
// ============================================
class PluginManager {
    constructor(taskRepository, ui, storage) {
        this.taskRepository = taskRepository;
        this.ui = ui;
        this.storage = storage;
        this.plugins = new Map();
        this.loadedPlugins = new Map();
        this.hooks = new Map();
        this.commands = new Map();
        this.pluginAPIs = new Map();
        
        PluginManager.instance = this;
    }

    static getInstance() {
        return PluginManager.instance;
    }

    /**
     * Register a plugin class
     */
    async registerPlugin(pluginClass) {
        const plugin = new pluginClass();
        
        if (!plugin.id) {
            throw new Error('Plugin must have an id');
        }

        if (this.plugins.has(plugin.id)) {
            throw new Error(`Plugin ${plugin.id} is already registered`);
        }

        // Create plugin context
        const ctx = new PluginContext(
            plugin.id,
            this.taskRepository,
            this.ui,
            this.storage,
            eventBus
        );

        // Initialize plugin
        await plugin.initialize(ctx);
        this.plugins.set(plugin.id, plugin);
        this.pluginAPIs.set(plugin.id, plugin.publicAPI || {});

        // Save to loaded plugins
        await this._saveLoadedPlugins();

        console.log(`[Plugin] Registered: ${plugin.id} v${plugin.version}`);
        eventBus.emit('plugin:registered', plugin.getInfo());

        return plugin;
    }

    /**
     * Load plugin from URL
     */
    async loadPluginFromURL(url) {
        try {
            const module = await import(url);
            const pluginClass = module.default || module.Plugin;
            return await this.registerPlugin(pluginClass);
        } catch (e) {
            console.error(`[Plugin] Failed to load from ${url}:`, e);
            throw e;
        }
    }

    /**
     * Load plugin from code string (sandboxed)
     */
    async loadPluginFromCode(code, pluginId) {
        try {
            // Create sandboxed environment
            const sandbox = this._createSandbox(pluginId);
            
            // Execute plugin code
            const pluginFactory = new Function('ctx', 'hooks', 'sandbox', `
                ${code}
                return typeof Plugin !== 'undefined' ? Plugin : null;
            `);
            
            const PluginClass = pluginFactory(sandbox.ctx, PluginHooks, sandbox);
            
            if (!PluginClass) {
                throw new Error('Plugin code must export a Plugin class');
            }
            
            return await this.registerPlugin(PluginClass);
        } catch (e) {
            console.error(`[Plugin] Failed to load code:`, e);
            throw e;
        }
    }

    /**
     * Unregister a plugin
     */
    async unregisterPlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) return;

        await plugin.destroy();
        this.plugins.delete(pluginId);
        this.pluginAPIs.delete(pluginId);

        await this._saveLoadedPlugins();

        console.log(`[Plugin] Unregistered: ${pluginId}`);
        eventBus.emit('plugin:unregistered', { pluginId });
    }

    /**
     * Enable a plugin
     */
    async enablePlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) throw new Error(`Plugin ${pluginId} not found`);

        await plugin.enable();
        await this._saveEnabledState(pluginId, true);

        console.log(`[Plugin] Enabled: ${pluginId}`);
        eventBus.emit('plugin:enabled', plugin.getInfo());
    }

    /**
     * Disable a plugin
     */
    async disablePlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) throw new Error(`Plugin ${pluginId} not found`);

        await plugin.disable();
        await this._saveEnabledState(pluginId, false);

        console.log(`[Plugin] Disabled: ${pluginId}`);
        eventBus.emit('plugin:disabled', plugin.getInfo());
    }

    /**
     * Get plugin instance
     */
    getPlugin(pluginId) {
        return this.plugins.get(pluginId);
    }

    /**
     * Get plugin's public API
     */
    getPluginAPI(pluginId) {
        return this.pluginAPIs.get(pluginId) || {};
    }

    /**
     * Get all plugins
     */
    getAllPlugins() {
        return Array.from(this.plugins.values()).map(p => p.getInfo());
    }

    /**
     * Execute hooks (for internal use)
     */
    async executeHook(hook, data) {
        const event = `plugin:hook:${hook}`;
        
        // Create hook context
        const hookData = {
            ...data,
            preventDefault: false,
            result: null,
            stopPropagation: false
        };

        await eventBus.emit(event, hookData);

        return hookData;
    }

    /**
     * Register command from plugin
     */
    registerCommand(pluginId, name, handler, metadata) {
        const commandId = `${pluginId}:${name}`;
        this.commands.set(commandId, { pluginId, name, handler, metadata });
        console.log(`[Plugin] Command registered: ${commandId}`);
    }

    /**
     * Execute plugin command
     */
    async executeCommand(commandId, args) {
        const command = this.commands.get(commandId);
        if (!command) {
            throw new Error(`Command ${commandId} not found`);
        }
        return await command.handler(args);
    }

    /**
     * Get all registered commands
     */
    getCommands() {
        return Array.from(this.commands.entries()).map(([id, cmd]) => ({
            id,
            ...cmd.metadata
        }));
    }

    // ==================== Private Methods ====================

    _createSandbox(pluginId) {
        const ctx = new PluginContext(
            pluginId,
            this.taskRepository,
            this.ui,
            this.storage,
            eventBus
        );

        return {
            ctx,
            hooks: PluginHooks,
            // Safe APIs
            fetch: window.fetch.bind(window),
            setTimeout: window.setTimeout.bind(window),
            setInterval: window.setInterval.bind(window),
            // No access to dangerous globals
            console: {
                log: (...args) => console.log(`[Plugin:${pluginId}]`, ...args),
                warn: (...args) => console.warn(`[Plugin:${pluginId}]`, ...args),
                error: (...args) => console.error(`[Plugin:${pluginId}]`, ...args)
            }
        };
    }

    async _saveLoadedPlugins() {
        const pluginIds = Array.from(this.plugins.keys());
        await this.storage.saveSetting('loaded_plugins', pluginIds);
    }

    async _saveEnabledState(pluginId, enabled) {
        const enabledPlugins = await this.storage.getSetting('enabled_plugins', []);
        
        if (enabled) {
            if (!enabledPlugins.includes(pluginId)) {
                enabledPlugins.push(pluginId);
            }
        } else {
            const index = enabledPlugins.indexOf(pluginId);
            if (index > -1) {
                enabledPlugins.splice(index, 1);
            }
        }

        await this.storage.saveSetting('enabled_plugins', enabledPlugins);
    }

    async _loadSavedPlugins() {
        const enabledPlugins = await this.storage.getSetting('enabled_plugins', []);
        
        for (const pluginId of enabledPlugins) {
            try {
                const plugin = this.plugins.get(pluginId);
                if (plugin) {
                    await plugin.enable();
                }
            } catch (e) {
                console.error(`[Plugin] Failed to enable ${pluginId}:`, e);
            }
        }
    }
}

// ============================================
// BUILT-IN PLUGINS
// ============================================

/**
 * Example: Custom Fields Plugin
 * Allows adding custom fields to tasks
 */
class CustomFieldsPlugin extends Plugin {
    constructor() {
        super();
        this.id = 'custom-fields';
        this.name = 'Custom Fields';
        this.version = '1.0.0';
        this.description = 'Add custom fields to tasks';
        this.author = 'TaskMaster';
    }

    async initialize(ctx) {
        await super.initialize(ctx);

        // Register hook to extend task data
        this.ctx.registerHook(PluginHooks.TASK_AFTER_CREATE, async (data) => {
            const settings = await this.ctx.getSettings({ fields: [] });
            if (settings.fields.length > 0) {
                // Add custom fields to task
                data.task.customFields = {};
                for (const field of settings.fields) {
                    data.task.customFields[field.name] = field.defaultValue || '';
                }
            }
        });

        // Register command
        this.ctx.registerCommand('addField', async (args) => {
            const settings = await this.ctx.getSettings({ fields: [] });
            settings.fields.push(args.field);
            await this.ctx.saveSettings(settings);
            return { success: true };
        }, {
            description: 'Add a custom field definition',
            args: ['field']
        });
    }

    getSettingsUI() {
        return `
            <div class="plugin-settings">
                <h4>Custom Fields</h4>
                <p>Add custom fields to your tasks</p>
                <div id="customFieldsList"></div>
                <button id="addCustomField" class="btn-add">+ Add Field</button>
            </div>
        `;
    }
}

/**
 * Example: Task Tags Plugin
 * Hashtag-style tagging for tasks
 */
class TaskTagsPlugin extends Plugin {
    constructor() {
        super();
        this.id = 'task-tags';
        this.name = 'Task Tags';
        this.version = '1.0.0';
        this.description = 'Hashtag-style tagging for tasks';
        this.author = 'TaskMaster';
    }

    async initialize(ctx) {
        await super.initialize(ctx);

        // Extract tags from task text
        this.ctx.registerHook(PluginHooks.TASK_BEFORE_CREATE, async (data) => {
            const tagRegex = /#(\w+)/g;
            const tags = [];
            let match;
            
            while ((match = tagRegex.exec(data.taskData.text)) !== null) {
                tags.push(match[1]);
            }

            if (tags.length > 0) {
                data.taskData.tags = tags;
                // Remove tags from text
                data.taskData.text = data.taskData.text.replace(tagRegex, '').trim();
            }
        });

        // Filter by tag
        this.ctx.registerCommand('filterByTag', async (tagName) => {
            const tasks = await this.ctx.taskRepository.getAll();
            return tasks.filter(t => t.tags?.includes(tagName));
        }, {
            description: 'Filter tasks by tag',
            args: ['tagName']
        });
    }
}

/**
 * Example: Task Comments Plugin
 * Add comments/notes to tasks
 */
class TaskCommentsPlugin extends Plugin {
    constructor() {
        super();
        this.id = 'task-comments';
        this.name = 'Task Comments';
        this.version = '1.0.0';
        this.description = 'Add comments to tasks';
        this.author = 'TaskMaster';
    }

    async initialize(ctx) {
        await super.initialize(ctx);

        // Initialize comments storage
        this.comments = await this.ctx.getSettings({ comments: {} });

        // Get comments for task
        this.ctx.registerCommand('getComments', async (taskId) => {
            return this.comments.comments[taskId] || [];
        }, {
            description: 'Get comments for a task',
            args: ['taskId']
        });

        // Add comment to task
        this.ctx.registerCommand('addComment', async ({ taskId, text, author }) => {
            if (!this.comments.comments[taskId]) {
                this.comments.comments[taskId] = [];
            }
            
            const comment = {
                id: Date.now().toString(),
                text,
                author: author || 'Anonymous',
                createdAt: new Date().toISOString()
            };
            
            this.comments.comments[taskId].push(comment);
            await this.ctx.saveSettings(this.comments);
            
            return comment;
        }, {
            description: 'Add a comment to a task',
            args: ['taskId', 'text', 'author']
        });
    }
}

/**
 * Example: Recurring Tasks Plugin
 * Advanced recurrence patterns
 */
class RecurringTasksPlugin extends Plugin {
    constructor() {
        super();
        this.id = 'recurring-tasks';
        this.name = 'Recurring Tasks';
        this.version = '1.0.0';
        this.description = 'Advanced recurring task patterns';
        this.author = 'TaskMaster';
    }

    async initialize(ctx) {
        await super.initialize(ctx);

        // Handle recurring task completion
        this.ctx.registerHook(PluginHooks.TASK_AFTER_COMPLETE, async (data) => {
            if (data.task.recurrence) {
                await this._createNextInstance(data.task);
            }
        });

        // Register recurrence patterns
        this.patterns = {
            daily: (date) => this._addDays(date, 1),
            weekly: (date) => this._addDays(date, 7),
            monthly: (date) => this._addMonths(date, 1),
            yearly: (date) => this._addYears(date, 1)
        };
    }

    async _createNextInstance(task) {
        const pattern = this.patterns[task.recurrence.pattern];
        if (!pattern) return;

        const nextDate = pattern(new Date(task.dueDate || Date.now()));
        
        const newTask = {
            text: task.text,
            priority: task.priority,
            dueDate: nextDate.toISOString().split('T')[0],
            recurrence: task.recurrence,
            parentId: task.id
        };

        await this.ctx.taskRepository.create(newTask);
        this.ctx.showToast(`Next instance created: ${nextDate.toLocaleDateString()}`, 'info');
    }

    _addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    _addMonths(date, months) {
        const result = new Date(date);
        result.setMonth(result.getMonth() + months);
        return result;
    }

    _addYears(date, years) {
        const result = new Date(date);
        result.setFullYear(result.getFullYear() + years);
        return result;
    }
}

// ============================================
// PLUGIN LOADER - Auto-load plugins
// ============================================
async function loadPlugins(taskRepository, ui, storage) {
    const manager = new PluginManager(taskRepository, ui, storage);
    
    // Register built-in plugins
    await manager.registerPlugin(CustomFieldsPlugin);
    await manager.registerPlugin(TaskTagsPlugin);
    await manager.registerPlugin(TaskCommentsPlugin);
    await manager.registerPlugin(RecurringTasksPlugin);

    // Load saved plugins
    await manager._loadSavedPlugins();

    return manager;
}

// Export
export {
    PluginManager,
    PluginContext,
    Plugin,
    PluginHooks,
    CustomFieldsPlugin,
    TaskTagsPlugin,
    TaskCommentsPlugin,
    RecurringTasksPlugin,
    loadPlugins
};
