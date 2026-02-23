/**
 * Calendar Integration (Google, Outlook, iCal)
 * ==============================================
 * Sync tasks with external calendars
 */

import { eventBus, EVENTS } from '../core/event-bus.js';

/**
 * Calendar Sync Manager
 */
export class CalendarSync {
    constructor() {
        this.calendars = new Map();
        this.syncInterval = null;
        this.lastSync = null;
    }

    /**
     * Register calendar provider
     */
    registerProvider(name, provider) {
        this.calendars.set(name, provider);
    }

    /**
     * Sync tasks to all registered calendars
     */
    async syncAll(tasks) {
        const results = {};
        
        for (const [name, provider] of this.calendars.entries()) {
            try {
                results[name] = await provider.sync(tasks);
            } catch (error) {
                results[name] = { success: false, error: error.message };
            }
        }

        this.lastSync = Date.now();
        eventBus.emit(EVENTS.CALENDAR_SYNC_COMPLETED, { results });
        
        return results;
    }

    /**
     * Export tasks to ICS format
     */
    exportToICS(tasks, options = {}) {
        const {
            filename = 'tasks.ics',
            calendarName = 'TaskMaster Tasks'
        } = options;

        const ics = this.generateICS(tasks, calendarName);
        this.downloadFile(ics, filename, 'text/calendar');
        
        eventBus.emit(EVENTS.CALENDAR_EXPORTED, { format: 'ics', taskCount: tasks.length });
    }

    /**
     * Generate ICS content
     */
    generateICS(tasks, calendarName) {
        const lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//TaskMaster//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            `X-WR-CALNAME:${calendarName}`,
            `X-WR-TIMEZONE:${Intl.DateTimeFormat().resolvedOptions().timeZone}`
        ];

        tasks.forEach(task => {
            if (task.dueDate) {
                lines.push(
                    'BEGIN:VEVENT',
                    `UID:${task.id}@taskmaster`,
                    `DTSTAMP:${this.formatICSDate(new Date())}`,
                    `DTSTART:${this.formatICSDate(new Date(task.dueDate))}`,
                    `SUMMARY:${this.escapeICS(task.text)}`,
                    `DESCRIPTION:${this.escapeICS(task.text)}${task.notes ? ' - ' + task.notes : ''}`,
                    `PRIORITY:${task.priority === 'high' ? '1' : task.priority === 'medium' ? '5' : '9'}`,
                    `STATUS:${task.completed ? 'COMPLETED' : 'NEEDS-ACTION'}`,
                    `CATEGORIES:${task.categories?.join(',') || 'TASK'}`,
                    'END:VEVENT'
                );
            }
        });

        lines.push('END:VCALENDAR');
        return lines.join('\r\n');
    }

    /**
     * Format date for ICS
     */
    formatICSDate(date) {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    }

    /**
     * Escape special ICS characters
     */
    escapeICS(text) {
        return text
            .replace(/\\/g, '\\\\')
            .replace(/;/g, '\\;')
            .replace(/,/g, '\\,')
            .replace(/\n/g, '\\n');
    }

    /**
     * Download file
     */
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Import from ICS file
     */
    async importFromICS(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                try {
                    const tasks = this.parseICS(event.target.result);
                    resolve(tasks);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * Parse ICS content
     */
    parseICS(content) {
        const tasks = [];
        const lines = content.split(/\r?\n/);
        let currentTask = null;

        for (const line of lines) {
            if (line.startsWith('BEGIN:VEVENT')) {
                currentTask = { id: this.generateId(), subtasks: [], categories: [] };
            } else if (line.startsWith('END:VEVENT')) {
                if (currentTask) tasks.push(currentTask);
                currentTask = null;
            } else if (currentTask && line.startsWith('SUMMARY:')) {
                currentTask.text = line.substring(8);
            } else if (currentTask && line.startsWith('DTSTART:')) {
                currentTask.dueDate = this.parseICSDate(line.substring(8));
            } else if (currentTask && line.startsWith('STATUS:COMPLETED')) {
                currentTask.completed = true;
            } else if (currentTask && line.startsWith('PRIORITY:1')) {
                currentTask.priority = 'high';
            } else if (currentTask && line.startsWith('PRIORITY:9')) {
                currentTask.priority = 'low';
            } else if (currentTask && line.startsWith('CATEGORIES:')) {
                currentTask.categories = line.substring(12).split(',');
            }
        }

        return tasks;
    }

    /**
     * Parse ICS date
     */
    parseICSDate(icsDate) {
        // Handle both date-only and datetime formats
        if (icsDate.length === 8) {
            return `${icsDate.substring(0, 4)}-${icsDate.substring(4, 6)}-${icsDate.substring(6, 8)}`;
        }
        const date = new Date(icsDate);
        return date.toISOString();
    }

    /**
     * Generate ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Start auto-sync
     */
    startAutoSync(intervalMinutes = 30) {
        this.stopAutoSync();
        
        this.syncInterval = setInterval(() => {
            eventBus.emit(EVENTS.CALENDAR_AUTO_SYNC);
        }, intervalMinutes * 1000 * 60);
    }

    /**
     * Stop auto-sync
     */
    stopAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    /**
     * Get sync status
     */
    getStatus() {
        return {
            providers: Array.from(this.calendars.keys()),
            lastSync: this.lastSync,
            autoSyncEnabled: this.syncInterval !== null
        };
    }
}

/**
 * Google Calendar Provider
 */
export class GoogleCalendarProvider {
    constructor(clientId, apiKey) {
        this.clientId = clientId;
        this.apiKey = apiKey;
        this.token = null;
        this.calendarId = 'primary';
    }

    /**
     * Authenticate with Google
     */
    async authenticate() {
        // OAuth2 flow would be implemented here
        // This is a simplified version
        return new Promise((resolve, reject) => {
            // In production, use proper OAuth2 flow
            resolve({ access_token: 'token' });
        });
    }

    /**
     * Sync tasks to Google Calendar
     */
    async sync(tasks) {
        const eventsToCreate = tasks.filter(t => t.dueDate && !t.completed);
        
        for (const task of eventsToCreate) {
            await this.createEvent(task);
        }

        return { success: true, synced: eventsToCreate.length };
    }

    /**
     * Create calendar event
     */
    async createEvent(task) {
        const event = {
            summary: task.text,
            description: task.notes || '',
            start: {
                date: task.dueDate,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
            },
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'popup', minutes: 60 }
                ]
            }
        };

        // API call would go here
        console.log('Creating Google Calendar event:', event);
        return event;
    }
}

/**
 * Outlook Calendar Provider
 */
export class OutlookCalendarProvider {
    constructor(clientId, tenantId) {
        this.clientId = clientId;
        this.tenantId = tenantId;
        this.token = null;
    }

    /**
     * Sync tasks to Outlook Calendar
     */
    async sync(tasks) {
        const eventsToCreate = tasks.filter(t => t.dueDate && !t.completed);
        
        for (const task of eventsToCreate) {
            await this.createEvent(task);
        }

        return { success: true, synced: eventsToCreate.length };
    }

    /**
     * Create Outlook event
     */
    async createEvent(task) {
        const event = {
            subject: task.text,
            body: {
                contentType: 'text',
                content: task.notes || ''
            },
            start: {
                dateTime: task.dueDate + 'T09:00:00',
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
            },
            end: {
                dateTime: task.dueDate + 'T17:00:00',
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
            },
            reminderMinutesBeforeStart: 60
        };

        console.log('Creating Outlook Calendar event:', event);
        return event;
    }
}

/**
 * Create calendar sync system
 */
export function createCalendarSync() {
    const sync = new CalendarSync();
    
    // Register providers (configure with your API keys)
    // sync.registerProvider('google', new GoogleCalendarProvider(clientId, apiKey));
    // sync.registerProvider('outlook', new OutlookCalendarProvider(clientId, tenantId));
    
    return sync;
}
