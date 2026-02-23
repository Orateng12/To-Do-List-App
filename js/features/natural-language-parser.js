/**
 * Natural Language Input Parser
 * ==============================
 * Advanced text parsing for quick task entry
 * 
 * Features:
 * - Priority detection (!high, !low, !medium)
 * - Date parsing (tomorrow, next week, in 3 days)
 * - Time parsing (3pm, 15:00, in 2 hours)
 * - Recurrence detection (every day, weekly)
 * - Category/tag extraction (#work, #personal)
 * - Smart suggestions
 */

import { eventBus, AppEvents } from '../core/event-bus.js';

class NaturalLanguageParser {
    constructor() {
        // Priority keywords
        this.priorityPatterns = {
            high: [
                /!high/i, /!urgent/i, /!important/i, /!asap/i, /!critical/i,
                /\burgent\b/i, /\basap\b/i, /\bcritical\b/i, /\bemergency\b/i,
                /!!!/
            ],
            medium: [
                /!medium/i, /!normal/i, /!!/
            ],
            low: [
                /!low/i, /!later/i, /!someday/i, /!optional/i,
                /\blater\b/i, /\boptional\b/i, /\bsomeday\b/i,
                /!/
            ]
        };
        
        // Date patterns
        this.datePatterns = {
            today: [/today/i, /this morning/i, /this afternoon/i, /tonight/i],
            tomorrow: [/tomorrow/i, /tmrw/i],
            yesterday: [/yesterday/i],
            nextWeek: [/next week/i, /next wk/i],
            nextMonth: [/next month/i, /next mo/i],
            weekend: [/this weekend/i, /sat/i, /sun/i],
            relative: [
                /in (\d+) days?/i,
                /in (\d+) weeks?/i,
                /in (\d+) months?/i,
                /after (\d+) days?/i
            ]
        };
        
        // Time patterns
        this.timePatterns = [
            /at (\d{1,2}):(\d{2})\s*(am|pm)?/i,
            /at (\d{1,2})\s*(am|pm)/i,
            /by (\d{1,2}):(\d{2})\s*(am|pm)?/i,
            /by (\d{1,2})\s*(am|pm)/i,
            /in (\d+) hours?/i,
            /in (\d+) minutes?/i
        ];
        
        // Recurrence patterns
        this.recurrencePatterns = {
            daily: [/every day/i, /daily/i, /each day/i],
            weekly: [/every week/i, /weekly/i, /every monday/i, /every tuesday/i, /every wednesday/i, /every thursday/i, /every friday/i],
            monthly: [/every month/i, /monthly/i, /every (\d+)(st|nd|rd|th)/i],
            yearly: [/every year/i, /yearly/i, /annually/i]
        };
        
        // Category/Tag pattern
        this.tagPattern = /#(\w+)/g;
        
        // Weekday mapping
        this.weekdays = {
            'monday': 1, 'mon': 1,
            'tuesday': 2, 'tue': 2,
            'wednesday': 3, 'wed': 3,
            'thursday': 4, 'thu': 4,
            'friday': 5, 'fri': 5,
            'saturday': 6, 'sat': 6,
            'sunday': 0, 'sun': 0
        };
    }

    /**
     * Parse natural language input
     * @param {string} input - User input text
     * @returns {Object} Parsed task data
     */
    parse(input) {
        if (!input || typeof input !== 'string') {
            return this._createEmptyResult();
        }
        
        const result = this._createEmptyResult();
        result.originalText = input;
        result.cleanedText = input;
        
        // Extract components
        result.priority = this._extractPriority(input);
        result.dueDate = this._extractDate(input);
        result.time = this._extractTime(input);
        result.recurrence = this._extractRecurrence(input);
        result.tags = this._extractTags(input);
        
        // Combine date and time
        if (result.dueDate && result.time) {
            result.dueDate.setHours(result.time.hours, result.time.minutes);
        }
        
        // Clean the text (remove parsed patterns)
        result.cleanedText = this._cleanText(input, result);
        
        // Generate suggestions
        result.suggestions = this._generateSuggestions(result);
        
        // Set metadata
        result.hasNaturalLanguage = this._hasNaturalLanguage(result);
        result.confidence = this._calculateConfidence(result);
        
        return result;
    }

    /**
     * Extract priority from text
     * @private
     */
    _extractPriority(text) {
        for (const [priority, patterns] of Object.entries(this.priorityPatterns)) {
            for (const pattern of patterns) {
                if (pattern.test(text)) {
                    return {
                        value: priority,
                        matched: text.match(pattern)[0],
                        confidence: this._getPriorityConfidence(priority, text)
                    };
                }
            }
        }
        return null;
    }

    /**
     * Extract date from text
     * @private
     */
    _extractDate(text) {
        const now = new Date();
        
        // Check absolute dates first
        const absoluteDate = this._parseAbsoluteDate(text);
        if (absoluteDate) return absoluteDate;
        
        // Check relative dates
        for (const [type, patterns] of Object.entries(this.datePatterns)) {
            for (const pattern of patterns) {
                const match = text.match(pattern);
                if (match) {
                    return this._calculateRelativeDate(type, match, now);
                }
            }
        }
        
        // Check weekday names
        for (const [day, value] of Object.entries(this.weekdays)) {
            if (new RegExp(`\\b${day}\\b`, 'i').test(text)) {
                return this._getNextWeekday(value, now);
            }
        }
        
        return null;
    }

    /**
     * Extract time from text
     * @private
     */
    _extractTime(text) {
        for (const pattern of this.timePatterns) {
            const match = text.match(pattern);
            if (match) {
                return this._parseTimeMatch(match);
            }
        }
        return null;
    }

    /**
     * Extract recurrence from text
     * @private
     */
    _extractRecurrence(text) {
        for (const [type, patterns] of Object.entries(this.recurrencePatterns)) {
            for (const pattern of patterns) {
                const match = text.match(pattern);
                if (match) {
                    return {
                        type,
                        matched: match[0],
                        interval: this._extractInterval(match)
                    };
                }
            }
        }
        return null;
    }

    /**
     * Extract tags from text
     * @private
     */
    _extractTags(text) {
        const tags = [];
        let match;
        
        while ((match = this.tagPattern.exec(text)) !== null) {
            tags.push({
                value: match[1].toLowerCase(),
                matched: match[0]
            });
        }
        
        return tags.length > 0 ? tags : null;
    }

    /**
     * Parse absolute date (e.g., "2024-01-15", "Jan 15")
     * @private
     */
    _parseAbsoluteDate(text) {
        // ISO format: YYYY-MM-DD
        const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) {
            return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
        }
        
        // US format: MM/DD/YYYY
        const usMatch = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (usMatch) {
            return new Date(parseInt(usMatch[3]), parseInt(usMatch[1]) - 1, parseInt(usMatch[2]));
        }
        
        return null;
    }

    /**
     * Calculate relative date
     * @private
     */
    _calculateRelativeDate(type, match, now) {
        const date = new Date(now);
        
        switch (type) {
            case 'today':
                return date;
            case 'tomorrow':
                date.setDate(date.getDate() + 1);
                return date;
            case 'yesterday':
                date.setDate(date.getDate() - 1);
                return date;
            case 'nextWeek':
                date.setDate(date.getDate() + 7);
                return date;
            case 'nextMonth':
                date.setMonth(date.getMonth() + 1);
                return date;
            case 'weekend':
                return this._getNextWeekend(date);
            case 'relative':
                const value = parseInt(match[1]);
                if (match[0].includes('day')) {
                    date.setDate(date.getDate() + value);
                } else if (match[0].includes('week')) {
                    date.setDate(date.getDate() + (value * 7));
                } else if (match[0].includes('month')) {
                    date.setMonth(date.getMonth() + value);
                }
                return date;
        }
        
        return null;
    }

    /**
     * Get next weekend
     * @private
     */
    _getNextWeekend(date) {
        const day = date.getDay();
        const daysUntilSaturday = 6 - day;
        
        if (daysUntilSaturday > 0) {
            date.setDate(date.getDate() + daysUntilSaturday);
        } else {
            date.setDate(date.getDate() + 7);
        }
        
        return date;
    }

    /**
     * Get next occurrence of weekday
     * @private
     */
    _getNextWeekday(weekday, now) {
        const date = new Date(now);
        const currentDay = date.getDay();
        let daysUntil = weekday - currentDay;
        
        if (daysUntil <= 0) {
            daysUntil += 7;
        }
        
        date.setDate(date.getDate() + daysUntil);
        return date;
    }

    /**
     * Parse time match
     * @private
     */
    _parseTimeMatch(match) {
        let hours, minutes;
        
        if (match[3] || match[2]) {
            // Has am/pm
            hours = parseInt(match[1]);
            minutes = match[2] ? parseInt(match[2]) : 0;
            const period = (match[3] || match[2]).toLowerCase();
            
            if (period === 'pm' && hours < 12) {
                hours += 12;
            } else if (period === 'am' && hours === 12) {
                hours = 0;
            }
        } else {
            // Relative time (in X hours/minutes)
            const value = parseInt(match[1]);
            const now = new Date();
            
            if (match[0].includes('hour')) {
                now.setHours(now.getHours() + value);
            } else if (match[0].includes('minute')) {
                now.setMinutes(now.getMinutes() + value);
            }
            
            return {
                hours: now.getHours(),
                minutes: now.getMinutes(),
                matched: match[0]
            };
        }
        
        return { hours, minutes, matched: match[0] };
    }

    /**
     * Extract interval from recurrence match
     * @private
     */
    _extractInterval(match) {
        const numMatch = match[0].match(/(\d+)/);
        return numMatch ? parseInt(numMatch[1]) : 1;
    }

    /**
     * Clean text by removing parsed patterns
     * @private
     */
    _cleanText(text, result) {
        let cleaned = text;
        
        // Remove priority markers
        if (result.priority) {
            cleaned = cleaned.replace(result.priority.matched, '').trim();
        }
        
        // Remove date patterns
        if (result.dueDate) {
            // Remove common date expressions
            cleaned = cleaned
                .replace(/today|tomorrow|yesterday|next week|next month/gi, '')
                .replace(/in \d+ days?/gi, '')
                .replace(/on \w+day/gi, '')
                .trim();
        }
        
        // Remove tags
        if (result.tags) {
            result.tags.forEach(tag => {
                cleaned = cleaned.replace(tag.matched, '').trim();
            });
        }
        
        // Remove recurrence
        if (result.recurrence) {
            cleaned = cleaned.replace(result.recurrence.matched, '').trim();
        }
        
        // Clean up extra spaces
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        
        // Remove trailing punctuation
        cleaned = cleaned.replace(/[,\s]+$/, '');
        
        return cleaned;
    }

    /**
     * Generate suggestions based on parsed data
     * @private
     */
    _generateSuggestions(result) {
        const suggestions = [];
        
        if (result.priority?.value === 'high' && !result.dueDate) {
            suggestions.push({
                type: 'info',
                message: 'High priority tasks often have deadlines. Add a due date?',
                action: 'suggestDate'
            });
        }
        
        if (result.recurrence && !result.dueDate) {
            suggestions.push({
                type: 'info',
                message: 'Set a start date for this recurring task?',
                action: 'suggestDate'
            });
        }
        
        if (result.tags?.length > 3) {
            suggestions.push({
                type: 'info',
                message: 'Consider creating separate tasks for complex items',
                action: 'suggestSplit'
            });
        }
        
        return suggestions;
    }

    /**
     * Check if input contains natural language patterns
     * @private
     */
    _hasNaturalLanguage(result) {
        return !!(
            result.priority ||
            result.dueDate ||
            result.time ||
            result.recurrence ||
            result.tags
        );
    }

    /**
     * Calculate confidence score
     * @private
     */
    _calculateConfidence(result) {
        let score = 0;
        let factors = 0;
        
        if (result.priority) {
            score += result.priority.confidence;
            factors++;
        }
        if (result.dueDate) {
            score += 0.9;
            factors++;
        }
        if (result.time) {
            score += 0.8;
            factors++;
        }
        if (result.recurrence) {
            score += 0.85;
            factors++;
        }
        if (result.tags?.length > 0) {
            score += 0.95;
            factors++;
        }
        
        return factors > 0 ? Math.round((score / factors) * 100) / 100 : 0;
    }

    /**
     * Get priority confidence
     * @private
     */
    _getPriorityConfidence(priority, text) {
        // Explicit markers have higher confidence
        if (text.includes(`!${priority}`)) {
            return 1.0;
        }
        // Keyword matches have medium confidence
        if (priority === 'high' && /urgent|asap|critical/i.test(text)) {
            return 0.8;
        }
        if (priority === 'low' && /later|optional|someday/i.test(text)) {
            return 0.7;
        }
        return 0.5;
    }

    /**
     * Create empty result object
     * @private
     */
    _createEmptyResult() {
        return {
            originalText: '',
            cleanedText: '',
            priority: null,
            dueDate: null,
            time: null,
            recurrence: null,
            tags: null,
            suggestions: [],
            hasNaturalLanguage: false,
            confidence: 0
        };
    }

    /**
     * Format date for display
     */
    static formatDate(date) {
        if (!date) return '';
        
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        }
        if (date.toDateString() === tomorrow.toDateString()) {
            return 'Tomorrow';
        }
        
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
    }

    /**
     * Format time for display
     */
    static formatTime(hours, minutes) {
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
        const displayMinutes = minutes.toString().padStart(2, '0');
        return `${displayHours}:${displayMinutes} ${period}`;
    }
}

export { NaturalLanguageParser };
