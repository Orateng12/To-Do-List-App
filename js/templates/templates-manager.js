/**
 * Smart Templates System
 * ======================
 * Pre-built templates and custom templates for rapid task creation
 *
 * Features:
 * - Pre-built templates (Morning Routine, Project Launch, etc.)
 * - Custom template creation
 * - Template categories
 * - One-click task batch creation
 * - Template sharing/export
 * - Smart suggestions based on context
 */

import { eventBus, AppEvents } from '../core/event-bus.js';

class TemplatesManager {
    constructor(taskRepository, storage) {
        this.taskRepository = taskRepository;
        this.storage = storage;
        
        // Pre-built templates
        this.defaultTemplates = [
            {
                id: 'morning-routine',
                name: '🌅 Morning Routine',
                category: 'productivity',
                description: 'Start your day right with this productive morning routine',
                icon: '🌅',
                tasks: [
                    { text: 'Make bed', priority: 'low', estimatedDuration: 5 },
                    { text: 'Drink water', priority: 'medium', estimatedDuration: 2 },
                    { text: 'Exercise/Stretch', priority: 'high', estimatedDuration: 30 },
                    { text: 'Healthy breakfast', priority: 'high', estimatedDuration: 20 },
                    { text: 'Review daily goals', priority: 'medium', estimatedDuration: 10 },
                    { text: 'Check calendar', priority: 'medium', estimatedDuration: 5 }
                ]
            },
            {
                id: 'evening-routine',
                name: '🌙 Evening Routine',
                category: 'productivity',
                description: 'Wind down and prepare for tomorrow',
                icon: '🌙',
                tasks: [
                    { text: 'Prepare clothes for tomorrow', priority: 'low', estimatedDuration: 5 },
                    { text: 'Pack bag/lunch', priority: 'medium', estimatedDuration: 10 },
                    { text: 'Review tomorrow\'s schedule', priority: 'medium', estimatedDuration: 5 },
                    { text: 'No screens 30 min before bed', priority: 'high', estimatedDuration: 30 },
                    { text: 'Read or meditate', priority: 'medium', estimatedDuration: 20 }
                ]
            },
            {
                id: 'project-launch',
                name: '🚀 Project Launch',
                category: 'work',
                description: 'Essential tasks for launching a new project',
                icon: '🚀',
                tasks: [
                    { text: 'Define project scope and objectives', priority: 'high', estimatedDuration: 60 },
                    { text: 'Identify stakeholders', priority: 'high', estimatedDuration: 30 },
                    { text: 'Create project timeline', priority: 'high', estimatedDuration: 45 },
                    { text: 'Set up project management tools', priority: 'medium', estimatedDuration: 30 },
                    { text: 'Schedule kickoff meeting', priority: 'high', estimatedDuration: 15 },
                    { text: 'Create communication plan', priority: 'medium', estimatedDuration: 30 },
                    { text: 'Define success metrics', priority: 'high', estimatedDuration: 30 }
                ]
            },
            {
                id: 'meeting-prep',
                name: '📋 Meeting Preparation',
                category: 'work',
                description: 'Prepare effectively for important meetings',
                icon: '📋',
                tasks: [
                    { text: 'Review meeting agenda', priority: 'high', estimatedDuration: 10 },
                    { text: 'Prepare presentation materials', priority: 'high', estimatedDuration: 45 },
                    { text: 'Send pre-read materials', priority: 'medium', estimatedDuration: 10 },
                    { text: 'Test technology/equipment', priority: 'medium', estimatedDuration: 10 },
                    { text: 'Prepare discussion points', priority: 'medium', estimatedDuration: 15 },
                    { text: 'Set up meeting room', priority: 'low', estimatedDuration: 5 }
                ]
            },
            {
                id: 'weekly-review',
                name: '📊 Weekly Review',
                category: 'productivity',
                description: 'Reflect on the week and plan ahead',
                icon: '📊',
                tasks: [
                    { text: 'Review completed tasks', priority: 'high', estimatedDuration: 20 },
                    { text: 'Review calendar for past week', priority: 'medium', estimatedDuration: 15 },
                    { text: 'Capture open loops', priority: 'high', estimatedDuration: 20 },
                    { text: 'Review goals progress', priority: 'high', estimatedDuration: 20 },
                    { text: 'Plan next week', priority: 'high', estimatedDuration: 30 },
                    { text: 'Clear inbox', priority: 'medium', estimatedDuration: 30 },
                    { text: 'Update task system', priority: 'medium', estimatedDuration: 15 }
                ]
            },
            {
                id: 'study-session',
                name: '📚 Study Session',
                category: 'education',
                description: 'Effective study session structure',
                icon: '📚',
                tasks: [
                    { text: 'Review previous notes', priority: 'medium', estimatedDuration: 15 },
                    { text: 'Set learning objectives', priority: 'high', estimatedDuration: 5 },
                    { text: 'Active reading/study (Pomodoro)', priority: 'high', estimatedDuration: 50 },
                    { text: 'Take practice questions', priority: 'high', estimatedDuration: 30 },
                    { text: 'Summarize key points', priority: 'medium', estimatedDuration: 15 },
                    { text: 'Create flashcards', priority: 'medium', estimatedDuration: 20 }
                ]
            },
            {
                id: 'home-cleaning',
                name: '🧹 Deep Cleaning',
                category: 'personal',
                description: 'Comprehensive home cleaning checklist',
                icon: '🧹',
                tasks: [
                    { text: 'Declutter surfaces', priority: 'medium', estimatedDuration: 20 },
                    { text: 'Vacuum carpets', priority: 'medium', estimatedDuration: 30 },
                    { text: 'Mop floors', priority: 'medium', estimatedDuration: 25 },
                    { text: 'Clean bathroom', priority: 'high', estimatedDuration: 45 },
                    { text: 'Clean kitchen', priority: 'high', estimatedDuration: 40 },
                    { text: 'Dust furniture', priority: 'low', estimatedDuration: 20 },
                    { text: 'Change bed sheets', priority: 'medium', estimatedDuration: 15 }
                ]
            },
            {
                id: 'job-application',
                name: '💼 Job Application',
                category: 'career',
                description: 'Complete job application process',
                icon: '💼',
                tasks: [
                    { text: 'Research company', priority: 'high', estimatedDuration: 30 },
                    { text: 'Tailor resume', priority: 'high', estimatedDuration: 45 },
                    { text: 'Write cover letter', priority: 'high', estimatedDuration: 60 },
                    { text: 'Update LinkedIn profile', priority: 'medium', estimatedDuration: 30 },
                    { text: 'Submit application', priority: 'high', estimatedDuration: 20 },
                    { text: 'Follow up email', priority: 'low', estimatedDuration: 10 }
                ]
            },
            {
                id: 'travel-prep',
                name: '✈️ Travel Preparation',
                category: 'personal',
                description: 'Don\'t forget anything for your trip',
                icon: '✈️',
                tasks: [
                    { text: 'Check passport/ID validity', priority: 'high', estimatedDuration: 10 },
                    { text: 'Book accommodations', priority: 'high', estimatedDuration: 45 },
                    { text: 'Pack luggage', priority: 'high', estimatedDuration: 60 },
                    { text: 'Arrange pet/house care', priority: 'high', estimatedDuration: 30 },
                    { text: 'Download offline maps', priority: 'medium', estimatedDuration: 15 },
                    { text: 'Notify bank of travel', priority: 'medium', estimatedDuration: 10 },
                    { text: 'Check-in online', priority: 'high', estimatedDuration: 10 }
                ]
            },
            {
                id: 'goal-setting',
                name: '🎯 Goal Setting',
                category: 'productivity',
                description: 'SMART goal setting framework',
                icon: '🎯',
                tasks: [
                    { text: 'Brainstorm goals', priority: 'medium', estimatedDuration: 30 },
                    { text: 'Make goals SMART', priority: 'high', estimatedDuration: 45 },
                    { text: 'Break into action steps', priority: 'high', estimatedDuration: 40 },
                    { text: 'Set deadlines', priority: 'high', estimatedDuration: 20 },
                    { text: 'Identify potential obstacles', priority: 'medium', estimatedDuration: 20 },
                    { text: 'Create accountability system', priority: 'medium', estimatedDuration: 15 }
                ]
            }
        ];

        this.categories = [
            { id: 'productivity', name: 'Productivity', icon: '⚡' },
            { id: 'work', name: 'Work', icon: '💼' },
            { id: 'personal', name: 'Personal', icon: '🏠' },
            { id: 'education', name: 'Education', icon: '📚' },
            { id: 'health', name: 'Health', icon: '💪' },
            { id: 'career', name: 'Career', icon: '📈' },
            { id: 'finance', name: 'Finance', icon: '💰' },
            { id: 'custom', name: 'Custom', icon: '⭐' }
        ];
    }

    /**
     * Get all templates (default + custom)
     * @returns {Promise<Array>} All templates
     */
    async getAllTemplates() {
        const customTemplates = await this._getCustomTemplates();
        return [...this.defaultTemplates, ...customTemplates];
    }

    /**
     * Get templates by category
     * @param {string} categoryId - Category ID
     * @returns {Promise<Array>} Filtered templates
     */
    async getTemplatesByCategory(categoryId) {
        const all = await this.getAllTemplates();
        return all.filter(t => t.category === categoryId);
    }

    /**
     * Get a specific template
     * @param {string} templateId - Template ID
     * @returns {Promise<Object|null>} Template
     */
    async getTemplate(templateId) {
        const all = await this.getAllTemplates();
        return all.find(t => t.id === templateId) || null;
    }

    /**
     * Create a template from existing tasks
     * @param {string} name - Template name
     * @param {Array} taskIds - Task IDs to include
     * @param {string} category - Category
     * @returns {Promise<Object>} Created template
     */
    async createFromTasks(name, taskIds, category = 'custom') {
        const tasks = [];
        for (const taskId of taskIds) {
            const task = await this.taskRepository.getById(taskId);
            if (task) {
                tasks.push({
                    text: task.text,
                    priority: task.priority,
                    estimatedDuration: task.estimatedDuration || 30,
                    categories: task.categories
                });
            }
        }

        const template = {
            id: this._generateId(),
            name,
            category,
            description: 'Custom template',
            icon: '⭐',
            tasks,
            isCustom: true,
            createdAt: new Date().toISOString()
        };

        await this._saveCustomTemplate(template);

        eventBus.emit(AppEvents.TEMPLATE_CREATED, { template });

        return template;
    }

    /**
     * Create a custom template from scratch
     * @param {Object} templateData - Template data
     * @returns {Promise<Object>} Created template
     */
    async createCustomTemplate(templateData) {
        const template = {
            id: this._generateId(),
            ...templateData,
            isCustom: true,
            createdAt: new Date().toISOString()
        };

        await this._saveCustomTemplate(template);

        eventBus.emit(AppEvents.TEMPLATE_CREATED, { template });

        return template;
    }

    /**
     * Update a custom template
     * @param {string} templateId - Template ID
     * @param {Object} updates - Updates to apply
     * @returns {Promise<Object>} Updated template
     */
    async updateTemplate(templateId, updates) {
        const customTemplates = await this._getCustomTemplates();
        const templateIndex = customTemplates.findIndex(t => t.id === templateId);

        if (templateIndex === -1) {
            throw new Error('Custom template not found');
        }

        const template = { ...customTemplates[templateIndex], ...updates };
        customTemplates[templateIndex] = template;

        await this.storage.saveSetting('custom_templates', customTemplates);

        eventBus.emit(AppEvents.TEMPLATE_UPDATED, { template });

        return template;
    }

    /**
     * Delete a custom template
     * @param {string} templateId - Template ID
     * @returns {Promise<void>}
     */
    async deleteTemplate(templateId) {
        const customTemplates = await this._getCustomTemplates();
        const filtered = customTemplates.filter(t => t.id !== templateId);

        if (filtered.length === customTemplates.length) {
            throw new Error('Custom template not found');
        }

        await this.storage.saveSetting('custom_templates', filtered);

        eventBus.emit(AppEvents.TEMPLATE_DELETED, { templateId });
    }

    /**
     * Apply a template - create tasks from template
     * @param {string} templateId - Template ID
     * @param {Object} options - Options (dueDate offset, etc.)
     * @returns {Promise<Array>} Created tasks
     */
    async applyTemplate(templateId, options = {}) {
        const template = await this.getTemplate(templateId);
        if (!template) {
            throw new Error('Template not found');
        }

        const {
            dueDateOffset = 0,
            startDate = new Date(),
            spreadDays = 0,
            prefix = ''
        } = options;

        const createdTasks = [];
        const baseDate = new Date(startDate);
        baseDate.setDate(baseDate.getDate() + dueDateOffset);

        for (let i = 0; i < template.tasks.length; i++) {
            const taskData = template.tasks[i];
            
            // Calculate due date if spreading across days
            let taskDueDate = null;
            if (spreadDays > 0) {
                const taskDate = new Date(baseDate);
                taskDate.setDate(taskDate.getDate() + Math.floor(i / spreadDays));
                taskDueDate = taskDate.toISOString().split('T')[0];
            } else if (dueDateOffset > 0) {
                taskDueDate = baseDate.toISOString().split('T')[0];
            }

            const task = {
                text: prefix ? `${prefix} - ${taskData.text}` : taskData.text,
                priority: taskData.priority || 'medium',
                dueDate: taskDueDate,
                estimatedDuration: taskData.estimatedDuration,
                categories: taskData.categories || [template.category],
                templateId: template.id,
                templateName: template.name
            };

            const createdTask = await this.taskRepository.create(task);
            createdTasks.push(createdTask);
        }

        eventBus.emit(AppEvents.TEMPLATE_APPLIED, { 
            template, 
            createdTasks, 
            count: createdTasks.length 
        });

        this.ui?.showToast(`Created ${createdTasks.length} tasks from "${template.name}"`, 'success');

        return createdTasks;
    }

    /**
     * Get smart template suggestions based on context
     * @param {Object} context - Context info (time, day, recent tasks)
     * @returns {Promise<Array>} Suggested templates
     */
    async getSuggestions(context = {}) {
        const {
            hour = new Date().getHours(),
            dayOfWeek = new Date().getDay(),
            recentTemplates = []
        } = context;

        const suggestions = [];

        // Time-based suggestions
        if (hour >= 5 && hour < 12) {
            suggestions.push({ templateId: 'morning-routine', reason: 'Morning hours' });
        } else if (hour >= 18 && hour < 23) {
            suggestions.push({ templateId: 'evening-routine', reason: 'Evening hours' });
        }

        // Day-based suggestions
        if (dayOfWeek === 1) { // Monday
            suggestions.push({ templateId: 'weekly-review', reason: 'Start of week' });
        } else if (dayOfWeek === 5) { // Friday
            suggestions.push({ templateId: 'weekly-review', reason: 'End of week' });
        }

        // Avoid recently used templates
        const filtered = suggestions.filter(s => !recentTemplates.includes(s.templateId));

        // Get full template data
        const result = [];
        for (const suggestion of filtered.slice(0, 3)) {
            const template = await this.getTemplate(suggestion.templateId);
            if (template) {
                result.push({ ...template, suggestionReason: suggestion.reason });
            }
        }

        return result;
    }

    /**
     * Export template
     * @param {string} templateId - Template ID
     * @returns {Promise<Object>} Export data
     */
    async exportTemplate(templateId) {
        const template = await this.getTemplate(templateId);
        if (!template) {
            throw new Error('Template not found');
        }

        const exportData = {
            format: 'taskmaster-template-v1',
            exportedAt: new Date().toISOString(),
            template
        };

        return exportData;
    }

    /**
     * Import template
     * @param {Object} exportData - Exported template data
     * @returns {Promise<Object>} Imported template
     */
    async importTemplate(exportData) {
        if (exportData.format !== 'taskmaster-template-v1') {
            throw new Error('Invalid template format');
        }

        const template = {
            ...exportData.template,
            id: this._generateId(),
            isCustom: true,
            importedAt: new Date().toISOString()
        };

        await this._saveCustomTemplate(template);

        eventBus.emit(AppEvents.TEMPLATE_IMPORTED, { template });

        return template;
    }

    /**
     * Get template statistics
     * @returns {Promise<Object>} Statistics
     */
    async getStats() {
        const customTemplates = await this._getCustomTemplates();
        
        return {
            defaultTemplatesCount: this.defaultTemplates.length,
            customTemplatesCount: customTemplates.length,
            categories: this.categories.map(c => ({
                ...c,
                count: [...this.defaultTemplates, ...customTemplates].filter(t => t.category === c.id).length
            }))
        };
    }

    // ==================== Private Methods ====================

    async _getCustomTemplates() {
        return await this.storage.getSetting('custom_templates', []);
    }

    async _saveCustomTemplate(template) {
        const customTemplates = await this._getCustomTemplates();
        customTemplates.push(template);
        await this.storage.saveSetting('custom_templates', customTemplates);
    }

    _generateId() {
        return 'tpl_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }
}

// Additional events
AppEvents.TEMPLATE_CREATED = 'template:created';
AppEvents.TEMPLATE_UPDATED = 'template:updated';
AppEvents.TEMPLATE_DELETED = 'template:deleted';
AppEvents.TEMPLATE_APPLIED = 'template:applied';
AppEvents.TEMPLATE_IMPORTED = 'template:imported';

export { TemplatesManager };
