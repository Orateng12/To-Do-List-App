/**
 * IndexedDB Storage Layer
 * ========================
 * Advanced browser storage with transactions, versioning, and queries
 * 
 * Features:
 * - Promise-based API
 * - Automatic versioning and migrations
 * - Indexed queries
 * - Transaction support
 * - Bulk operations
 */

class IndexedDBStorage {
    constructor(dbName = 'TaskMasterDB', version = 1) {
        this.dbName = dbName;
        this.version = version;
        this.db = null;
        this.stores = {
            tasks: 'tasks',
            settings: 'settings',
            sync: 'sync'
        };
    }

    /**
     * Initialize/open the database
     * @returns {Promise<IDBDatabase>}
     */
    async open() {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                this._createSchema(db);
            };
        });
    }

    /**
     * Create database schema
     * @private
     */
    _createSchema(db) {
        // Tasks store with indexes
        if (!db.objectStoreNames.contains(this.stores.tasks)) {
            const tasksStore = db.createObjectStore(this.stores.tasks, {
                keyPath: 'id',
                autoIncrement: false
            });
            tasksStore.createIndex('completed', 'completed', { unique: false });
            tasksStore.createIndex('priority', 'priority', { unique: false });
            tasksStore.createIndex('dueDate', 'dueDate', { unique: false });
            tasksStore.createIndex('createdAt', 'createdAt', { unique: false });
            tasksStore.createIndex('completed_created', ['completed', 'createdAt'], { unique: false });
            // New indexes for subtasks and recurrence
            tasksStore.createIndex('parentId', 'parentId', { unique: false });
            tasksStore.createIndex('recurrence', 'recurrence', { unique: false });
        }

        // Settings store
        if (!db.objectStoreNames.contains(this.stores.settings)) {
            db.createObjectStore(this.stores.settings, { keyPath: 'key' });
        }

        // Sync metadata store
        if (!db.objectStoreNames.contains(this.stores.sync)) {
            db.createObjectStore(this.stores.sync, { keyPath: 'id' });
        }
    }

    /**
     * Execute a transaction
     * @param {string} storeName - Store name
     * @param {string} mode - Transaction mode (readonly, readwrite)
     * @param {Function} callback - Callback with store
     * @returns {Promise<any>}
     */
    async transaction(storeName, mode, callback) {
        await this.open();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, mode);
            const store = transaction.objectStore(storeName);
            let result = null;

            transaction.oncomplete = () => resolve(result);
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(new Error('Transaction aborted'));

            const storeProxy = {
                get: (key) => this._wrapRequest(store.get(key)),
                getAll: (query, limit) => this._wrapRequest(store.getAll(query, limit)),
                put: (value) => this._wrapRequest(store.put(value)),
                add: (value) => this._wrapRequest(store.add(value)),
                delete: (key) => this._wrapRequest(store.delete(key)),
                count: (query) => this._wrapRequest(store.count(query)),
                openCursor: (range, direction) => store.openCursor(range, direction),
                index: (name) => store.index(name)
            };

            const callbackResult = callback(storeProxy, transaction);
            if (callbackResult instanceof Promise) {
                callbackResult.then(r => result = r);
            } else {
                result = callbackResult;
            }
        });
    }

    /**
     * Wrap IDBRequest in Promise
     * @private
     */
    _wrapRequest(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // ==================== Task Operations ====================

    /**
     * Get all tasks
     * @returns {Promise<Array>}
     */
    async getAllTasks() {
        return this.transaction(this.stores.tasks, 'readonly', store => store.getAll());
    }

    /**
     * Get a single task by ID
     * @param {string} id - Task ID
     * @returns {Promise<Object|null>}
     */
    async getTask(id) {
        return this.transaction(this.stores.tasks, 'readonly', store => store.get(id));
    }

    /**
     * Save a task (insert or update)
     * @param {Object} task - Task object
     * @returns {Promise<string>} Task ID
     */
    async saveTask(task) {
        return this.transaction(this.stores.tasks, 'readwrite', store => {
            store.put(task);
            return task.id;
        });
    }

    /**
     * Save multiple tasks in batch
     * @param {Array<Object>} tasks - Array of task objects
     * @returns {Promise<Array<string>>} Array of task IDs
     */
    async saveTasksBatch(tasks) {
        return this.transaction(this.stores.tasks, 'readwrite', store => {
            const ids = [];
            tasks.forEach(task => {
                store.put(task);
                ids.push(task.id);
            });
            return ids;
        });
    }

    /**
     * Delete a task
     * @param {string} id - Task ID
     * @returns {Promise<void>}
     */
    async deleteTask(id) {
        return this.transaction(this.stores.tasks, 'readwrite', store => {
            store.delete(id);
        });
    }

    /**
     * Get tasks by filter
     * @param {Object} filters - Filter criteria
     * @returns {Promise<Array>}
     */
    async queryTasks(filters = {}) {
        return this.transaction(this.stores.tasks, 'readonly', async store => {
            let results = await store.getAll();

            // Apply filters
            if (filters.completed !== undefined) {
                results = results.filter(t => t.completed === filters.completed);
            }
            if (filters.priority) {
                results = results.filter(t => t.priority === filters.priority);
            }
            if (filters.search) {
                const query = filters.search.toLowerCase();
                results = results.filter(t => t.text.toLowerCase().includes(query));
            }
            if (filters.dueBefore) {
                results = results.filter(t => t.dueDate && t.dueDate < filters.dueBefore);
            }

            // Sort
            if (filters.sortBy) {
                results.sort((a, b) => {
                    const aVal = a[filters.sortBy];
                    const bVal = b[filters.sortBy];
                    if (filters.sortDesc) {
                        return bVal > aVal ? 1 : -1;
                    }
                    return aVal > bVal ? 1 : -1;
                });
            }

            return results;
        });
    }

    /**
     * Get tasks using index for better performance
     * @param {string} indexName - Index to use
     * @param {IDBKeyRange} range - Key range
     * @returns {Promise<Array>}
     */
    async queryByIndex(indexName, range) {
        return this.transaction(this.stores.tasks, 'readonly', store => {
            const index = store.index(indexName);
            return index.getAll(range);
        });
    }

    /**
     * Clear all tasks
     * @returns {Promise<void>}
     */
    async clearTasks() {
        return this.transaction(this.stores.tasks, 'readwrite', store => {
            store.clear();
        });
    }

    /**
     * Get task count
     * @returns {Promise<number>}
     */
    async getTaskCount() {
        return this.transaction(this.stores.tasks, 'readonly', store => store.count());
    }

    // ==================== Settings Operations ====================

    /**
     * Save a setting
     * @param {string} key - Setting key
     * @param {any} value - Setting value
     * @returns {Promise<void>}
     */
    async saveSetting(key, value) {
        return this.transaction(this.stores.settings, 'readwrite', store => {
            store.put({ key, value, updatedAt: new Date().toISOString() });
        });
    }

    /**
     * Get a setting
     * @param {string} key - Setting key
     * @param {any} defaultValue - Default value if not found
     * @returns {Promise<any>}
     */
    async getSetting(key, defaultValue = null) {
        const result = await this.transaction(this.stores.settings, 'readonly', store => {
            return store.get(key);
        });
        return result ? result.value : defaultValue;
    }

    /**
     * Get all settings
     * @returns {Promise<Object>}
     */
    async getAllSettings() {
        const settings = await this.transaction(this.stores.settings, 'readonly', store => {
            return store.getAll();
        });
        return settings.reduce((acc, { key, value }) => {
            acc[key] = value;
            return acc;
        }, {});
    }

    // ==================== Sync Operations ====================

    /**
     * Save sync metadata
     * @param {string} id - Sync ID
     * @param {Object} data - Sync data
     * @returns {Promise<void>}
     */
    async saveSyncData(id, data) {
        return this.transaction(this.stores.sync, 'readwrite', store => {
            store.put({ id, ...data, timestamp: Date.now() });
        });
    }

    /**
     * Get sync metadata
     * @param {string} id - Sync ID
     * @returns {Promise<Object|null>}
     */
    async getSyncData(id) {
        return this.transaction(this.stores.sync, 'readonly', store => store.get(id));
    }

    // ==================== Utility Methods ====================

    /**
     * Export all data
     * @returns {Promise<Object>}
     */
    async exportData() {
        const tasks = await this.getAllTasks();
        const settings = await this.getAllSettings();
        
        return {
            version: this.version,
            exportedAt: new Date().toISOString(),
            tasks,
            settings
        };
    }

    /**
     * Import data
     * @param {Object} data - Data to import
     * @returns {Promise<Object>} Import statistics
     */
    async importData(data) {
        const stats = {
            tasksImported: 0,
            settingsImported: 0,
            errors: []
        };

        if (data.tasks && Array.isArray(data.tasks)) {
            try {
                await this.saveTasksBatch(data.tasks);
                stats.tasksImported = data.tasks.length;
            } catch (e) {
                stats.errors.push(`Tasks import error: ${e.message}`);
            }
        }

        if (data.settings && typeof data.settings === 'object') {
            for (const [key, value] of Object.entries(data.settings)) {
                try {
                    await this.saveSetting(key, value);
                    stats.settingsImported++;
                } catch (e) {
                    stats.errors.push(`Setting "${key}" import error: ${e.message}`);
                }
            }
        }

        return stats;
    }

    /**
     * Close the database
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    /**
     * Delete the database
     * @returns {Promise<void>}
     */
    async deleteDatabase() {
        this.close();
        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(this.dbName);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

// Export singleton instance
export const db = new IndexedDBStorage();

export { IndexedDBStorage };
