/**
 * Notifications Manager
 * ======================
 * Handles browser notifications for task reminders and due dates
 * 
 * Features:
 * - Permission management
 * - Due date reminders
 * - Daily digest
 * - Custom notification sounds
 */

import { eventBus, AppEvents } from './core/event-bus.js';

class NotificationsManager {
    constructor(taskRepository) {
        this.taskRepository = taskRepository;
        this.permissionGranted = false;
        this.reminderTimers = new Map();
        this.checkInterval = null;
        
        // Check if user has already granted permission
        if ('Notification' in window) {
            this.permissionGranted = Notification.permission === 'granted';
        }
    }

    /**
     * Request notification permission
     * @returns {Promise<boolean>} Permission granted
     */
    async requestPermission() {
        if (!('Notification' in window)) {
            console.warn('Notifications not supported');
            return false;
        }

        try {
            const permission = await Notification.requestPermission();
            this.permissionGranted = permission === 'granted';
            
            if (this.permissionGranted) {
                eventBus.emit(AppEvents.NOTIFICATIONS_ENABLED);
                this.startReminderChecker();
            }
            
            return this.permissionGranted;
        } catch (error) {
            console.error('Notification permission error:', error);
            return false;
        }
    }

    /**
     * Send a notification
     * @param {string} title - Notification title
     * @param {Object} options - Notification options
     */
    send(title, options = {}) {
        if (!this.permissionGranted) {
            console.warn('Notifications not permitted');
            return;
        }

        const defaultOptions = {
            icon: '/icon-192.png',
            badge: '/badge-72.png',
            vibrate: [200, 100, 200],
            requireInteraction: false,
            ...options
        };

        const notification = new Notification(title, defaultOptions);

        // Auto close after 5 seconds
        setTimeout(() => notification.close(), 5000);

        notification.onclick = () => {
            window.focus();
            notification.close();
            
            if (options.onClick) {
                options.onClick();
            }
        };

        return notification;
    }

    /**
     * Send due date reminder
     * @param {Object} task - Task object
     */
    sendDueReminder(task) {
        const now = new Date();
        const dueDate = new Date(task.dueDate);
        const hoursUntilDue = (dueDate - now) / (1000 * 60 * 60);
        
        let title, body;
        
        if (hoursUntilDue < 0) {
            title = '⏰ Task Overdue!';
            body = `"${task.text}" was due ${this._timeAgo(dueDate)}`;
        } else if (hoursUntilDue < 1) {
            title = '⏰ Due Soon!';
            body = `"${task.text}" is due in less than an hour`;
        } else if (hoursUntilDue < 24) {
            title = '📅 Due Today';
            body = `"${task.text}" is due today`;
        } else {
            return; // Don't notify yet
        }

        this.send(title, {
            body,
            tag: `task-${task.id}`,
            data: { taskId: task.id },
            onClick: () => {
                // Could navigate to specific task
                window.location.hash = `task-${task.id}`;
            }
        });

        eventBus.emit(AppEvents.NOTIFICATION_SENT, { task, type: 'dueReminder' });
    }

    /**
     * Send daily digest notification
     * @param {Array} todayTasks - Tasks due today
     * @param {Array} overdueTasks - Overdue tasks
     */
    sendDailyDigest(todayTasks, overdueTasks) {
        if (todayTasks.length === 0 && overdueTasks.length === 0) {
            return;
        }

        let title, body;
        
        if (overdueTasks.length > 0) {
            title = `📋 You have ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}`;
            body = overdueTasks.length === 1 
                ? `"${overdueTasks[0].text}" needs attention`
                : `Including "${overdueTasks[0].text}"`;
        } else {
            title = `☀️ Good morning! ${todayTasks.length} tasks today`;
            body = todayTasks.length === 1
                ? `"${todayTasks[0].text}"`
                : `Including "${todayTasks[0].text}"`;
        }

        this.send(title, {
            body,
            tag: 'daily-digest',
            icon: todayTasks.length > 0 ? '/icon-success.png' : '/icon-warning.png'
        });

        eventBus.emit(AppEvents.NOTIFICATION_SENT, { 
            type: 'dailyDigest', 
            todayTasks: todayTasks.length, 
            overdueTasks: overdueTasks.length 
        });
    }

    /**
     * Schedule a reminder for a task
     * @param {Object} task - Task object
     */
    scheduleReminder(task) {
        if (!task.dueDate || !this.permissionGranted) {
            return;
        }

        // Clear existing timer for this task
        this.clearReminder(task.id);

        const now = new Date();
        const dueDate = new Date(task.dueDate);
        const timeUntilDue = dueDate - now;

        // Schedule reminders at strategic times
        const reminderTimes = [
            timeUntilDue - (24 * 60 * 60 * 1000), // 24 hours before
            timeUntilDue - (60 * 60 * 1000),      // 1 hour before
            timeUntilDue                           // At due time
        ].filter(t => t > 0); // Only future reminders

        reminderTimes.forEach((delay, index) => {
            const timerId = setTimeout(() => {
                this.sendDueReminder(task);
            }, delay);

            this.reminderTimers.set(`${task.id}-${index}`, timerId);
        });
    }

    /**
     * Clear all reminders for a task
     * @param {string} taskId - Task ID
     */
    clearReminder(taskId) {
        for (const [key, timerId] of this.reminderTimers.entries()) {
            if (key.startsWith(taskId)) {
                clearTimeout(timerId);
                this.reminderTimers.delete(key);
            }
        }
    }

    /**
     * Clear all reminders
     */
    clearAllReminders() {
        for (const timerId of this.reminderTimers.values()) {
            clearTimeout(timerId);
        }
        this.reminderTimers.clear();
    }

    /**
     * Start periodic check for due tasks
     */
    startReminderChecker() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }

        // Check every 5 minutes
        this.checkInterval = setInterval(async () => {
            await this.checkDueTasks();
        }, 5 * 60 * 1000);

        // Initial check
        this.checkDueTasks();
    }

    /**
     * Stop reminder checker
     */
    stopReminderChecker() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    /**
     * Check for tasks that need reminders
     */
    async checkDueTasks() {
        const allTasks = await this.taskRepository.getAll();
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayTasks = allTasks.filter(task => {
            if (task.completed || !task.dueDate) return false;
            const dueDate = new Date(task.dueDate);
            return dueDate >= today && dueDate < tomorrow;
        });

        const overdueTasks = allTasks.filter(task => {
            if (task.completed || !task.dueDate) return false;
            const dueDate = new Date(task.dueDate);
            return dueDate < today;
        });

        // Send daily digest in the morning (8 AM)
        const hour = now.getHours();
        if (hour === 8 && (todayTasks.length > 0 || overdueTasks.length > 0)) {
            this.sendDailyDigest(todayTasks, overdueTasks);
        }

        // Send reminders for overdue and due-soon tasks
        [...overdueTasks, ...todayTasks].forEach(task => {
            this.sendDueReminder(task);
        });
    }

    /**
     * Enable notifications for all tasks with due dates
     */
    async enableAllReminders() {
        if (!this.permissionGranted) {
            const granted = await this.requestPermission();
            if (!granted) return;
        }

        const allTasks = await this.taskRepository.getAll();
        const tasksWithDueDates = allTasks.filter(t => t.dueDate && !t.completed);
        
        tasksWithDueDates.forEach(task => {
            this.scheduleReminder(task);
        });
    }

    /**
     * Get notification status
     * @returns {Object} Status info
     */
    getStatus() {
        return {
            supported: 'Notification' in window,
            permissionGranted: this.permissionGranted,
            permission: 'Notification' in window ? Notification.permission : 'unsupported',
            activeReminders: this.reminderTimers.size,
            checkerRunning: !!this.checkInterval
        };
    }

    /**
     * Format time ago string
     * @private
     */
    _timeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
        return `${Math.floor(seconds / 86400)} days ago`;
    }
}

export { NotificationsManager };
