/**
 * IndexedDB Storage Layer - Offline-First Persistent Storage
 * ===========================================================
 * Type-safe, transactional storage with automatic indexing
 */

import type { Task, Category, DomainEvent, Paginated, TimeRange } from '../types';

const DB_NAME = 'taskmaster-pro';
const DB_VERSION = 1;

export class IndexedDBStorage {
  private db: IDBDatabase | null = null;
  private openPromise: Promise<IDBDatabase> | null = null;

  /**
   * Open database connection
   */
  async open(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }

    if (this.openPromise) {
      return this.openPromise;
    }

    this.openPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        this.openPromise = null;
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.upgradeDatabase(db);
      };
    });

    return this.openPromise;
  }

  /**
   * Upgrade database schema
   */
  private upgradeDatabase(db: IDBDatabase): void {
    console.log('[IndexedDB] Upgrading database schema...');

    // Tasks store
    if (!db.objectStoreNames.contains('tasks')) {
      const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
      taskStore.createIndex('byStatus', 'status', { unique: false });
      taskStore.createIndex('byDueDate', 'dueDate', { unique: false });
      taskStore.createIndex('byPriority', 'priority', { unique: false });
      taskStore.createIndex('byCreatedAt', 'createdAt', { unique: false });
      taskStore.createIndex('byCompletedAt', 'completedAt', { unique: false });
    }

    // Categories store
    if (!db.objectStoreNames.contains('categories')) {
      const categoryStore = db.createObjectStore('categories', { keyPath: 'id' });
      categoryStore.createIndex('byName', 'name', { unique: true });
      categoryStore.createIndex('byParent', 'parentId', { unique: false });
    }

    // Events store (for event sourcing)
    if (!db.objectStoreNames.contains('events')) {
      const eventStore = db.createObjectStore('events', { keyPath: 'id' });
      eventStore.createIndex('byAggregateId', 'aggregateId', { unique: false });
      eventStore.createIndex('byTimestamp', 'timestamp', { unique: false });
      eventStore.createIndex('byType', 'type', { unique: false });
    }

    // Settings store
    if (!db.objectStoreNames.contains('settings')) {
      db.createObjectStore('settings', { keyPath: 'key' });
    }

    // Encrypted tasks store
    if (!db.objectStoreNames.contains('encryptedTasks')) {
      db.createObjectStore('encryptedTasks', { keyPath: 'id' });
    }
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(
    stores: string[],
    mode: IDBTransactionMode,
    callback: (stores: Record<string, IDBObjectStore>) => Promise<T>
  ): Promise<T> {
    const db = await this.open();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(stores, mode);
      const storeMap: Record<string, IDBObjectStore> = {};

      for (const storeName of stores) {
        const store = transaction.objectStore(storeName);
        if (!store) {
          reject(new Error(`Store ${storeName} not found`));
          return;
        }
        storeMap[storeName] = store;
      }

      let result: T;

      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(new Error('Transaction aborted'));

      Promise.resolve()
        .then(() => callback(storeMap))
        .then(res => {
          result = res;
        })
        .catch(reject);
    });
  }

  // ============================================
  // TASK OPERATIONS
  // ============================================

  async saveTask(task: Task): Promise<void> {
    await this.transaction(['tasks'], 'readwrite', async (stores) => {
      await this.put(stores.tasks, task);
    });
    console.log(`[IndexedDB] Saved task: ${task.id}`);
  }

  async getTask(id: string): Promise<Task | null> {
    return this.get('tasks', id);
  }

  async getAllTasks(): Promise<Task[]> {
    return this.getAll('tasks');
  }

  async getTasksByStatus(status: Task['status']): Promise<Task[]> {
    return this.getByIndex<Task>('tasks', 'byStatus', status);
  }

  async getTasksByDateRange(range: TimeRange): Promise<Task[]> {
    const tasks = await this.getAll<Task>('tasks');
    const start = range.start.getTime();
    const end = range.end.getTime();

    return tasks.filter((task): task is Task => {
      if (!task.dueDate) return false;
      const dueDate = new Date(task.dueDate).getTime();
      return dueDate >= start && dueDate <= end;
    });
  }

  async getPaginatedTasks(
    page: number,
    pageSize: number,
    filter?: Partial<Task>
  ): Promise<Paginated<Task>> {
    let tasks = await this.getAll<Task>('tasks');

    // Apply filters
    if (filter) {
      if (filter.status) {
        tasks = tasks.filter(t => t.status === filter.status);
      }
      if (filter.priority) {
        tasks = tasks.filter(t => t.priority === filter.priority);
      }
    }

    // Sort by created date (newest first)
    tasks.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Paginate
    const total = tasks.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const items = tasks.slice(start, start + pageSize);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
      hasMore: page < totalPages
    };
  }

  async deleteTask(id: string): Promise<void> {
    await this.delete('tasks', id);
    console.log(`[IndexedDB] Deleted task: ${id}`);
  }

  async bulkSaveTasks(tasks: Task[]): Promise<void> {
    await this.transaction(['tasks'], 'readwrite', async (stores) => {
      for (const task of tasks) {
        await this.put(stores.tasks, task);
      }
    });
    console.log(`[IndexedDB] Bulk saved ${tasks.length} tasks`);
  }

  // ============================================
  // CATEGORY OPERATIONS
  // ============================================

  async saveCategory(category: Category): Promise<void> {
    await this.transaction(['categories'], 'readwrite', async (stores) => {
      await this.put(stores.categories, category);
    });
  }

  async getAllCategories(): Promise<Category[]> {
    return this.getAll<Category>('categories');
  }

  async deleteCategory(id: string): Promise<void> {
    await this.delete('categories', id);
  }

  // ============================================
  // EVENT OPERATIONS
  // ============================================

  async saveEvent(event: DomainEvent): Promise<void> {
    await this.transaction(['events'], 'readwrite', async (stores) => {
      await this.put(stores.events, event);
    });
  }

  async getEvents(aggregateId: string): Promise<DomainEvent[]> {
    return this.getByIndex('events', 'byAggregateId', aggregateId);
  }

  async getAllEvents(): Promise<DomainEvent[]> {
    return this.getAll<DomainEvent>('events');
  }

  async getEventsSince(timestamp: string): Promise<DomainEvent[]> {
    const events = await this.getAll<DomainEvent>('events');
    return events.filter(e => new Date(e.timestamp).getTime() >= new Date(timestamp).getTime());
  }

  async clearEvents(): Promise<void> {
    await this.clear('events');
  }

  // ============================================
  // SETTINGS OPERATIONS
  // ============================================

  async saveSettings(key: string, value: unknown): Promise<void> {
    await this.transaction(['settings'], 'readwrite', async (stores) => {
      await this.put(stores.settings, { key, value });
    });
  }

  async getSettings<T>(key: string): Promise<T | null> {
    const result = await this.get<{ key: string; value: T }>('settings', key);
    return result?.value ?? null;
  }

  async getAllSettings(): Promise<Record<string, unknown>> {
    const settings = await this.getAll<{ key: string; value: unknown }>('settings');
    return settings.reduce((acc: Record<string, unknown>, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {} as Record<string, unknown>);
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  private async get<T>(storeName: string, key: string): Promise<T | null> {
    const db = await this.open();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      if (!store) {
        reject(new Error(`Store ${storeName} not found`));
        return;
      }
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  private async getAll<T>(storeName: string): Promise<T[]> {
    const db = await this.open();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      if (!store) {
        reject(new Error(`Store ${storeName} not found`));
        return;
      }
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  }

  private async getByIndex<T>(
    storeName: string,
    indexName: string,
    value: unknown
  ): Promise<T[]> {
    const db = await this.open();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      if (!store) {
        reject(new Error(`Store ${storeName} not found`));
        return;
      }
      const index = store.index(indexName);
      const request = index.getAll(value as IDBValidKey);

      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  }

  private async put<T>(store: IDBObjectStore | undefined, value: T): Promise<void> {
    if (!store) {
      throw new Error('Store is undefined');
    }
    return new Promise((resolve, reject) => {
      const request = store.put(value);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async delete(storeName: string, key: string): Promise<void> {
    const db = await this.open();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      if (!store) {
        reject(new Error(`Store ${storeName} not found`));
        return;
      }
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async clear(storeName: string): Promise<void> {
    const db = await this.open();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      if (!store) {
        reject(new Error(`Store ${storeName} not found`));
        return;
      }
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Export all data for backup
   */
  async export(): Promise<string> {
    const [tasks, categories, events, settings] = await Promise.all([
      this.getAll<Task>('tasks'),
      this.getAll<Category>('categories'),
      this.getAll<DomainEvent>('events'),
      this.getAll<{ key: string; value: unknown }>('settings')
    ]);

    return JSON.stringify({
      tasks,
      categories,
      events,
      settings,
      exportedAt: new Date().toISOString()
    }, null, 2);
  }

  /**
   * Import data from backup
   */
  async import(json: string): Promise<void> {
    const data = JSON.parse(json);

    await this.transaction(
      ['tasks', 'categories', 'events', 'settings'],
      'readwrite',
      async (stores) => {
        if (data.tasks) {
          for (const task of data.tasks) {
            await this.put(stores.tasks, task);
          }
        }
        if (data.categories) {
          for (const category of data.categories) {
            await this.put(stores.categories, category);
          }
        }
        if (data.events) {
          for (const event of data.events) {
            await this.put(stores.events, event);
          }
        }
        if (data.settings) {
          for (const setting of data.settings) {
            await this.put(stores.settings, setting);
          }
        }
      }
    );

    console.log('[IndexedDB] Import completed');
  }

  /**
   * Clear all data (factory reset)
   */
  async clearAll(): Promise<void> {
    await Promise.all([
      this.clear('tasks'),
      this.clear('categories'),
      this.clear('events'),
      this.clear('settings'),
      this.clear('encryptedTasks')
    ]);
    console.warn('[IndexedDB] All data cleared');
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    tasks: number;
    categories: number;
    events: number;
    settings: number;
  }> {
    const [tasks, categories, events, settings] = await Promise.all([
      this.getAll<Task>('tasks'),
      this.getAll<Category>('categories'),
      this.getAll<DomainEvent>('events'),
      this.getAll<{ key: string; value: unknown }>('settings')
    ]);

    return {
      tasks: tasks.length,
      categories: categories.length,
      events: events.length,
      settings: settings.length
    };
  }
}

// Singleton instance
export const db = new IndexedDBStorage();
