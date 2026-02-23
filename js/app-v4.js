/**
 * TaskMaster v4.0 - Ultra Advanced Integration Module
 * ====================================================
 * Brings together all advanced features into a cohesive application
 */

import { eventBus, EVENTS } from './core/event-bus.js';
import { container, Logger, Config, Cache, EventAggregator } from './di/container.js';
import { createCQRS, Commands, Queries } from './advanced/cqrs.js';
import { createCRDTStore } from './crdt/crdt.js';
import { createTaskStateMachine, stateMachineManager } from './advanced/state-machine.js';
import { createRuleEngine } from './advanced/rule-engine.js';
import { createMLSystem } from './ml/prediction.js';
import { createEncryptedStore } from './crypto/encryption.js';
import { createSyncClient } from './advanced/sync-client.js';

/**
 * Main Application Class
 */
class TaskMasterApp {
    constructor() {
        this.initialized = false;
        this.services = {};
        this.config = null;
    }

    /**
     * Initialize the application with all advanced features
     */
    async init(options = {}) {
        console.log('🚀 TaskMaster v4.0 Ultra initializing...');
        
        const startTime = performance.now();

        try {
            // 1. Initialize DI Container
            this.services.config = container.get('config');
            this.services.logger = container.get('logger');
            this.services.cache = container.get('cache');
            this.services.events = container.get('events');
            
            this.config = this.services.config.getAll();
            this.services.logger.info('DI Container initialized');

            // 2. Initialize CQRS
            if (this.config.get('features.eventSourcing', true)) {
                const { bus, repository, eventStore } = await createCQRS();
                this.services.cqrs = { bus, repository, eventStore };
                this.services.logger.info('CQRS system initialized');
            }

            // 3. Initialize CRDT Store
            if (this.config.get('features.crdt', true)) {
                this.services.crdt = createCRDTStore();
                this.services.logger.info('CRDT store initialized');
            }

            // 4. Initialize State Machines
            this.services.stateMachines = stateMachineManager;
            this.services.logger.info('State machine manager initialized');

            // 5. Initialize Rule Engine
            this.services.ruleEngine = createRuleEngine(this.createTaskAPI());
            this.services.logger.info('Rule engine initialized');

            // 6. Initialize ML System
            if (this.config.get('features.analytics', true)) {
                const { analyzer, suggestions } = createMLSystem();
                this.services.ml = { analyzer, suggestions };
                this.services.logger.info('ML prediction system initialized');
            }

            // 7. Initialize Encryption
            this.services.encryption = createEncryptedStore();
            await this.services.encryption.store.init();
            this.services.logger.info('Encryption store initialized');

            // 8. Initialize Sync Client (optional)
            if (options.syncUrl) {
                this.services.sync = createSyncClient(options.syncUrl);
                this.services.logger.info('Sync client initialized', { url: options.syncUrl });
            }

            // 9. Setup event handlers
            this.setupEventHandlers();

            // 10. Load initial data
            await this.loadInitialData();

            this.initialized = true;
            
            const duration = performance.now() - startTime;
            this.services.logger.info('✅ TaskMaster v4.0 Ultra ready!', { 
                duration: `${Math.round(duration)}ms`,
                features: Object.keys(this.services)
            });

            // Emit ready event
            eventBus.emit(EVENTS.APP_READY, { 
                services: Object.keys(this.services),
                config: this.config
            });

        } catch (error) {
            this.services.logger.error('❌ Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Create Task API for rule engine
     */
    createTaskAPI() {
        return {
            createTask: async (task) => {
                if (this.services.cqrs) {
                    const result = await this.services.cqrs.bus.send(
                        Commands.createTask(task)
                    );
                    return result;
                }
                return { taskId: Date.now().toString() };
            },
            updateTask: async (taskId, updates) => {
                if (this.services.cqrs) {
                    await this.services.cqrs.bus.send(
                        Commands.updateTask(taskId, updates.text)
                    );
                }
            },
            completeTask: async (taskId) => {
                if (this.services.cqrs) {
                    await this.services.cqrs.bus.send(
                        Commands.completeTask(taskId)
                    );
                }
            },
            uncompleteTask: async (taskId) => {
                if (this.services.cqrs) {
                    await this.services.cqrs.bus.send(
                        Commands.uncompleteTask(taskId)
                    );
                }
            },
            addSubtask: async (taskId, text) => {
                // Subtask implementation
            }
        };
    }

    /**
     * Setup global event handlers
     */
    setupEventHandlers() {
        // Task created - trigger ML prediction
        eventBus.on(EVENTS.TASK_ADDED, (data) => {
            if (this.services.ml) {
                const suggestions = this.services.ml.suggestions.onTaskCreate(data.task.text);
                if (suggestions.length > 0) {
                    this.services.logger.debug('ML suggestions:', suggestions);
                }
            }

            // Trigger rule engine
            if (this.services.ruleEngine) {
                this.services.ruleEngine.processTask(data.task);
            }
        });

        // Task completed - record for ML
        eventBus.on(EVENTS.TASK_COMPLETED, (data) => {
            if (this.services.ml) {
                this.services.ml.analyzer.recordTask(data.task);
            }

            // Update state machine
            if (data.taskId) {
                stateMachineManager.fire(data.taskId, 'complete').catch(() => {});
            }
        });

        // Sync events
        if (this.services.sync) {
            eventBus.on(EVENTS.TASKS_CHANGED, (data) => {
                // Sync changes to server
                this.services.sync.broadcastCRDT('default');
            });
        }

        // Cache invalidation
        eventBus.on(EVENTS.TASKS_CHANGED, () => {
            this.services.cache.clear();
        });
    }

    /**
     * Load initial data
     */
    async loadInitialData() {
        // Load from CQRS read model
        if (this.services.cqrs) {
            await this.services.cqrs.repository.rebuildProjections();
        }

        // Unlock encrypted store if password available
        const savedPassword = localStorage.getItem('taskmaster-password');
        if (savedPassword && this.services.encryption.store) {
            const count = await this.services.encryption.store.unlock(savedPassword);
            this.services.logger.info(`Unlocked ${count} encrypted tasks`);
        }
    }

    // ========================================================================
    // Public API
    // ========================================================================

    /**
     * Create a new task with all features
     */
    async createTask(text, options = {}) {
        const taskData = {
            text,
            priority: options.priority || 'medium',
            dueDate: options.dueDate,
            categories: options.categories || [],
            isEncrypted: options.isEncrypted || false
        };

        // Get ML suggestions
        if (this.services.ml && !options.skipSuggestions) {
            const suggestions = this.services.ml.suggestions.onTaskCreate(text);
            suggestions.forEach(s => {
                if (s.type === 'category' && !taskData.categories.includes(s.value)) {
                    taskData.categories.push(s.value);
                }
                if (s.type === 'priority' && !taskData.priority) {
                    taskData.priority = s.value;
                }
            });
        }

        // Create via CQRS
        if (this.services.cqrs) {
            const result = await this.services.cqrs.bus.send(
                Commands.createTask(taskData)
            );
            
            // Create state machine
            stateMachineManager.create(result.taskId, taskData);
            
            return result;
        }

        return { taskId: Date.now().toString() };
    }

    /**
     * Complete a task
     */
    async completeTask(taskId) {
        if (this.services.cqrs) {
            await this.services.cqrs.bus.send(
                Commands.completeTask(taskId)
            );
        }
        
        await stateMachineManager.fire(taskId, 'complete');
    }

    /**
     * Get tasks with advanced filtering
     */
    async getTasks(filter = {}) {
        if (this.services.cqrs) {
            if (filter.priority) {
                return await this.services.cqrs.bus.ask(
                    Queries.getTasksByPriority(filter.priority)
                );
            }
            if (filter.overdue) {
                return await this.services.cqrs.bus.ask(
                    Queries.getOverdueTasks()
                );
            }
            return await this.services.cqrs.bus.ask(
                Queries.getAllTasks()
            );
        }
        return [];
    }

    /**
     * Get analytics
     */
    getAnalytics() {
        if (this.services.ml) {
            return this.services.ml.analyzer.analyzeProductivity();
        }
        return null;
    }

    /**
     * Get ML suggestions for task
     */
    getSuggestions(text) {
        if (this.services.ml) {
            return this.services.ml.suggestions.onTaskCreate(text);
        }
        return [];
    }

    /**
     * Lock encrypted store
     */
    lockEncryptedStore() {
        if (this.services.encryption) {
            this.services.encryption.store.lock();
            localStorage.removeItem('taskmaster-password');
        }
    }

    /**
     * Unlock encrypted store
     */
    async unlockEncryptedStore(password) {
        if (this.services.encryption) {
            const count = await this.services.encryption.store.unlock(password);
            localStorage.setItem('taskmaster-password', password);
            return count;
        }
        return 0;
    }

    /**
     * Join collaboration room
     */
    joinRoom(roomId, userId) {
        if (this.services.sync) {
            this.services.sync.joinRoom(roomId);
        }
    }

    /**
     * Get app statistics
     */
    getStats() {
        const stats = {
            initialized: this.initialized,
            services: Object.keys(this.services),
            config: this.config
        };

        if (this.services.cqrs) {
            stats.eventStore = this.services.cqrs.eventStore.getStats();
        }

        if (this.services.crdt) {
            stats.crdt = this.services.crdt.getStats();
        }

        if (this.services.ruleEngine) {
            stats.rules = this.services.ruleEngine.getStats();
        }

        if (this.services.sync) {
            stats.sync = this.services.sync.getStats();
        }

        return stats;
    }

    /**
     * Export all data
     */
    async exportData() {
        const exportData = {
            version: '4.0.0',
            exportedAt: new Date().toISOString(),
            tasks: await this.getTasks(),
            analytics: this.getAnalytics(),
            mlModel: this.services.ml?.analyzer.exportModel(),
            crdtState: this.services.crdt?.exportState()
        };

        return exportData;
    }

    /**
     * Import data
     */
    async importData(data) {
        if (data.tasks) {
            for (const task of data.tasks) {
                await this.createTask(task.text, {
                    priority: task.priority,
                    dueDate: task.dueDate,
                    categories: task.categories,
                    skipSuggestions: true
                });
            }
        }

        if (data.mlModel && this.services.ml) {
            this.services.ml.analyzer.importModel(data.mlModel);
        }

        return { imported: true };
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.services.sync) {
            this.services.sync.disconnect();
        }
        
        this.services.cache.clear();
        container.clear();
        
        this.initialized = false;
        this.services.logger.info('Application destroyed');
    }
}

// Create and export singleton instance
export const app = new TaskMasterApp();

// Auto-initialize on DOM ready
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        app.init().catch(console.error);
    });
}

// Expose globally for debugging
if (typeof window !== 'undefined') {
    window.TaskMaster = app;
    window.TaskMasterApp = TaskMasterApp;
}

export default app;
