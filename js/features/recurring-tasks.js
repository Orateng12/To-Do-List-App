/**
 * Recurring Tasks Manager
 * ========================
 * Handles task recurrence patterns and automatic regeneration
 * 
 * Features:
 * - Daily, weekly, monthly, yearly recurrence
 * - Custom patterns (every N days, specific weekdays)
 * - Automatic next instance creation
 * - End date support
 */

import { eventBus, AppEvents } from './core/event-bus.js';

class RecurringTasksManager {
    constructor(taskRepository) {
        this.taskRepository = taskRepository;
        this.recurrenceTypes = {
            NONE: 'none',
            DAILY: 'daily',
            WEEKLY: 'weekly',
            MONTHLY: 'monthly',
            YEARLY: 'yearly',
            CUSTOM: 'custom'
        };
    }

    /**
     * Set recurrence pattern for a task
     * @param {string} taskId - Task ID
     * @param {Object} recurrence - Recurrence config
     * @returns {Promise<Object>} Updated task
     */
    async setRecurrence(taskId, recurrence) {
        const task = await this.taskRepository.getById(taskId);
        if (!task) {
            throw new Error('Task not found');
        }

        task.recurrence = {
            type: recurrence.type || this.recurrenceTypes.NONE,
            interval: recurrence.interval || 1, // Every N days/weeks/etc
            weekdays: recurrence.weekdays || [], // For weekly: [0, 2, 4] = Mon, Wed, Fri
            dayOfMonth: recurrence.dayOfMonth || null, // For monthly: 15 = 15th of month
            endDate: recurrence.endDate || null, // Stop recurring after this date
            count: recurrence.count || null, // Stop after N occurrences
            lastGenerated: null,
            occurrenceCount: 0
        };

        task.updatedAt = new Date().toISOString();
        await this.taskRepository.save(task);
        
        eventBus.emit(AppEvents.RECURRENCE_SET, { task, recurrence });
        
        return task;
    }

    /**
     * Remove recurrence from a task
     * @param {string} taskId - Task ID
     * @returns {Promise<Object>} Updated task
     */
    async removeRecurrence(taskId) {
        const task = await this.taskRepository.getById(taskId);
        if (!task) {
            throw new Error('Task not found');
        }

        task.recurrence = null;
        task.updatedAt = new Date().toISOString();
        await this.taskRepository.save(task);
        
        eventBus.emit(AppEvents.RECURRENCE_REMOVED, { task });
        
        return task;
    }

    /**
     * Complete a recurring task and generate next instance
     * @param {string} taskId - Task ID
     * @returns {Promise<Object>} Result with new task if created
     */
    async completeRecurringTask(taskId) {
        const task = await this.taskRepository.getById(taskId);
        if (!task) {
            throw new Error('Task not found');
        }

        // Mark current task as completed
        task.completed = true;
        task.completedAt = new Date().toISOString();
        task.updatedAt = new Date().toISOString();

        let newTask = null;

        // Generate next instance if recurrence exists and hasn't ended
        if (task.recurrence && task.recurrence.type !== this.recurrenceTypes.NONE) {
            const shouldGenerate = this._shouldGenerateNext(task);
            
            if (shouldGenerate) {
                newTask = await this._generateNextInstance(task);
            }
        }

        await this.taskRepository.save(task);
        
        if (newTask) {
            eventBus.emit(AppEvents.RECURRING_TASK_GENERATED, { 
                originalTask: task, 
                newTask 
            });
        }
        
        return { task, newTask };
    }

    /**
     * Check if we should generate the next instance
     * @private
     */
    _shouldGenerateNext(task) {
        const recurrence = task.recurrence;
        if (!recurrence) return false;

        // Check end date
        if (recurrence.endDate) {
            const endDate = new Date(recurrence.endDate);
            if (new Date() > endDate) return false;
        }

        // Check occurrence count
        if (recurrence.count) {
            if (recurrence.occurrenceCount >= recurrence.count) return false;
        }

        return true;
    }

    /**
     * Generate next instance of a recurring task
     * @private
     */
    async _generateNextInstance(task) {
        const recurrence = task.recurrence;
        const nextDueDate = this._calculateNextDueDate(task);

        const newTask = {
            id: this._generateId(),
            text: task.text,
            completed: false,
            priority: task.priority,
            dueDate: nextDueDate ? nextDueDate.toISOString() : null,
            notes: task.notes,
            categories: task.categories ? [...task.categories] : [],
            recurrence: { ...recurrence },
            parentId: task.id, // Link to original recurring task
            isRecurringInstance: true,
            createdAt: new Date().toISOString(),
            updatedAt: null
        };

        // Update recurrence metadata
        recurrence.occurrenceCount++;
        recurrence.lastGenerated = new Date().toISOString();

        await this.taskRepository.save(newTask);
        
        return newTask;
    }

    /**
     * Calculate next due date based on recurrence pattern
     * @private
     */
    _calculateNextDueDate(task) {
        const recurrence = task.recurrence;
        const currentDueDate = task.dueDate ? new Date(task.dueDate) : new Date();
        const nextDate = new Date(currentDueDate);

        switch (recurrence.type) {
            case this.recurrenceTypes.DAILY:
                nextDate.setDate(nextDate.getDate() + recurrence.interval);
                break;

            case this.recurrenceTypes.WEEKLY:
                if (recurrence.weekdays && recurrence.weekdays.length > 0) {
                    // Find next weekday in the pattern
                    const today = nextDate.getDay();
                    let daysToAdd = 1;
                    while (daysToAdd <= 7) {
                        const nextDay = (today + daysToAdd) % 7;
                        if (recurrence.weekdays.includes(nextDay)) {
                            break;
                        }
                        daysToAdd++;
                    }
                    nextDate.setDate(nextDate.getDate() + daysToAdd);
                } else {
                    nextDate.setDate(nextDate.getDate() + (recurrence.interval * 7));
                }
                break;

            case this.recurrenceTypes.MONTHLY:
                if (recurrence.dayOfMonth) {
                    nextDate.setDate(recurrence.dayOfMonth);
                    nextDate.setMonth(nextDate.getMonth() + recurrence.interval);
                } else {
                    nextDate.setMonth(nextDate.getMonth() + recurrence.interval);
                }
                break;

            case this.recurrenceTypes.YEARLY:
                nextDate.setFullYear(nextDate.getFullYear() + recurrence.interval);
                break;

            case this.recurrenceTypes.CUSTOM:
                // Custom pattern handling
                nextDate.setDate(nextDate.getDate() + recurrence.interval);
                break;

            default:
                return null;
        }

        return nextDate;
    }

    /**
     * Get all recurring tasks
     * @returns {Promise<Array>} Recurring tasks
     */
    async getAllRecurringTasks() {
        const allTasks = await this.taskRepository.getAll();
        return allTasks.filter(task => 
            task.recurrence && task.recurrence.type !== this.recurrenceTypes.NONE
        );
    }

    /**
     * Check for overdue recurring tasks that need regeneration
     * @returns {Promise<Array>} Tasks that need new instances
     */
    async checkOverdueRecurringTasks() {
        const recurringTasks = await this.getAllRecurringTasks();
        const now = new Date();
        const needsGeneration = [];

        for (const task of recurringTasks) {
            if (!task.completed && task.dueDate) {
                const dueDate = new Date(task.dueDate);
                if (now > dueDate && this._shouldGenerateNext(task)) {
                    needsGeneration.push(task);
                }
            }
        }

        return needsGeneration;
    }

    /**
     * Get recurrence description for display
     * @param {Object} recurrence - Recurrence config
     * @returns {string} Human-readable description
     */
    getDescription(recurrence) {
        if (!recurrence || recurrence.type === this.recurrenceTypes.NONE) {
            return '';
        }

        const { type, interval, weekdays, dayOfMonth } = recurrence;

        switch (type) {
            case this.recurrenceTypes.DAILY:
                return interval === 1 ? 'Daily' : `Every ${interval} days`;

            case this.recurrenceTypes.WEEKLY:
                if (weekdays && weekdays.length > 0) {
                    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    const names = weekdays.map(d => dayNames[d]).join(', ');
                    return `${names}`;
                }
                return interval === 1 ? 'Weekly' : `Every ${interval} weeks`;

            case this.recurrenceTypes.MONTHLY:
                if (dayOfMonth) {
                    const ordinal = this._getOrdinal(dayOfMonth);
                    return `Monthly on the ${ordinal}`;
                }
                return interval === 1 ? 'Monthly' : `Every ${interval} months`;

            case this.recurrenceTypes.YEARLY:
                return interval === 1 ? 'Yearly' : `Every ${interval} years`;

            case this.recurrenceTypes.CUSTOM:
                return `Every ${interval} days (custom)`;

            default:
                return '';
        }
    }

    /**
     * Get ordinal suffix for day of month
     * @private
     */
    _getOrdinal(day) {
        if (day > 3 && day < 21) return day + 'th';
        switch (day % 10) {
            case 1: return day + 'st';
            case 2: return day + 'nd';
            case 3: return day + 'rd';
            default: return day + 'th';
        }
    }

    _generateId() {
        return 'rec_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }
}

export { RecurringTasksManager };
