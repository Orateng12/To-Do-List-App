/**
 * TaskMaster Deep Features - Unified Integration Layer
 * =====================================================
 * 
 * Central hub that integrates all advanced features into a cohesive system.
 * This is the main entry point for using all deep features together.
 * 
 * Features Integrated:
 * - CRDT Collaboration Engine
 * - AI/ML Pipeline
 * - Plugin System
 * - Analytics Dashboard
 * - Advanced Features (Dependencies, Time Blocking, Energy, etc.)
 */

import { eventBus, AppEvents } from './core/event-bus.js';
import { db } from './core/storage.js';

// Import all feature modules
import { CollaborationManager } from './collaboration/crdt-engine.js';
import { AIManager } from './ai-ml/ai-pipeline.js';
import { PluginManager, loadPlugins } from './plugins/plugin-system.js';
import { AnalyticsDashboard } from './analytics/analytics-dashboard.js';
import { AdvancedFeaturesManager } from './advanced-features.js';

// ============================================
// DEEP FEATURES MANAGER - Main Integration
// ============================================
class DeepFeaturesManager {
    constructor(taskRepository, ui) {
        this.taskRepository = taskRepository;
        this.ui = ui;
        this.storage = db;
        
        // Feature managers (initialized on demand)
        this.collaboration = null;
        this.ai = null;
        this.plugins = null;
        this.analytics = null;
        this.advanced = null;
        
        this.initialized = false;
        this.config = this._defaultConfig();
    }

    /**
     * Default configuration
     */
    _defaultConfig() {
        return {
            // Collaboration
            collaboration: {
                enabled: false,
                autoSync: true,
                syncInterval: 5000
            },
            
            // AI/ML
            ai: {
                enabled: true,
                autoCategorize: true,
                smartSuggestions: true,
                durationPrediction: true,
                minTrainingData: 10
            },
            
            // Plugins
            plugins: {
                enabled: true,
                sandboxMode: true,
                allowedBuiltins: ['custom-fields', 'task-tags', 'task-comments', 'recurring-tasks']
            },
            
            // Analytics
            analytics: {
                enabled: true,
                autoTrack: true,
                dashboardContainer: null
            },
            
            // Advanced features
            advanced: {
                dependencies: true,
                timeBlocking: true,
                energyTracking: true,
                bulkOperations: true,
                templates: true,
                archive: true
            }
        };
    }

    /**
     * Initialize all deep features
     */
    async initialize(config = {}) {
        if (this.initialized) {
            console.log('[DeepFeatures] Already initialized');
            return;
        }

        console.log('🚀 Initializing TaskMaster Deep Features...');

        // Merge config
        this.config = this._mergeConfig(config);

        try {
            // Initialize in order of dependencies
            await this._initAdvancedFeatures();
            await this._initCollaboration();
            await this._initAI();
            await this._initPlugins();
            await this._initAnalytics();

            this.initialized = true;

            // Emit ready event
            eventBus.emit(AppEvents.DEEP_FEATURES_READY, {
                features: this._getEnabledFeatures()
            });

            console.log('✅ Deep Features initialized successfully!');
            console.log('📦 Enabled features:', this._getEnabledFeatures());

        } catch (error) {
            console.error('❌ Deep Features initialization failed:', error);
            throw error;
        }
    }

    /**
     * Get feature status
     */
    getStatus() {
        return {
            initialized: this.initialized,
            features: {
                collaboration: !!this.collaboration,
                ai: !!this.ai,
                plugins: !!this.plugins,
                analytics: !!this.analytics,
                advanced: !!this.advanced
            },
            config: this.config
        };
    }

    /**
     * Enable/disable specific feature
     */
    async setFeatureEnabled(feature, enabled) {
        switch (feature) {
            case 'collaboration':
                if (enabled && !this.collaboration) {
                    await this._initCollaboration();
                } else if (!enabled && this.collaboration) {
                    this.collaboration.disableCollaboration();
                }
                break;
            case 'ai':
                if (enabled && !this.ai) {
                    await this._initAI();
                }
                break;
            case 'plugins':
                if (enabled && !this.plugins) {
                    await this._initPlugins();
                }
                break;
            case 'analytics':
                if (enabled && !this.analytics) {
                    await this._initAnalytics();
                }
                break;
            case 'advanced':
                if (enabled && !this.advanced) {
                    await this._initAdvancedFeatures();
                }
                break;
        }

        this.config[feature].enabled = enabled;
    }

    /**
     * Get all tasks (with CRDT if enabled)
     */
    getAllTasks() {
        if (this.collaboration?.collaborationMode) {
            return this.collaboration.getAllTasks();
        }
        return this.taskRepository.getAll();
    }

    /**
     * Create task (with AI analysis if enabled)
     */
    async createTask(taskData) {
        let task;

        // Run through AI pipeline first if enabled
        if (this.ai && this.config.ai.enabled) {
            const analysis = await this.ai.analyzeTask(taskData);
            
            // Auto-apply suggestions
            if (this.config.ai.autoCategorize && !taskData.categories) {
                taskData.categories = analysis.category.map(c => c.category);
            }
            if (this.config.ai.smartSuggestions && !taskData.priority) {
                taskData.priority = analysis.priority.priority;
            }
            if (this.config.ai.durationPrediction) {
                taskData.estimatedDuration = analysis.duration.duration;
            }
        }

        // Create via collaboration or repository
        if (this.collaboration?.collaborationMode) {
            task = this.collaboration.createTask(taskData);
        } else {
            task = await this.taskRepository.create(taskData);
        }

        return task;
    }

    /**
     * Update task
     */
    async updateTask(taskId, updates) {
        if (this.collaboration?.collaborationMode) {
            for (const [field, value] of Object.entries(updates)) {
                this.collaboration.updateTask(taskId, field, value);
            }
            return this.collaboration.getTask(taskId);
        }
        
        const task = await this.taskRepository.getById(taskId);
        Object.assign(task, updates);
        return this.taskRepository.save(task);
    }

    /**
     * Delete task
     */
    async deleteTask(taskId) {
        if (this.collaboration?.collaborationMode) {
            this.collaboration.deleteTask(taskId);
        } else {
            await this.taskRepository.delete(taskId);
        }
    }

    /**
     * Get analytics
     */
    async getAnalytics(options = {}) {
        if (!this.analytics) {
            await this._initAnalytics();
        }
        return this.analytics.engine.getAnalytics(options.dateRange);
    }

    /**
     * Render analytics dashboard
     */
    async renderAnalyticsDashboard(container, options = {}) {
        if (!this.analytics) {
            await this._initAnalytics();
        }
        return this.analytics.render({ ...options, container });
    }

    /**
     * Get AI suggestions
     */
    async getAISuggestions() {
        if (!this.ai) {
            await this._initAI();
        }
        return this.ai.getSmartSuggestions();
    }

    /**
     * Enable collaboration
     */
    async enableCollaboration(roomId) {
        if (!this.collaboration) {
            await this._initCollaboration();
        }
        this.collaboration.enableCollaboration(roomId);
        return this.collaboration.createInvite();
    }

    /**
     * Join collaboration room
     */
    async joinCollaboration(inviteCode) {
        if (!this.collaboration) {
            await this._initCollaboration();
        }
        return this.collaboration.joinViaInvite(inviteCode);
    }

    /**
     * Get plugin manager
     */
    getPluginManager() {
        return this.plugins;
    }

    /**
     * Get advanced features manager
     */
    getAdvancedFeatures() {
        return this.advanced;
    }

    /**
     * Destroy all features
     */
    async destroy() {
        console.log('🛑 Destroying Deep Features...');

        if (this.collaboration) {
            this.collaboration.disableCollaboration();
        }
        if (this.plugins) {
            // Destroy all plugins
            for (const plugin of this.plugins.plugins.values()) {
                await plugin.destroy();
            }
        }

        this.initialized = false;
        eventBus.emit(AppEvents.DEEP_FEATURES_DESTROY);
    }

    // ==================== Private Initialization Methods ====================

    async _initAdvancedFeatures() {
        if (!this.config.advanced.enabled) return;

        console.log('📌 Initializing Advanced Features...');
        this.advanced = new AdvancedFeaturesManager(this.taskRepository, this.ui);
        await this.advanced.initialize();
    }

    async _initCollaboration() {
        if (!this.config.collaboration.enabled) return;

        console.log('🤝 Initializing Collaboration Engine...');
        this.collaboration = new CollaborationManager(this.taskRepository, this.storage);
        await this.collaboration.initialize();
    }

    async _initAI() {
        if (!this.config.ai.enabled) return;

        console.log('🧠 Initializing AI/ML Pipeline...');
        this.ai = new AIManager(this.taskRepository, this.storage);
        await this.ai.initialize();
    }

    async _initPlugins() {
        if (!this.config.plugins.enabled) return;

        console.log('🔌 Initializing Plugin System...');
        this.plugins = await loadPlugins(this.taskRepository, this.ui, this.storage);
        
        // Enable allowed built-in plugins
        for (const pluginId of this.config.plugins.allowedBuiltins) {
            try {
                await this.plugins.enablePlugin(pluginId);
            } catch (e) {
                console.warn(`Failed to enable plugin ${pluginId}:`, e);
            }
        }
    }

    async _initAnalytics() {
        if (!this.config.analytics.enabled) return;

        console.log('📊 Initializing Analytics Dashboard...');
        this.analytics = new AnalyticsDashboard(
            this.taskRepository,
            this.config.analytics.dashboardContainer
        );
    }

    _mergeConfig(userConfig) {
        const merged = { ...this.config };
        
        for (const key of Object.keys(userConfig)) {
            if (typeof userConfig[key] === 'object' && userConfig[key] !== null) {
                merged[key] = { ...merged[key], ...userConfig[key] };
            } else {
                merged[key] = userConfig[key];
            }
        }
        
        return merged;
    }

    _getEnabledFeatures() {
        const features = [];
        if (this.config.collaboration.enabled) features.push('collaboration');
        if (this.config.ai.enabled) features.push('ai');
        if (this.config.plugins.enabled) features.push('plugins');
        if (this.config.analytics.enabled) features.push('analytics');
        if (this.config.advanced.enabled) features.push('advanced');
        return features;
    }
}

// ============================================
// CONVENIENCE API - Simple Usage
// ============================================

/**
 * Quick initialization with defaults
 */
export async function initDeepFeatures(taskRepository, ui, options = {}) {
    const manager = new DeepFeaturesManager(taskRepository, ui);
    await manager.initialize(options);
    return manager;
}

/**
 * Get singleton instance
 */
let _instance = null;

export function getDeepFeatures() {
    return _instance;
}

export function createDeepFeatures(taskRepository, ui, options = {}) {
    if (!_instance) {
        _instance = new DeepFeaturesManager(taskRepository, ui);
    }
    return _instance;
}

// Export main class and all sub-modules
export {
    DeepFeaturesManager,
    CollaborationManager,
    AIManager,
    PluginManager,
    AnalyticsDashboard,
    AdvancedFeaturesManager
};

// Export hooks for plugin developers
export { PluginHooks } from './plugins/plugin-system.js';

// Export CRDT types for collaboration
export { TaskCRDT, VectorClock, LWWRegister, ORSet } from './collaboration/crdt-engine.js';

// Export AI types
export { 
    FeatureExtractor,
    DurationPredictor,
    SmartCategorizer,
    PriorityRecommender,
    CompletionPredictor,
    PatternRecognizer
} from './ai-ml/ai-pipeline.js';

// Export event types
export const DeepFeatureEvents = {
    READY: 'deep-features:ready',
    DESTROY: 'deep-features:destroy',
    SYNC: 'deep-features:sync',
    AI_ANALYSIS: 'deep-features:ai:analysis',
    PLUGIN_LOADED: 'deep-features:plugin:loaded',
    ANALYTICS_UPDATED: 'deep-features:analytics:updated'
};
