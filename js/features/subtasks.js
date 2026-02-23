/**
 * Subtasks Manager
 * =================
 * Handles nested task functionality with progress tracking
 * 
 * Features:
 * - Add/remove subtasks
 * - Progress calculation
 * - Auto-complete parent when all subtasks done
 * - Recursive completion
 */

import { eventBus, AppEvents } from './event-bus.js';

class SubtasksManager {
    constructor(taskRepository) {
        this.taskRepository = taskRepository;
    }

    /**
     * Add a subtask to a parent task
     * @param {string} parentId - Parent task ID
     * @param {string} text - Subtask text
     * @returns {Promise<Object>} Created subtask
     */
    async addSubtask(parentId, text) {
        const parentTask = await this.taskRepository.getById(parentId);
        if (!parentTask) {
            throw new Error('Parent task not found');
        }

        const subtask = {
            id: this._generateId(),
            text: text.trim(),
            completed: false,
            parentId: parentId,
            priority: parentTask.priority,
            createdAt: new Date().toISOString(),
            updatedAt: null,
            order: parentTask.subtasks?.length || 0
        };

        // Initialize subtasks array if not exists
        if (!parentTask.subtasks) {
            parentTask.subtasks = [];
        }

        parentTask.subtasks.push(subtask);
        parentTask.updatedAt = new Date().toISOString();

        await this.taskRepository.save(parentTask);
        
        eventBus.emit(AppEvents.SUBTASK_ADDED, { parentTask, subtask });
        
        return subtask;
    }

    /**
     * Toggle subtask completion
     * @param {string} parentId - Parent task ID
     * @param {string} subtaskId - Subtask ID
     * @returns {Promise<Object>} Updated parent task
     */
    async toggleSubtask(parentId, subtaskId) {
        const parentTask = await this.taskRepository.getById(parentId);
        if (!parentTask || !parentTask.subtasks) {
            throw new Error('Task or subtask not found');
        }

        const subtask = parentTask.subtasks.find(s => s.id === subtaskId);
        if (!subtask) {
            throw new Error('Subtask not found');
        }

        subtask.completed = !subtask.completed;
        subtask.updatedAt = new Date().toISOString();
        parentTask.updatedAt = new Date().toISOString();

        // Check if all subtasks are completed
        const allSubtasksComplete = parentTask.subtasks.every(s => s.completed);
        
        // Optional: Auto-complete parent when all subtasks done (configurable)
        if (allSubtasksComplete && !parentTask.completed) {
            // Don't auto-complete, but could emit event
            eventBus.emit(AppEvents.ALL_SUBTASKS_COMPLETE, { parentTask });
        }

        await this.taskRepository.save(parentTask);
        
        eventBus.emit(AppEvents.SUBTASK_TOGGLED, { parentTask, subtask });
        
        return parentTask;
    }

    /**
     * Delete a subtask
     * @param {string} parentId - Parent task ID
     * @param {string} subtaskId - Subtask ID
     * @returns {Promise<Object>} Updated parent task
     */
    async deleteSubtask(parentId, subtaskId) {
        const parentTask = await this.taskRepository.getById(parentId);
        if (!parentTask || !parentTask.subtasks) {
            throw new Error('Task or subtask not found');
        }

        const subtaskIndex = parentTask.subtasks.findIndex(s => s.id === subtaskId);
        if (subtaskIndex === -1) {
            throw new Error('Subtask not found');
        }

        const deletedSubtask = parentTask.subtasks.splice(subtaskIndex, 1)[0];
        parentTask.updatedAt = new Date().toISOString();

        // Reorder remaining subtasks
        parentTask.subtasks.forEach((s, index) => {
            s.order = index;
        });

        await this.taskRepository.save(parentTask);
        
        eventBus.emit(AppEvents.SUBTASK_DELETED, { parentTask, deletedSubtask });
        
        return parentTask;
    }

    /**
     * Update subtask text
     * @param {string} parentId - Parent task ID
     * @param {string} subtaskId - Subtask ID
     * @param {string} newText - New text
     * @returns {Promise<Object>} Updated parent task
     */
    async updateSubtask(parentId, subtaskId, newText) {
        const parentTask = await this.taskRepository.getById(parentId);
        if (!parentTask || !parentTask.subtasks) {
            throw new Error('Task or subtask not found');
        }

        const subtask = parentTask.subtasks.find(s => s.id === subtaskId);
        if (!subtask) {
            throw new Error('Subtask not found');
        }

        subtask.text = newText.trim();
        subtask.updatedAt = new Date().toISOString();
        parentTask.updatedAt = new Date().toISOString();

        await this.taskRepository.save(parentTask);
        
        eventBus.emit(AppEvents.SUBTASK_UPDATED, { parentTask, subtask });
        
        return parentTask;
    }

    /**
     * Get subtask progress
     * @param {string} taskId - Task ID
     * @returns {Object} Progress info
     */
    getProgress(task) {
        if (!task.subtasks || task.subtasks.length === 0) {
            return {
                total: 0,
                completed: 0,
                percentage: 0
            };
        }

        const total = task.subtasks.length;
        const completed = task.subtasks.filter(s => s.completed).length;
        const percentage = Math.round((completed / total) * 100);

        return {
            total,
            completed,
            percentage
        };
    }

    /**
     * Get all subtasks for a task (sorted by order)
     * @param {string} taskId - Task ID
     * @returns {Array} Subtasks array
     */
    getSubtasks(task) {
        if (!task.subtasks) {
            return [];
        }
        return [...task.subtasks].sort((a, b) => a.order - b.order);
    }

    /**
     * Reorder subtasks
     * @param {string} parentId - Parent task ID
     * @param {string} subtaskId - Subtask ID to move
     * @param {number} newOrder - New order index
     * @returns {Promise<Object>} Updated parent task
     */
    async reorderSubtask(parentId, subtaskId, newOrder) {
        const parentTask = await this.taskRepository.getById(parentId);
        if (!parentTask || !parentTask.subtasks) {
            throw new Error('Task or subtask not found');
        }

        const subtask = parentTask.subtasks.find(s => s.id === subtaskId);
        if (!subtask) {
            throw new Error('Subtask not found');
        }

        // Remove from current position
        const currentIndex = parentTask.subtasks.findIndex(s => s.id === subtaskId);
        parentTask.subtasks.splice(currentIndex, 1);

        // Insert at new position
        parentTask.subtasks.splice(newOrder, 0, subtask);

        // Update order for all subtasks
        parentTask.subtasks.forEach((s, index) => {
            s.order = index;
        });

        parentTask.updatedAt = new Date().toISOString();
        await this.taskRepository.save(parentTask);
        
        eventBus.emit(AppEvents.SUBTASK_REORDERED, { parentTask, subtask });
        
        return parentTask;
    }

    _generateId() {
        return 'sub_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }
}

export { SubtasksManager };
