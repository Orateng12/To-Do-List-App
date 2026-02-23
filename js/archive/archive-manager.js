/**
 * Task Archive System
 * ===================
 * Soft-delete functionality with archive view and restore capabilities
 *
 * Features:
 * - Archive tasks instead of permanent delete
 * - Archive view with filtering
 * - Restore archived tasks
 * - Auto-archive old completed tasks
 * - Bulk archive operations
 * - Archive search
 */

import { eventBus, AppEvents } from '../core/event-bus.js';

class ArchiveManager {
    constructor(taskRepository, storage) {
        this.taskRepository = taskRepository;
        this.storage = storage;
        
        this.AUTO_ARCHIVE_DAYS = 30; // Auto-archive completed tasks older than 30 days
        this.ARCHIVE_RETENTION_DAYS = 365; // Keep archived tasks for 1 year
    }

    /**
     * Archive a task (soft delete)
     * @param {string} taskId - Task ID
     * @returns {Promise<Object>} Archived task
     */
    async archiveTask(taskId) {
        const task = await this.taskRepository.getById(taskId);
        if (!task) {
            throw new Error('Task not found');
        }

        // Mark as archived
        task.archived = true;
        task.archivedAt = new Date().toISOString();
        task.updatedAt = new Date().toISOString();

        // Remove from active view by setting a flag
        task.hidden = true;

        await this.taskRepository.save(task);

        eventBus.emit(AppEvents.TASK_ARCHIVED, { task });

        return task;
    }

    /**
     * Restore an archived task
     * @param {string} taskId - Task ID
     * @returns {Promise<Object>} Restored task
     */
    async restoreTask(taskId) {
        const task = await this.taskRepository.getById(taskId);
        if (!task) {
            throw new Error('Task not found');
        }

        if (!task.archived) {
            throw new Error('Task is not archived');
        }

        // Unmark as archived
        task.archived = false;
        task.archivedAt = null;
        task.hidden = false;
        task.updatedAt = new Date().toISOString();

        await this.taskRepository.save(task);

        eventBus.emit(AppEvents.TASK_RESTORED, { task });

        return task;
    }

    /**
     * Get all archived tasks
     * @param {Object} filters - Filter options
     * @returns {Promise<Array>} Archived tasks
     */
    async getArchivedTasks(filters = {}) {
        const allTasks = await this.taskRepository.getAll();
        
        let archived = allTasks.filter(t => t.archived === true);

        // Apply filters
        if (filters.search) {
            const query = filters.search.toLowerCase();
            archived = archived.filter(t => 
                t.text.toLowerCase().includes(query) ||
                t.notes?.toLowerCase().includes(query)
            );
        }

        if (filters.dateFrom) {
            const fromDate = new Date(filters.dateFrom);
            archived = archived.filter(t => new Date(t.archivedAt) >= fromDate);
        }

        if (filters.dateTo) {
            const toDate = new Date(filters.dateTo);
            archived = archived.filter(t => new Date(t.archivedAt) <= toDate);
        }

        if (filters.priority) {
            archived = archived.filter(t => t.priority === filters.priority);
        }

        // Sort by archived date (newest first)
        archived.sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt));

        return archived;
    }

    /**
     * Bulk archive multiple tasks
     * @param {Array} taskIds - Task IDs to archive
     * @returns {Promise<Array>} Archived tasks
     */
    async bulkArchive(taskIds) {
        const archived = [];
        
        for (const taskId of taskIds) {
            try {
                const task = await this.archiveTask(taskId);
                archived.push(task);
            } catch (e) {
                console.error(`Failed to archive task ${taskId}:`, e);
            }
        }

        eventBus.emit(AppEvents.BULK_ARCHIVE, { archived, count: archived.length });

        return archived;
    }

    /**
     * Bulk restore multiple archived tasks
     * @param {Array} taskIds - Task IDs to restore
     * @returns {Promise<Array>} Restored tasks
     */
    async bulkRestore(taskIds) {
        const restored = [];
        
        for (const taskId of taskIds) {
            try {
                const task = await this.restoreTask(taskId);
                restored.push(task);
            } catch (e) {
                console.error(`Failed to restore task ${taskId}:`, e);
            }
        }

        eventBus.emit(AppEvents.BULK_RESTORE, { restored, count: restored.length });

        return restored;
    }

    /**
     * Permanently delete an archived task
     * @param {string} taskId - Task ID
     * @returns {Promise<Object>} Deleted task
     */
    async permanentlyDelete(taskId) {
        const task = await this.taskRepository.getById(taskId);
        if (!task) {
            throw new Error('Task not found');
        }

        if (!task.archived) {
            throw new Error('Can only permanently delete archived tasks');
        }

        await this.taskRepository.delete(taskId);

        eventBus.emit(AppEvents.TASK_PERMANENTLY_DELETED, { task });

        return task;
    }

    /**
     * Clear all archived tasks (permanent delete)
     * @param {Object} options - Options
     * @returns {Promise<Object>} Deletion stats
     */
    async clearAllArchived(options = {}) {
        const { olderThanDays = null } = options;
        
        const archived = await this.getArchivedTasks();
        const now = Date.now();
        let deleted = [];

        for (const task of archived) {
            if (olderThanDays) {
                const archivedAge = (now - new Date(task.archivedAt).getTime()) / (1000 * 60 * 60 * 24);
                if (archivedAge < olderThanDays) continue;
            }

            await this.permanentlyDelete(task.id);
            deleted.push(task);
        }

        eventBus.emit(AppEvents.ARCHIVE_CLEARED, { deleted, count: deleted.length });

        return {
            deletedCount: deleted.length,
            deleted
        };
    }

    /**
     * Auto-archive old completed tasks
     * @returns {Promise<Object>} Auto-archive stats
     */
    async autoArchive() {
        const allTasks = await this.taskRepository.getAll();
        const now = Date.now();
        
        const toArchive = allTasks.filter(task => {
            // Skip if already archived or hidden
            if (task.archived || task.hidden) return false;
            
            // Only archive completed tasks
            if (!task.completed) return false;
            
            // Check if older than auto-archive threshold
            const completedAt = task.completedAt ? new Date(task.completedAt).getTime() : now;
            const age = (now - completedAt) / (1000 * 60 * 60 * 24);
            
            return age >= this.AUTO_ARCHIVE_DAYS;
        });

        const archived = [];
        for (const task of toArchive) {
            try {
                const result = await this.archiveTask(task.id);
                archived.push(result);
            } catch (e) {
                console.error(`Failed to auto-archive task ${task.id}:`, e);
            }
        }

        // Auto-delete old archived tasks
        const toDelete = archived.filter(task => {
            const archivedAge = (now - new Date(task.archivedAt).getTime()) / (1000 * 60 * 60 * 24);
            return archivedAge >= this.ARCHIVE_RETENTION_DAYS;
        });

        let deletedCount = 0;
        for (const task of toDelete) {
            try {
                await this.permanentlyDelete(task.id);
                deletedCount++;
            } catch (e) {
                console.error(`Failed to delete old archived task ${task.id}:`, e);
            }
        }

        const stats = {
            archivedCount: archived.length,
            deletedCount,
            archivedTasks: archived.map(t => ({ id: t.id, text: t.text })),
            deletedTasks: toDelete.map(t => ({ id: t.id, text: t.text }))
        };

        eventBus.emit(AppEvents.AUTO_ARCHIVE_COMPLETE, stats);

        return stats;
    }

    /**
     * Get archive statistics
     * @returns {Promise<Object>} Archive stats
     */
    async getStats() {
        const archived = await this.getArchivedTasks();
        const now = Date.now();

        const byPriority = {
            high: archived.filter(t => t.priority === 'high').length,
            medium: archived.filter(t => t.priority === 'medium').length,
            low: archived.filter(t => t.priority === 'low').length
        };

        const byAge = {
            today: archived.filter(t => {
                const age = (now - new Date(t.archivedAt).getTime()) / (1000 * 60 * 60 * 24);
                return age < 1;
            }).length,
            thisWeek: archived.filter(t => {
                const age = (now - new Date(t.archivedAt).getTime()) / (1000 * 60 * 60 * 24);
                return age < 7;
            }).length,
            thisMonth: archived.filter(t => {
                const age = (now - new Date(t.archivedAt).getTime()) / (1000 * 60 * 60 * 24);
                return age < 30;
            }).length,
            older: archived.filter(t => {
                const age = (now - new Date(t.archivedAt).getTime()) / (1000 * 60 * 60 * 24);
                return age >= 30;
            }).length
        };

        const completedVsIncomplete = {
            completed: archived.filter(t => t.completed).length,
            incomplete: archived.filter(t => !t.completed).length
        };

        // Storage size estimate
        const archivedSize = new Blob([JSON.stringify(archived)]).size;

        return {
            totalArchived: archived.length,
            byPriority,
            byAge,
            completedVsIncomplete,
            storageSizeBytes: archivedSize,
            storageSizeKB: Math.round(archivedSize / 1024 * 100) / 100,
            autoArchiveSettings: {
                enabled: true,
                autoArchiveDays: this.AUTO_ARCHIVE_DAYS,
                retentionDays: this.ARCHIVE_RETENTION_DAYS
            }
        };
    }

    /**
     * Export archived tasks
     * @param {string} format - Export format (json, csv)
     * @returns {Promise<Object>} Export data
     */
    async exportArchive(format = 'json') {
        const archived = await this.getArchivedTasks();

        let exportData, mimeType, extension;

        if (format === 'csv') {
            const headers = ['ID', 'Text', 'Priority', 'Completed', 'Archived Date', 'Original Due Date'];
            const rows = archived.map(t => [
                t.id,
                `"${t.text.replace(/"/g, '""')}"`,
                t.priority,
                t.completed ? 'Yes' : 'No',
                t.archivedAt,
                t.dueDate || ''
            ]);
            exportData = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            mimeType = 'text/csv';
            extension = 'csv';
        } else {
            exportData = JSON.stringify(archived, null, 2);
            mimeType = 'application/json';
            extension = 'json';
        }

        return {
            data: exportData,
            mimeType,
            extension,
            count: archived.length,
            exportedAt: new Date().toISOString()
        };
    }

    /**
     * Search archived tasks
     * @param {string} query - Search query
     * @param {Object} options - Search options
     * @returns {Promise<Array>} Matching archived tasks
     */
    async search(query, options = {}) {
        const {
            searchIn = ['text', 'notes', 'categories'],
            dateFrom = null,
            dateTo = null
        } = options;

        const archived = await this.getArchivedTasks({ dateFrom, dateTo });
        const queryLower = query.toLowerCase();

        return archived.filter(task => {
            if (searchIn.includes('text') && task.text.toLowerCase().includes(queryLower)) {
                return true;
            }
            if (searchIn.includes('notes') && task.notes?.toLowerCase().includes(queryLower)) {
                return true;
            }
            if (searchIn.includes('categories') && task.categories?.some(c => c.toLowerCase().includes(queryLower))) {
                return true;
            }
            return false;
        });
    }

    /**
     * Get archive activity log
     * @param {number} limit - Max entries to return
     * @returns {Promise<Array>} Activity log
     */
    async getActivityLog(limit = 50) {
        const log = await this.storage.getSetting('archive_activity_log', []);
        return log.slice(-limit);
    }

    /**
     * Log archive activity
     * @param {string} action - Action type
     * @param {Object} data - Action data
     */
    async _logActivity(action, data) {
        const log = await this.storage.getSetting('archive_activity_log', []);
        
        log.push({
            action,
            data,
            timestamp: new Date().toISOString()
        });

        // Keep only last 500 entries
        if (log.length > 500) {
            log.splice(0, log.length - 500);
        }

        await this.storage.saveSetting('archive_activity_log', log);
    }
}

// Additional events
AppEvents.TASK_ARCHIVED = 'archive:task_archived';
AppEvents.TASK_RESTORED = 'archive:task_restored';
AppEvents.TASK_PERMANENTLY_DELETED = 'archive:task_permanently_deleted';
AppEvents.BULK_ARCHIVE = 'archive:bulk_archive';
AppEvents.BULK_RESTORE = 'archive:bulk_restore';
AppEvents.ARCHIVE_CLEARED = 'archive:archive_cleared';
AppEvents.AUTO_ARCHIVE_COMPLETE = 'archive:auto_archive_complete';

export { ArchiveManager };
