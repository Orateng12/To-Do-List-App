/**
 * TaskMaster Pro - Main Application Entry Point
 * ==============================================
 *
 * Architecture:
 * - Event Sourcing for audit trail and time-travel
 * - CQRS for separating reads and writes
 * - IndexedDB for offline-first storage
 * - Web Workers for background processing
 * - E2E Encryption for sensitive data
 * - NLP for natural language task creation
 * - Pomodoro timer for focus sessions
 * - Analytics for productivity insights
 * - Time blocking for scheduling
 * - Cloud sync for real-time collaboration
 */

import { eventStore } from './core/EventStore';
import { commandBus } from './core/CommandBus';
import { db } from './storage/IndexedDB';
import { isEncryptionSupported } from './security/Encryption';
import { parseNaturalLanguage } from './nlp/TaskParser';
import { pomodoroTimer } from './features/PomodoroTimer';
import { analyticsEngine } from './features/AnalyticsEngine';
import { timeBlockingEngine } from './features/TimeBlocking';
import { cloudSyncEngine } from './features/CloudSync';
import type { Task, Command, DomainEvent, AppSettings, Priority, RecurrencePattern, Analytics } from './types';

// ============================================
// APPLICATION STATE
// ============================================

class TaskMasterApp {
  private tasks: Map<string, Task> = new Map();
  private settings: AppSettings = this.getDefaultSettings();
  private worker: Worker | null = null;
  private initialized = false;

  /**
   * Initialize the application
   */
  async init(): Promise<void> {
    console.log('🚀 TaskMaster Pro initializing...');

    try {
      // Initialize storage
      await db.open();
      console.log('✓ IndexedDB initialized');

      // Load settings
      await this.loadSettings();

      // Initialize encryption if enabled
      if (this.settings.encryptionEnabled) {
        await this.initializeEncryption();
      }

      // Load tasks from storage
      await this.loadTasks();

      // Initialize Web Worker
      this.initWorker();

      // Initialize features
      this.initFeatures();

      // Register command handlers
      this.registerCommands();

      // Set up event listeners
      this.setupEventListeners();

      // Rebuild state from events
      await this.rebuildStateFromEvents();

      this.initialized = true;
      console.log('✓ TaskMaster Pro ready');
      console.log(`  - ${this.tasks.size} tasks loaded`);
      console.log(`  - Encryption: ${this.settings.encryptionEnabled ? 'enabled' : 'disabled'}`);
      console.log(`  - Theme: ${this.settings.theme}`);

    } catch (error) {
      console.error('❌ Failed to initialize TaskMaster Pro:', error);
      throw error;
    }
  }

  /**
   * Get default settings
   */
  private getDefaultSettings(): AppSettings {
    return {
      theme: 'dark',
      defaultPriority: 'medium',
      defaultRecurrence: 'none',
      notificationsEnabled: true,
      soundEnabled: true,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      weekStartsOn: 'sunday',
      dateFormat: 'MM/dd/yyyy',
      timeFormat: '12h',
      encryptionEnabled: false
    };
  }

  /**
   * Load settings from storage
   */
  private async loadSettings(): Promise<void> {
    const saved = await db.getAllSettings();
    
    if (saved && Object.keys(saved).length > 0) {
      this.settings = { ...this.getDefaultSettings(), ...saved };
    }
  }

  /**
   * Initialize encryption
   */
  private async initializeEncryption(): Promise<void> {
    if (!isEncryptionSupported()) {
      console.warn('⚠️ Encryption not supported, disabling');
      this.settings.encryptionEnabled = false;
      return;
    }

    const encryptedKey = await db.getSettings<{ salt: string; iv: string; data: string }>('encryptionKey');
    
    if (encryptedKey) {
      // User needs to enter password to decrypt
      console.log('🔐 Encryption enabled - password required');
      // In real app, show password prompt
    }
  }

  /**
   * Load tasks from storage
   */
  private async loadTasks(): Promise<void> {
    const tasks = await db.getAllTasks();
    
    for (const task of tasks) {
      this.tasks.set(task.id, task);
    }
  }

  /**
   * Initialize Web Worker for background processing
   */
  private initWorker(): void {
    if (typeof Worker !== 'undefined') {
      this.worker = new Worker(new URL('./workers/search.worker.ts', import.meta.url), {
        type: 'module'
      });

      this.worker.onmessage = (e) => {
        this.handleWorkerResponse(e.data);
      };

      this.worker.onerror = (error) => {
        console.error('Worker error:', error);
      };

      console.log('✓ Web Worker initialized');
    }
  }

  /**
   * Handle worker responses
   */
  private handleWorkerResponse(response: unknown): void {
    // Process worker results
    console.log('Worker response:', response);
  }

  /**
   * Initialize features
   */
  private initFeatures(): void {
    // Initialize Pomodoro timer
    pomodoroTimer.onTick((timeRemaining) => {
      window.dispatchEvent(new CustomEvent('pomodoro:tick', { detail: { timeRemaining } }));
    });
    
    pomodoroTimer.onComplete((session) => {
      window.dispatchEvent(new CustomEvent('pomodoro:complete', { detail: { session } }));
      console.log(`[Pomodoro] Session complete: ${session.mode}`);
    });

    // Initialize cloud sync
    cloudSyncEngine.initialize();
    
    cloudSyncEngine.on('sync:complete', (data) => {
      console.log('[CloudSync] Sync complete:', data);
      this.loadTasks(); // Reload tasks after sync
    });

    cloudSyncEngine.on('remote:event', (event) => {
      console.log('[CloudSync] Remote event:', event);
      // Apply remote event to local state
    });

    console.log('✓ Features initialized');
  }

  /**
   * Register command handlers
   */
  private registerCommands(): void {
    // Create Task Command
    commandBus.register('CREATE_TASK', async (command: Command) => {
      try {
        const { text, options } = command.payload as {
          text: string;
          options?: {
            priority?: Priority;
            dueDate?: string;
            recurrence?: RecurrencePattern;
            categories?: string[];
            tags?: string[];
            estimatedMinutes?: number;
          };
        };

        // Parse natural language if needed
        const parsed = parseNaturalLanguage(text);

        const task: Task = {
          id: this.generateId(),
          text: parsed.text || text,
          status: 'pending',
          priority: options?.priority || parsed.priority || this.settings.defaultPriority,
          dueDate: options?.dueDate || parsed.dueDate?.toISOString(),
          recurrence: options?.recurrence || parsed.recurrence || this.settings.defaultRecurrence,
          categories: options?.categories || parsed.categories || [],
          tags: options?.tags || parsed.tags || [],
          estimatedMinutes: options?.estimatedMinutes || parsed.estimatedMinutes,
          subtasks: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1
        };

        // Save to storage
        await db.saveTask(task);
        this.tasks.set(task.id, task);

        // Create event
        const event: DomainEvent = {
          id: this.generateId(),
          type: 'TASK_CREATED',
          aggregateId: task.id,
          aggregateType: 'Task',
          payload: { task },
          metadata: {
            timestamp: new Date().toISOString()
          },
          timestamp: new Date().toISOString(),
          version: 1
        };

        await eventStore.append(event);

        return { success: true, data: task };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error : new Error('Failed to create task')
        };
      }
    });

    // Complete Task Command
    commandBus.register('COMPLETE_TASK', async (command: Command) => {
      try {
        const { taskId } = command.payload as { taskId: string };
        const task = this.tasks.get(taskId);

        if (!task) {
          return { success: false, error: new Error('Task not found') };
        }

        task.status = 'completed';
        task.completedAt = new Date().toISOString();
        task.updatedAt = new Date().toISOString();

        await db.saveTask(task);

        const event: DomainEvent = {
          id: this.generateId(),
          type: 'TASK_COMPLETED',
          aggregateId: taskId,
          aggregateType: 'Task',
          payload: { taskId, completedAt: task.completedAt },
          metadata: { timestamp: new Date().toISOString() },
          timestamp: new Date().toISOString(),
          version: 1
        };

        await eventStore.append(event);

        // Handle recurrence
        if (task.recurrence !== 'none') {
          this.createRecurringTask(task);
        }

        return { success: true, data: task };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error : new Error('Failed to complete task')
        };
      }
    });

    // Delete Task Command
    commandBus.register('DELETE_TASK', async (command: Command) => {
      try {
        const { taskId } = command.payload as { taskId: string };
        
        await db.deleteTask(taskId);
        this.tasks.delete(taskId);

        const event: DomainEvent = {
          id: this.generateId(),
          type: 'TASK_DELETED',
          aggregateId: taskId,
          aggregateType: 'Task',
          payload: { taskId },
          metadata: { timestamp: new Date().toISOString() },
          timestamp: new Date().toISOString(),
          version: 1
        };

        await eventStore.append(event);

        return { success: true, data: { taskId } };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error : new Error('Failed to delete task')
        };
      }
    });
  }

  /**
   * Create recurring task instance
   */
  private createRecurringTask(parentTask: Task): void {
    if (!parentTask.dueDate) return;

    const dueDate = new Date(parentTask.dueDate);
    
    switch (parentTask.recurrence) {
      case 'daily':
        dueDate.setDate(dueDate.getDate() + 1);
        break;
      case 'weekly':
        dueDate.setDate(dueDate.getDate() + 7);
        break;
      case 'monthly':
        dueDate.setMonth(dueDate.getMonth() + 1);
        break;
      case 'yearly':
        dueDate.setFullYear(dueDate.getFullYear() + 1);
        break;
    }

    const newTask: Task = {
      ...parentTask,
      id: this.generateId(),
      status: 'pending',
      completedAt: undefined,
      dueDate: dueDate.toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1
    };

    this.tasks.set(newTask.id, newTask);
    db.saveTask(newTask);
    
    console.log(`🔄 Created recurring task: ${newTask.id}`);
  }

  /**
   * Rebuild state from events
   */
  private async rebuildStateFromEvents(): Promise<void> {
    await eventStore.replay((event) => {
      // In a full CQRS implementation, this would rebuild projections
      console.log('Replaying event:', event.type, event.aggregateId);
    });
  }

  /**
   * Set up global event listeners
   */
  private setupEventListeners(): void {
    // Listen for custom events
    window.addEventListener('taskmaster:command', (e: Event) => {
      const customEvent = e as CustomEvent;
      const command: Command = customEvent.detail;
      commandBus.execute(command);
    });

    // Handle visibility change (for sync)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.sync();
      }
    });

    // Handle online/offline
    window.addEventListener('online', () => this.sync());
    window.addEventListener('offline', () => {
      console.log('📴 App is offline');
    });
  }

  /**
   * Sync with remote (placeholder for cloud sync)
   */
  private async sync(): Promise<void> {
    console.log('🔄 Syncing...');
    // In real app: sync with cloud backend
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get all tasks
   */
  getTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Execute command
   */
  async executeCommand<T extends Record<string, unknown>>(command: Command<T>): Promise<unknown> {
    return commandBus.execute(command);
  }

  /**
   * Search tasks using Web Worker
   */
  searchTasks(query: string, options?: { fuzzy?: boolean; limit?: number }): Promise<Task[]> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        // Fallback to in-memory search
        const tasks = this.getTasks();
        const filtered = tasks.filter(t => 
          t.text.toLowerCase().includes(query.toLowerCase())
        );
        resolve(filtered.slice(0, options?.limit || 100));
        return;
      }

      const messageId = this.generateId();
      
      const handler = (e: MessageEvent) => {
        if (e.data.id === messageId) {
          this.worker?.removeEventListener('message', handler);
          
          if (e.data.success) {
            resolve(e.data.data as Task[]);
          } else {
            reject(new Error(e.data.error));
          }
        }
      };

      this.worker.addEventListener('message', handler);
      
      this.worker.postMessage({
        id: messageId,
        type: 'SEARCH',
        payload: {
          tasks: this.getTasks(),
          query,
          options
        }
      });
    });
  }

  /**
   * Export all data
   */
  async export(): Promise<string> {
    return db.export();
  }

  /**
   * Import data
   */
  async import(json: string): Promise<void> {
    await db.import(json);
    await this.loadTasks();
  }

  // ============================================
  // FEATURE ACCESSORS
  // ============================================

  /**
   * Get Pomodoro timer instance
   */
  getPomodoroTimer() {
    return pomodoroTimer;
  }

  /**
   * Get analytics for tasks
   */
  getAnalytics(): Analytics {
    return analyticsEngine.calculate(this.getTasks());
  }

  /**
   * Generate day schedule with time blocking
   */
  getDaySchedule(date: Date) {
    return timeBlockingEngine.generateDaySchedule(date, this.getTasks());
  }

  /**
   * Estimate task duration
   */
  estimateTask(task: Task): number {
    return timeBlockingEngine.estimateTask(task);
  }

  /**
   * Get cloud sync state
   */
  getSyncState() {
    return cloudSyncEngine.getState();
  }

  /**
   * Force cloud sync
   */
  forceSync() {
    cloudSyncEngine.forceSync();
  }

  /**
   * Get app status
   */
  getStatus(): {
    initialized: boolean;
    taskCount: number;
    encryptionEnabled: boolean;
    workerAvailable: boolean;
  } {
    return {
      initialized: this.initialized,
      taskCount: this.tasks.size,
      encryptionEnabled: this.settings.encryptionEnabled,
      workerAvailable: this.worker !== null
    };
  }
}

// ============================================
// EXPORT SINGLETON
// ============================================

export const app = new TaskMasterApp();

// Auto-initialize when imported
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>)['taskmaster'] = app;
}
