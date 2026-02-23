/**
 * Advanced Query Language for Task Filtering
 * ===========================================
 * SQL-like query syntax for complex filtering
 */

import { eventBus, EVENTS } from '../event-bus.js';

/**
 * Query Parser - Parses query strings into filter objects
 */
export class QueryParser {
    constructor() {
        this.operators = {
            '=': (a, b) => a === b,
            '!=': (a, b) => a !== b,
            '>': (a, b) => a > b,
            '<': (a, b) => a < b,
            '>=': (a, b) => a >= b,
            '<=': (a, b) => a <= b,
            'contains': (a, b) => a.toLowerCase().includes(b.toLowerCase()),
            'startswith': (a, b) => a.toLowerCase().startsWith(b.toLowerCase()),
            'endswith': (a, b) => a.toLowerCase().endsWith(b.toLowerCase()),
            'in': (a, b) => b.split(',').map(s => s.trim()).includes(a),
            'notin': (a, b) => !b.split(',').map(s => s.trim()).includes(a)
        };

        this.fields = {
            text: 'string',
            priority: 'enum',
            completed: 'boolean',
            dueDate: 'date',
            createdAt: 'date',
            category: 'array',
            tag: 'array',
            notes: 'string',
            overdue: 'computed',
            today: 'computed',
            tomorrow: 'computed',
            week: 'computed',
            pending: 'computed',
            done: 'computed'
        };
    }

    /**
     * Parse query string into filter object
     */
    parse(query) {
        if (!query || !query.trim()) {
            return { filters: [], sort: null, limit: null };
        }

        const result = {
            filters: [],
            sort: null,
            limit: null,
            errors: []
        };

        // Handle special commands
        const parts = this.tokenize(query);
        
        parts.forEach(part => {
            part = part.trim();
            
            // Skip empty parts
            if (!part) return;

            // Handle ORDER BY
            if (part.toUpperCase().startsWith('ORDER BY ')) {
                result.sort = this.parseOrderBy(part.substring(9));
                return;
            }

            // Handle LIMIT
            if (part.toUpperCase().startsWith('LIMIT ')) {
                result.limit = parseInt(part.substring(6), 10);
                return;
            }

            // Handle special keywords
            if (this.isSpecialKeyword(part)) {
                result.filters.push(this.parseSpecialKeyword(part));
                return;
            }

            // Handle field comparisons
            const comparison = this.parseComparison(part);
            if (comparison) {
                result.filters.push(comparison);
                return;
            }

            // Default: text search
            result.filters.push({
                field: 'text',
                operator: 'contains',
                value: part
            });
        });

        return result;
    }

    /**
     * Tokenize query string
     */
    tokenize(query) {
        const tokens = [];
        let current = '';
        let inQuotes = false;
        let inParens = 0;

        for (let i = 0; i < query.length; i++) {
            const char = query[i];

            if (char === '"' || char === "'") {
                inQuotes = !inQuotes;
                current += char;
            } else if (char === '(') {
                inParens++;
                current += char;
            } else if (char === ')') {
                inParens--;
                current += char;
            } else if ((char === ' ' || char === ',') && !inQuotes && inParens === 0) {
                if (current.trim()) {
                    tokens.push(current.trim());
                }
                current = '';
            } else {
                current += char;
            }
        }

        if (current.trim()) {
            tokens.push(current.trim());
        }

        return tokens;
    }

    /**
     * Parse ORDER BY clause
     */
    parseOrderBy(orderBy) {
        const parts = orderBy.trim().split(/\s+/);
        const field = parts[0];
        const direction = parts[1]?.toUpperCase() === 'DESC' ? 'desc' : 'asc';

        const fieldMap = {
            priority: 'priority',
            due: 'dueDate',
            dueDate: 'dueDate',
            created: 'createdAt',
            createdAt: 'createdAt',
            text: 'text',
            title: 'text'
        };

        return {
            field: fieldMap[field.toLowerCase()] || field,
            direction
        };
    }

    /**
     * Check if part is a special keyword
     */
    isSpecialKeyword(part) {
        const keywords = ['overdue', 'today', 'tomorrow', 'week', 'pending', 'done', 'completed', 'active'];
        return keywords.includes(part.toLowerCase());
    }

    /**
     * Parse special keyword
     */
    parseSpecialKeyword(keyword) {
        const k = keyword.toLowerCase();
        
        switch (k) {
            case 'overdue':
                return { field: 'overdue', operator: '=', value: true };
            case 'today':
                return { field: 'today', operator: '=', value: true };
            case 'tomorrow':
                return { field: 'tomorrow', operator: '=', value: true };
            case 'week':
                return { field: 'week', operator: '=', value: true };
            case 'pending':
            case 'active':
                return { field: 'completed', operator: '=', value: false };
            case 'done':
            case 'completed':
                return { field: 'completed', operator: '=', value: true };
            default:
                return null;
        }
    }

    /**
     * Parse field comparison
     */
    parseComparison(part) {
        // Try different operators
        const operators = ['!=', '>=', '<=', '=', '>', '<', 'contains', 'in', 'notin'];
        
        for (const op of operators) {
            const index = part.indexOf(op);
            if (index > 0) {
                const field = part.substring(0, index).trim().toLowerCase();
                const value = part.substring(index + op.length).trim().replace(/['"]/g, '');
                
                // Validate field
                if (!this.fields[field]) {
                    return null;
                }

                return {
                    field,
                    operator: op,
                    value: this.convertValue(field, value)
                };
            }
        }

        return null;
    }

    /**
     * Convert value to appropriate type
     */
    convertValue(field, value) {
        const fieldType = this.fields[field];

        switch (fieldType) {
            case 'boolean':
                return value.toLowerCase() === 'true';
            case 'date':
                return this.parseDate(value);
            case 'enum':
                return value.toLowerCase();
            default:
                return value;
        }
    }

    /**
     * Parse date string
     */
    parseDate(value) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Relative dates
        if (value.toLowerCase() === 'today') return today;
        if (value.toLowerCase() === 'tomorrow') {
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            return tomorrow;
        }
        if (value.toLowerCase() === 'yesterday') {
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            return yesterday;
        }
        if (value.toLowerCase() === 'now') return now;

        // Parse ISO date
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
            return date;
        }

        return today;
    }
}

/**
 * Query Executor - Executes parsed queries against task data
 */
export class QueryExecutor {
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.parser = new QueryParser();
    }

    /**
     * Execute query
     */
    execute(query) {
        const parsed = this.parser.parse(query);
        const tasks = this.stateManager.getAllTasks();
        
        let results = this.applyFilters(tasks, parsed.filters);
        
        if (parsed.sort) {
            results = this.applySort(results, parsed.sort);
        }
        
        if (parsed.limit) {
            results = results.slice(0, parsed.limit);
        }

        return {
            results,
            query,
            parsed,
            count: results.length,
            total: tasks.length
        };
    }

    /**
     * Apply filters to tasks
     */
    applyFilters(tasks, filters) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const weekFromNow = new Date(today);
        weekFromNow.setDate(weekFromNow.getDate() + 7);

        return tasks.filter(task => {
            return filters.every(filter => {
                let fieldValue;

                // Handle computed fields
                switch (filter.field) {
                    case 'overdue':
                        fieldValue = !task.completed && task.dueDate && new Date(task.dueDate) < today;
                        break;
                    case 'today':
                        fieldValue = task.dueDate && new Date(task.dueDate).toDateString() === today.toDateString();
                        break;
                    case 'tomorrow':
                        fieldValue = task.dueDate && new Date(task.dueDate).toDateString() === tomorrow.toDateString();
                        break;
                    case 'week':
                        fieldValue = task.dueDate && 
                            new Date(task.dueDate) >= today && 
                            new Date(task.dueDate) <= weekFromNow;
                        break;
                    default:
                        fieldValue = this.getFieldValue(task, filter.field);
                }

                return this.applyOperator(fieldValue, filter.operator, filter.value);
            });
        });
    }

    /**
     * Get field value from task
     */
    getFieldValue(task, field) {
        switch (field) {
            case 'category':
                return task.categories || [];
            case 'tag':
                return task.tags || [];
            case 'priority':
                return task.priority;
            case 'completed':
                return task.completed;
            case 'text':
                return task.text;
            case 'notes':
                return task.notes || '';
            case 'dueDate':
                return task.dueDate ? new Date(task.dueDate) : null;
            case 'createdAt':
                return new Date(task.createdAt);
            default:
                return task[field];
        }
    }

    /**
     * Apply operator comparison
     */
    applyOperator(fieldValue, operator, value) {
        // Handle array fields
        if (Array.isArray(fieldValue)) {
            switch (operator) {
                case 'contains':
                case 'in':
                    return fieldValue.some(v => 
                        v.toLowerCase().includes(value.toLowerCase())
                    );
                case 'notin':
                    return !fieldValue.some(v => 
                        v.toLowerCase() === value.toLowerCase()
                    );
                default:
                    return false;
            }
        }

        // Handle date comparisons
        if (fieldValue instanceof Date && value instanceof Date) {
            switch (operator) {
                case '=':
                    return fieldValue.toDateString() === value.toDateString();
                case '!=':
                    return fieldValue.toDateString() !== value.toDateString();
                case '>':
                    return fieldValue > value;
                case '<':
                    return fieldValue < value;
                case '>=':
                    return fieldValue >= value;
                case '<=':
                    return fieldValue <= value;
                default:
                    return false;
            }
        }

        // Handle string comparisons
        if (typeof fieldValue === 'string') {
            switch (operator) {
                case '=':
                    return fieldValue.toLowerCase() === value.toLowerCase();
                case '!=':
                    return fieldValue.toLowerCase() !== value.toLowerCase();
                case 'contains':
                    return fieldValue.toLowerCase().includes(value.toLowerCase());
                case 'startswith':
                    return fieldValue.toLowerCase().startsWith(value.toLowerCase());
                case 'endswith':
                    return fieldValue.toLowerCase().endsWith(value.toLowerCase());
                default:
                    return false;
            }
        }

        // Handle boolean
        if (typeof fieldValue === 'boolean') {
            switch (operator) {
                case '=':
                    return fieldValue === value;
                case '!=':
                    return fieldValue !== value;
                default:
                    return false;
            }
        }

        return false;
    }

    /**
     * Apply sorting
     */
    applySort(tasks, sort) {
        return [...tasks].sort((a, b) => {
            let aVal = this.getFieldValue(a, sort.field);
            let bVal = this.getFieldValue(b, sort.field);

            // Handle priority sorting
            if (sort.field === 'priority') {
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                aVal = priorityOrder[aVal] || 0;
                bVal = priorityOrder[bVal] || 0;
            }

            // Handle null values
            if (aVal === null || aVal === undefined) aVal = sort.direction === 'asc' ? Infinity : -Infinity;
            if (bVal === null || bVal === undefined) bVal = sort.direction === 'asc' ? Infinity : -Infinity;

            let comparison = 0;
            if (aVal > bVal) comparison = 1;
            else if (aVal < bVal) comparison = -1;

            return sort.direction === 'asc' ? comparison : -comparison;
        });
    }
}

/**
 * Query Builder - Fluent interface for building queries
 */
export class QueryBuilder {
    constructor() {
        this.filters = [];
        this.sortField = null;
        this.sortDirection = 'asc';
        this.limitValue = null;
    }

    /**
     * Add text search filter
     */
    search(text) {
        this.filters.push({ field: 'text', operator: 'contains', value: text });
        return this;
    }

    /**
     * Filter by priority
     */
    priority(level) {
        this.filters.push({ field: 'priority', operator: '=', value: level });
        return this;
    }

    /**
     * Filter by completion status
     */
    completed(isCompleted = true) {
        this.filters.push({ field: 'completed', operator: '=', value: isCompleted });
        return this;
    }

    /**
     * Filter by category
     */
    category(cat) {
        this.filters.push({ field: 'category', operator: 'in', value: cat });
        return this;
    }

    /**
     * Filter overdue tasks
     */
    overdue() {
        this.filters.push({ field: 'overdue', operator: '=', value: true });
        return this;
    }

    /**
     * Filter due today
     */
    dueToday() {
        this.filters.push({ field: 'today', operator: '=', value: true });
        return this;
    }

    /**
     * Filter due this week
     */
    dueThisWeek() {
        this.filters.push({ field: 'week', operator: '=', value: true });
        return this;
    }

    /**
     * Sort by field
     */
    sortBy(field, direction = 'asc') {
        this.sortField = field;
        this.sortDirection = direction;
        return this;
    }

    /**
     * Limit results
     */
    limit(count) {
        this.limitValue = count;
        return this;
    }

    /**
     * Build query string
     */
    build() {
        const parts = [];

        // Add filters
        this.filters.forEach(f => {
            if (f.field === 'overdue' && f.value === true) {
                parts.push('overdue');
            } else if (f.field === 'today' && f.value === true) {
                parts.push('today');
            } else if (f.field === 'completed' && f.value === false) {
                parts.push('pending');
            } else if (f.field === 'completed' && f.value === true) {
                parts.push('done');
            } else {
                parts.push(`${f.field} ${f.operator} "${f.value}"`);
            }
        });

        // Add sort
        if (this.sortField) {
            parts.push(`ORDER BY ${this.sortField} ${this.sortDirection.toUpperCase()}`);
        }

        // Add limit
        if (this.limitValue) {
            parts.push(`LIMIT ${this.limitValue}`);
        }

        return parts.join(' ');
    }
}

/**
 * Create new query builder
 */
export function query() {
    return new QueryBuilder();
}
