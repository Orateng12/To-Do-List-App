/**
 * Storage Module - IndexedDB + localStorage Hybrid
 * =================================================
 * Provides persistent storage with automatic fallback
 */

import { eventBus, EVENTS } from './event-bus.js';

const DB_NAME = 'TaskMasterDB';
const DB_VERSION = 1;
const STORE_NAME = 'tasks';

class StorageManager {
    constructor() {
        this.db = null;
        this.useIndexedDB = true;
    }

    /**
     * Initialize storage (try IndexedDB, fallback to localStorage)
     */
    async init() {
        try {
            await this.initIndexedDB();
            console.log('✓ Using IndexedDB for storage');
        } catch (error) {
            console.warn('IndexedDB not available, falling back to localStorage');
            this.useIndexedDB = false;
        }
    }

    /**
     * Initialize IndexedDB
     */
    initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object store if it doesn't exist
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    store.createIndex('completed', 'completed', { unique: false });
                    store.createIndex('priority', 'priority', { unique: false });
                    store.createIndex('dueDate', 'dueDate', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
            };
        });
    }

    /**
     * Save all tasks
     * @param {Array} tasks - Array of task objects
     */
    async save(tasks) {
        try {
            if (this.useIndexedDB && this.db) {
                await this.saveIndexedDB(tasks);
            } else {
                this.saveLocalStorage(tasks);
            }
            eventBus.emit(EVENTS.STORAGE_SAVED, { count: tasks.length });
        } catch (error) {
            console.error('Storage save error:', error);
            eventBus.emit(EVENTS.STORAGE_ERROR, { error: error.message });
        }
    }

    /**
     * Save to IndexedDB
     */
    saveIndexedDB(tasks) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            // Clear existing data
            const clearRequest = store.clear();
            
            clearRequest.onsuccess = () => {
                // Add all tasks
                tasks.forEach(task => {
                    store.put(task);
                });
            };

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    /**
     * Save to localStorage (fallback)
     */
    saveLocalStorage(tasks) {
        try {
            localStorage.setItem('taskmaster-tasks', JSON.stringify(tasks));
            // Also save metadata
            const metadata = {
                version: '2.0',
                lastModified: new Date().toISOString(),
                taskCount: tasks.length
            };
            localStorage.setItem('taskmaster-metadata', JSON.stringify(metadata));
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                eventBus.emit(EVENTS.TOAST_SHOW, {
                    message: 'Storage full! Consider exporting and clearing old tasks.',
                    type: 'error'
                });
            }
            throw error;
        }
    }

    /**
     * Load all tasks
     * @returns {Promise<Array>} Array of task objects
     */
    async load() {
        try {
            if (this.useIndexedDB && this.db) {
                return await this.loadIndexedDB();
            } else {
                return this.loadLocalStorage();
            }
        } catch (error) {
            console.error('Storage load error:', error);
            eventBus.emit(EVENTS.STORAGE_ERROR, { error: error.message });
            return [];
        }
    }

    /**
     * Load from IndexedDB
     */
    loadIndexedDB() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                const tasks = request.result || [];
                eventBus.emit(EVENTS.STORAGE_LOADED, { count: tasks.length });
                resolve(tasks);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Load from localStorage (fallback)
     */
    loadLocalStorage() {
        try {
            const stored = localStorage.getItem('taskmaster-tasks');
            if (!stored) {
                return [];
            }
            const tasks = JSON.parse(stored);
            if (!Array.isArray(tasks)) {
                return [];
            }
            eventBus.emit(EVENTS.STORAGE_LOADED, { count: tasks.length });
            return tasks;
        } catch (error) {
            console.error('localStorage load error:', error);
            return [];
        }
    }

    /**
     * Export tasks to JSON file
     */
    exportTasks(tasks) {
        const exportData = {
            version: '2.0',
            exportedAt: new Date().toISOString(),
            tasks: tasks,
            metadata: {
                totalTasks: tasks.length,
                completedTasks: tasks.filter(t => t.completed).length,
                categories: [...new Set(tasks.flatMap(t => t.categories || []))]
            }
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `taskmaster-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        eventBus.emit(EVENTS.TOAST_SHOW, {
            message: 'Tasks exported successfully!',
            type: 'success'
        });
    }

    /**
     * Import tasks from JSON file
     * @returns {Promise<Array>} Imported tasks
     */
    importTasks(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    
                    if (!data.tasks || !Array.isArray(data.tasks)) {
                        throw new Error('Invalid file format');
                    }

                    // Validate and clean imported tasks
                    const importedTasks = data.tasks.map(task => ({
                        id: task.id || Date.now().toString(36) + Math.random().toString(36).substr(2),
                        text: task.text || '',
                        completed: !!task.completed,
                        priority: task.priority || 'medium',
                        dueDate: task.dueDate || '',
                        createdAt: task.createdAt || new Date().toISOString(),
                        categories: task.categories || [],
                        subtasks: task.subtasks || [],
                        notes: task.notes || ''
                    })).filter(task => task.text.trim());

                    resolve(importedTasks);
                } catch (error) {
                    reject(new Error('Failed to parse import file: ' + error.message));
                }
            };

            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * Clear all data
     */
    async clear() {
        try {
            if (this.useIndexedDB && this.db) {
                await this.clearIndexedDB();
            } else {
                this.clearLocalStorage();
            }
        } catch (error) {
            console.error('Storage clear error:', error);
            throw error;
        }
    }

    /**
     * Clear IndexedDB
     */
    clearIndexedDB() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Clear localStorage
     */
    clearLocalStorage() {
        localStorage.removeItem('taskmaster-tasks');
        localStorage.removeItem('taskmaster-metadata');
    }

    /**
     * Get storage usage info
     * @returns {Promise<Object>} Storage statistics
     */
    async getStorageInfo() {
        if (this.useIndexedDB) {
            return {
                type: 'IndexedDB',
                taskCount: await this.getIndexedDBCount()
            };
        } else {
            const tasks = this.loadLocalStorage();
            return {
                type: 'localStorage',
                taskCount: tasks.length,
                usage: localStorage.getItem('taskmaster-tasks')?.length || 0
            };
        }
    }

    /**
     * Get task count from IndexedDB
     */
    getIndexedDBCount() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.count();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}

// Export singleton instance
export const storage = new StorageManager();
