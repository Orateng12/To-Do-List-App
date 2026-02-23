/**
 * Notification Manager
 * ====================
 * Handles browser notifications for task reminders
 */

import { eventBus, EVENTS } from './event-bus.js';

class NotificationManager {
    constructor() {
        this.permission = 'default';
        this.checkInterval = null;
        this.notifiedTasks = new Set();
    }

    /**
     * Initialize notifications
     */
    init() {
        if ('Notification' in window) {
            this.permission = Notification.permission;
            
            // Request permission if not denied
            if (this.permission === 'default') {
                this.showPermissionPrompt();
            }

            // Start checking for due tasks
            this.startDueTaskChecker();
        }
    }

    /**
     * Show permission prompt UI
     */
    showPermissionPrompt() {
        const promptBtn = document.getElementById('enableNotifications');
        if (promptBtn) {
            promptBtn.style.display = 'flex';
            promptBtn.addEventListener('click', () => this.requestPermission());
        }
    }

    /**
     * Request notification permission
     */
    async requestPermission() {
        try {
            this.permission = await Notification.requestPermission();
            
            if (this.permission === 'granted') {
                this.showToast('Notifications enabled!', 'success');
                this.hidePermissionPrompt();
                this.checkDueTasks();
            } else if (this.permission === 'denied') {
                this.showToast('Notifications denied. Enable in browser settings.', 'error');
            }
        } catch (error) {
            console.error('Notification permission error:', error);
        }
    }

    /**
     * Hide permission prompt
     */
    hidePermissionPrompt() {
        const promptBtn = document.getElementById('enableNotifications');
        if (promptBtn) {
            promptBtn.style.display = 'none';
        }
    }

    /**
     * Send a browser notification
     * @param {string} title - Notification title
     * @param {string} body - Notification body
     * @param {string} icon - Icon emoji
     */
    send(title, body, icon = '📋') {
        if (this.permission !== 'granted') return;

        try {
            new Notification(`${icon} ${title}`, {
                body: body,
                badge: '🔔',
                requireInteraction: false,
                tag: 'taskmaster-' + Date.now()
            });
        } catch (error) {
            console.error('Notification send error:', error);
        }
    }

    /**
     * Show toast notification
     * @param {string} message - Message to show
     * @param {string} type - Toast type
     */
    showToast(message, type = 'info') {
        eventBus.emit(EVENTS.SHOW_TOAST, { message, type });
    }

    /**
     * Check for tasks that are due soon or overdue
     */
    checkDueTasks() {
        if (this.permission !== 'granted') return;

        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Get tasks from event bus or state
        eventBus.emit(EVENTS.CHECK_DUE_TASKS, { now, today, tomorrow });
    }

    /**
     * Start periodic due task checker (runs every hour)
     */
    startDueTaskChecker() {
        // Check immediately
        this.checkDueTasks();

        // Then check every hour
        this.checkInterval = setInterval(() => {
            this.checkDueTasks();
        }, 60 * 60 * 1000);
    }

    /**
     * Stop due task checker
     */
    stopDueTaskChecker() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    /**
     * Notify about overdue task
     * @param {Object} task - Task object
     */
    notifyOverdue(task) {
        const taskId = `overdue-${task.id}`;
        if (this.notifiedTasks.has(taskId)) return;

        this.send('Task Overdue', `"${task.text}" was due ${this.formatDate(task.dueDate)}`, '⚠️');
        this.notifiedTasks.add(taskId);

        // Remove from notified after 24 hours
        setTimeout(() => this.notifiedTasks.delete(taskId), 24 * 60 * 60 * 1000);
    }

    /**
     * Notify about task due today
     * @param {Object} task - Task object
     */
    notifyDueToday(task) {
        const taskId = `today-${task.id}`;
        if (this.notifiedTasks.has(taskId)) return;

        this.send('Due Today', `"${task.text}" is due today!`, '📅');
        this.notifiedTasks.add(taskId);
    }

    /**
     * Notify about task due tomorrow
     * @param {Object} task - Task object
     */
    notifyDueTomorrow(task) {
        const taskId = `tomorrow-${task.id}`;
        if (this.notifiedTasks.has(taskId)) return;

        this.send('Due Tomorrow', `"${task.text}" is due tomorrow`, '⏰');
        this.notifiedTasks.add(taskId);
    }

    /**
     * Format date for display
     * @param {string} dateString - ISO date string
     * @returns {string} Formatted date
     */
    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
}

// Export singleton instance
export const notificationManager = new NotificationManager();
