/**
 * Natural Language Processing for Task Input
 * ===========================================
 * Parse natural language into structured task objects
 */

import { eventBus, EVENTS } from '../core/event-bus.js';

/**
 * NLP Parser for Task Input
 */
export class TaskNLP {
    constructor() {
        this.priorityKeywords = {
            high: ['urgent', 'asap', 'immediately', 'critical', 'emergency', 'important', 'priority'],
            medium: ['soon', 'shortly', 'normal', 'regular', 'standard'],
            low: ['sometime', 'whenever', 'low', 'relaxed', 'no rush', 'optional']
        };

        this.categoryKeywords = {
            work: ['work', 'office', 'job', 'meeting', 'presentation', 'report', 'project', 'client'],
            school: ['school', 'study', 'homework', 'assignment', 'exam', 'class', 'lecture', 'course'],
            personal: ['personal', 'home', 'family', 'errand', 'shopping', 'chores'],
            health: ['health', 'gym', 'workout', 'exercise', 'doctor', 'medical', 'dentist', 'fitness'],
            finance: ['finance', 'money', 'budget', 'tax', 'payment', 'bill', 'bank'],
            social: ['social', 'friend', 'party', 'dinner', 'call', 'visit', 'event']
        };

        this.actionVerbs = [
            'complete', 'finish', 'do', 'create', 'make', 'write', 'send', 'call',
            'email', 'schedule', 'book', 'buy', 'get', 'pick up', 'drop off',
            'attend', 'join', 'start', 'review', 'submit', 'prepare'
        ];

        this.datePatterns = [
            { pattern: /today/i, offset: 0 },
            { pattern: /tomorrow/i, offset: 1 },
            { pattern: /next week/i, offset: 7 },
            { pattern: /in (\d+) days/i, offset: (match) => parseInt(match[1]) },
            { pattern: /on (\w+day)/i, offset: (match) => this.getDayOffset(match[1]) }
        ];

        this.timePatterns = [
            { pattern: /morning/i, hour: 9 },
            { pattern: /afternoon/i, hour: 14 },
            { pattern: /evening/i, hour: 18 },
            { pattern: /night/i, hour: 20 },
            { pattern: /noon/i, hour: 12 },
            { pattern: /midnight/i, hour: 0 },
            { pattern: /(\d+)(am|pm)/i, hour: (match) => this.parseTime(match) }
        ];
    }

    /**
     * Parse natural language input into task object
     */
    parse(input) {
        const text = input.trim();
        const task = {
            text: this.extractTaskText(text),
            priority: this.detectPriority(text),
            category: this.detectCategory(text),
            dueDate: this.detectDate(text),
            dueTime: this.detectTime(text),
            estimatedDuration: this.detectDuration(text),
            isRecurring: this.detectRecurrence(text),
            recurrence: this.parseRecurrence(text),
            tags: this.extractTags(text),
            confidence: this.calculateConfidence(text)
        };

        // Validate and clean
        return this.validate(task);
    }

    /**
     * Extract main task text
     */
    extractTaskText(input) {
        let text = input;

        // Remove date/time indicators
        this.datePatterns.forEach(({ pattern }) => {
            text = text.replace(pattern, '');
        });

        this.timePatterns.forEach(({ pattern }) => {
            text = text.replace(pattern, '');
        });

        // Remove priority indicators
        Object.values(this.priorityKeywords).flat().forEach(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            text = text.replace(regex, '');
        });

        // Clean up extra spaces
        return text.replace(/\s+/g, ' ').trim();
    }

    /**
     * Detect priority from keywords
     */
    detectPriority(input) {
        const lower = input.toLowerCase();
        
        for (const [priority, keywords] of Object.entries(this.priorityKeywords)) {
            for (const keyword of keywords) {
                if (lower.includes(keyword)) {
                    return priority;
                }
            }
        }

        // Default based on urgency words
        if (lower.includes('!')) {
            return 'high';
        }

        return 'medium';
    }

    /**
     * Detect category from keywords
     */
    detectCategory(input) {
        const lower = input.toLowerCase();
        const scores = {};

        for (const [category, keywords] of Object.entries(this.categoryKeywords)) {
            scores[category] = 0;
            for (const keyword of keywords) {
                if (lower.includes(keyword)) {
                    scores[category]++;
                }
            }
        }

        // Return category with highest score
        const maxScore = Math.max(...Object.values(scores));
        if (maxScore === 0) return null;

        return Object.entries(scores).find(([_, score]) => score === maxScore)[0];
    }

    /**
     * Detect due date
     */
    detectDate(input) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Check patterns
        for (const { pattern, offset } of this.datePatterns) {
            const match = input.match(pattern);
            if (match) {
                const days = typeof offset === 'function' ? offset(match) : offset;
                const dueDate = new Date(today);
                dueDate.setDate(dueDate.getDate() + days);
                return dueDate.toISOString().split('T')[0];
            }
        }

        // Check for explicit date (YYYY-MM-DD or MM/DD)
        const dateMatch = input.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (dateMatch) {
            return dateMatch[0];
        }

        const monthDayMatch = input.match(/(\d{1,2})\/(\d{1,2})/);
        if (monthDayMatch) {
            const dueDate = new Date(today.getFullYear(), parseInt(monthDayMatch[1]) - 1, parseInt(monthDayMatch[2]));
            return dueDate.toISOString().split('T')[0];
        }

        return null;
    }

    /**
     * Detect due time
     */
    detectTime(input) {
        for (const { pattern, hour } of this.timePatterns) {
            const match = input.match(pattern);
            if (match) {
                if (typeof hour === 'function') {
                    return `${hour(match).toString().padStart(2, '0')}:00`;
                }
                return `${hour.toString().padStart(2, '0')}:00`;
            }
        }

        // Check for explicit time (HH:MM)
        const timeMatch = input.match(/(\d{1,2}):(\d{2})(am|pm)?/i);
        if (timeMatch) {
            let hour = parseInt(timeMatch[1]);
            if (timeMatch[3] && timeMatch[3].toLowerCase() === 'pm' && hour !== 12) {
                hour += 12;
            }
            if (timeMatch[3] && timeMatch[3].toLowerCase() === 'am' && hour === 12) {
                hour = 0;
            }
            return `${hour.toString().padStart(2, '0')}:${timeMatch[2]}`;
        }

        return null;
    }

    /**
     * Detect estimated duration
     */
    detectDuration(input) {
        const patterns = [
            { pattern: /(\d+)\s*(min|minute)/i, unit: 'minutes' },
            { pattern: /(\d+)\s*(hr|hour)/i, unit: 'hours' },
            { pattern: /(\d+)\s*(day)/i, unit: 'days' },
            { pattern: /half an hour/i, value: 30, unit: 'minutes' },
            { pattern: /an hour/i, value: 60, unit: 'minutes' },
            { pattern: /all day/i, value: 8, unit: 'hours' }
        ];

        for (const { pattern, unit, value } of patterns) {
            const match = input.match(pattern);
            if (match) {
                return {
                    value: value || parseInt(match[1]),
                    unit
                };
            }
        }

        return null;
    }

    /**
     * Detect if task is recurring
     */
    detectRecurrence(input) {
        const recurringKeywords = ['every', 'daily', 'weekly', 'monthly', 'yearly', 'recurring', 'repeat'];
        return recurringKeywords.some(keyword => input.toLowerCase().includes(keyword));
    }

    /**
     * Parse recurrence pattern
     */
    parseRecurrence(input) {
        const lower = input.toLowerCase();

        if (lower.includes('daily') || lower.includes('every day')) {
            return { type: 'daily', interval: 1 };
        }
        if (lower.includes('weekly') || lower.includes('every week')) {
            return { type: 'weekly', interval: 1 };
        }
        if (lower.includes('monthly') || lower.includes('every month')) {
            return { type: 'monthly', interval: 1 };
        }
        if (lower.includes('every other day')) {
            return { type: 'daily', interval: 2 };
        }
        if (lower.includes('every other week')) {
            return { type: 'weekly', interval: 2 };
        }

        // Parse "every X days/weeks"
        const everyMatch = lower.match(/every\s+(\d+)\s*(day|week|month)s?/);
        if (everyMatch) {
            return {
                type: everyMatch[2],
                interval: parseInt(everyMatch[1])
            };
        }

        // Parse "every Monday", etc.
        const dayMatch = lower.match(/every\s+(\w+day)/);
        if (dayMatch) {
            const dayMap = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
            return {
                type: 'weekly',
                daysOfWeek: [dayMap[dayMatch[1]]]
            };
        }

        return null;
    }

    /**
     * Extract tags from input
     */
    extractTags(input) {
        const tags = [];
        
        // Extract #hashtags
        const hashtagMatches = input.match(/#(\w+)/g);
        if (hashtagMatches) {
            tags.push(...hashtagMatches.map(tag => tag.substring(1).toLowerCase()));
        }

        return tags;
    }

    /**
     * Calculate parsing confidence
     */
    calculateConfidence(input) {
        let confidence = 0.5; // Base confidence

        // More words = higher confidence
        const wordCount = input.split(' ').length;
        if (wordCount > 3) confidence += 0.1;
        if (wordCount > 5) confidence += 0.1;

        // Has date = higher confidence
        if (this.detectDate(input)) confidence += 0.1;

        // Has time = higher confidence
        if (this.detectTime(input)) confidence += 0.1;

        // Has priority = higher confidence
        if (this.detectPriority(input) !== 'medium') confidence += 0.05;

        return Math.min(confidence, 1.0);
    }

    /**
     * Validate parsed task
     */
    validate(task) {
        // Ensure text exists
        if (!task.text || task.text.length === 0) {
            throw new Error('Could not extract task text');
        }

        // Ensure text is not too long
        if (task.text.length > 500) {
            task.text = task.text.substring(0, 500);
        }

        // Validate priority
        if (!['low', 'medium', 'high'].includes(task.priority)) {
            task.priority = 'medium';
        }

        return task;
    }

    /**
     * Helper: Get day offset
     */
    getDayOffset(dayName) {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const today = new Date().getDay();
        const targetDay = days.indexOf(dayName.toLowerCase());
        
        if (targetDay === -1) return 0;

        let offset = targetDay - today;
        if (offset <= 0) offset += 7; // Next occurrence

        return offset;
    }

    /**
     * Helper: Parse time
     */
    parseTime(match) {
        let hour = parseInt(match[1]);
        const ampm = match[2].toLowerCase();

        if (ampm === 'pm' && hour !== 12) {
            hour += 12;
        }
        if (ampm === 'am' && hour === 12) {
            hour = 0;
        }

        return hour;
    }

    /**
     * Get parsing suggestions
     */
    getSuggestions(input) {
        const parsed = this.parse(input);
        const suggestions = [];

        if (!parsed.dueDate) {
            suggestions.push({ type: 'date', message: 'Consider adding a due date' });
        }

        if (parsed.priority === 'medium' && parsed.dueDate) {
            const daysUntil = (new Date(parsed.dueDate) - new Date()) / (1000 * 60 * 60 * 24);
            if (daysUntil < 2) {
                suggestions.push({ type: 'priority', message: 'Task due soon - consider high priority' });
            }
        }

        if (parsed.estimatedDuration && !parsed.dueTime) {
            suggestions.push({ type: 'time', message: 'Consider adding a specific time' });
        }

        return suggestions;
    }
}

/**
 * Smart Task Input Component
 */
export class SmartTaskInput {
    constructor(nlp) {
        this.nlp = nlp || new TaskNLP();
        this.inputElement = null;
        this.suggestionsElement = null;
        this.previewElement = null;
    }

    /**
     * Initialize smart input
     */
    init(inputSelector, suggestionsSelector, previewSelector) {
        this.inputElement = document.querySelector(inputSelector);
        this.suggestionsElement = document.querySelector(suggestionsSelector);
        this.previewElement = document.querySelector(previewSelector);

        if (!this.inputElement) return;

        this.inputElement.addEventListener('input', (e) => this.onInput(e));
        this.inputElement.addEventListener('keydown', (e) => this.onKeydown(e));
    }

    /**
     * Handle input change
     */
    onInput(e) {
        const value = e.target.value;

        if (value.length < 3) {
            this.clearSuggestions();
            this.clearPreview();
            return;
        }

        try {
            const parsed = this.nlp.parse(value);
            this.showPreview(parsed);
            this.showSuggestions(this.nlp.getSuggestions(value));
        } catch (error) {
            this.clearPreview();
        }
    }

    /**
     * Handle keydown
     */
    onKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.submit();
        }
    }

    /**
     * Show parsed preview
     */
    showPreview(parsed) {
        if (!this.previewElement) return;

        const preview = `
            <div class="nlp-preview">
                ${parsed.priority !== 'medium' ? `<span class="priority-badge priority-${parsed.priority}">${parsed.priority}</span>` : ''}
                ${parsed.category ? `<span class="category-badge">${parsed.category}</span>` : ''}
                ${parsed.dueDate ? `<span class="date-badge">📅 ${parsed.dueDate}</span>` : ''}
                ${parsed.dueTime ? `<span class="time-badge">🕐 ${parsed.dueTime}</span>` : ''}
                ${parsed.estimatedDuration ? `<span class="duration-badge">⏱ ${parsed.estimatedDuration.value} ${parsed.estimatedDuration.unit}</span>` : ''}
                ${parsed.isRecurring ? `<span class="recurring-badge">🔄 ${parsed.recurrence.type}</span>` : ''}
                ${parsed.tags.length > 0 ? `<span class="tags-badge">${parsed.tags.join(', ')}</span>` : ''}
            </div>
        `;

        this.previewElement.innerHTML = preview;
        this.previewElement.classList.add('visible');
    }

    /**
     * Show suggestions
     */
    showSuggestions(suggestions) {
        if (!this.suggestionsElement || suggestions.length === 0) {
            this.clearSuggestions();
            return;
        }

        const html = `
            <div class="nlp-suggestions">
                ${suggestions.map(s => `
                    <div class="suggestion-item suggestion-${s.type}">
                        <span class="suggestion-icon">${this.getSuggestionIcon(s.type)}</span>
                        <span class="suggestion-text">${s.message}</span>
                    </div>
                `).join('')}
            </div>
        `;

        this.suggestionsElement.innerHTML = html;
        this.suggestionsElement.classList.add('visible');
    }

    /**
     * Clear suggestions
     */
    clearSuggestions() {
        if (this.suggestionsElement) {
            this.suggestionsElement.classList.remove('visible');
            this.suggestionsElement.innerHTML = '';
        }
    }

    /**
     * Clear preview
     */
    clearPreview() {
        if (this.previewElement) {
            this.previewElement.classList.remove('visible');
            this.previewElement.innerHTML = '';
        }
    }

    /**
     * Get suggestion icon
     */
    getSuggestionIcon(type) {
        const icons = {
            date: '📅',
            time: '🕐',
            priority: '⚡',
            category: '🏷️',
            duration: '⏱'
        };
        return icons[type] || '💡';
    }

    /**
     * Submit parsed task
     */
    submit() {
        const value = this.inputElement?.value;
        if (!value) return;

        try {
            const parsed = this.nlp.parse(value);
            
            eventBus.emit(EVENTS.TASK_NLP_PARSED, {
                input: value,
                parsed,
                timestamp: Date.now()
            });

            this.clearSuggestions();
            this.clearPreview();
            
            return parsed;
        } catch (error) {
            console.error('NLP parse error:', error);
            return null;
        }
    }
}

/**
 * Create NLP parser
 */
export function createTaskNLP() {
    return new TaskNLP();
}

/**
 * Create smart input component
 */
export function createSmartTaskInput() {
    const nlp = new TaskNLP();
    const input = new SmartTaskInput(nlp);
    return { nlp, input };
}
