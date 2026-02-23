/**
 * Web Worker for Background Processing
 * =====================================
 * Offloads heavy computation to maintain 60fps UI
 */

// This file runs in a Web Worker context

let tasks = [];
let searchIndex = null;

/**
 * Build search index for fast lookups
 */
function buildSearchIndex(taskList) {
    const index = {
        text: new Map(),
        categories: new Map(),
        tags: new Map()
    };

    taskList.forEach((task, taskIndex) => {
        // Index text
        const words = task.text.toLowerCase().split(/\s+/);
        words.forEach(word => {
            if (!index.text.has(word)) {
                index.text.set(word, []);
            }
            index.text.get(word).push(taskIndex);
        });

        // Index categories
        if (task.categories) {
            task.categories.forEach(cat => {
                const normalized = cat.toLowerCase();
                if (!index.categories.has(normalized)) {
                    index.categories.set(normalized, []);
                }
                index.categories.get(normalized).push(taskIndex);
            });
        }

        // Index tags
        if (task.tags) {
            task.tags.forEach(tag => {
                const normalized = tag.toLowerCase();
                if (!index.tags.has(normalized)) {
                    index.tags.set(normalized, []);
                }
                index.tags.get(normalized).push(taskIndex);
            });
        }
    });

    return index;
}

/**
 * Search tasks using the index
 */
function search(query, filters = {}) {
    const startTime = performance.now();
    const normalizedQuery = query.toLowerCase().trim();
    
    if (!normalizedQuery) {
        return filterTasks(tasks, filters);
    }

    const words = normalizedQuery.split(/\s+/);
    const matchingIndices = new Set();

    // Search in each word
    words.forEach(word => {
        // Text search
        if (searchIndex.text.has(word)) {
            searchIndex.text.get(word).forEach(idx => matchingIndices.add(idx));
        }

        // Partial match (slower but more accurate)
        searchIndex.text.forEach((indices, indexedWord) => {
            if (indexedWord.includes(word)) {
                indices.forEach(idx => matchingIndices.add(idx));
            }
        });

        // Category search
        if (searchIndex.categories.has(word)) {
            searchIndex.categories.get(word).forEach(idx => matchingIndices.add(idx));
        }

        // Tag search
        if (searchIndex.tags.has(word)) {
            searchIndex.tags.get(word).forEach(idx => matchingIndices.add(idx));
        }
    });

    // Get matching tasks
    const results = Array.from(matchingIndices).map(idx => tasks[idx]);
    const filtered = filterTasks(results, filters);

    const endTime = performance.now();

    return {
        results: filtered,
        query,
        totalMatches: results.length,
        filteredMatches: filtered.length,
        searchTime: endTime - startTime
    };
}

/**
 * Filter tasks by criteria
 */
function filterTasks(taskList, filters) {
    return taskList.filter(task => {
        // Filter by completion
        if (filters.completed !== undefined) {
            if (filters.completed && !task.completed) return false;
            if (!filters.completed && task.completed) return false;
        }

        // Filter by priority
        if (filters.priority && task.priority !== filters.priority) return false;

        // Filter by category
        if (filters.category && (!task.categories || !task.categories.includes(filters.category))) {
            return false;
        }

        // Filter by date range
        if (filters.dateFrom) {
            const taskDate = new Date(task.createdAt);
            const fromDate = new Date(filters.dateFrom);
            if (taskDate < fromDate) return false;
        }

        if (filters.dateTo) {
            const taskDate = new Date(task.createdAt);
            const toDate = new Date(filters.dateTo);
            if (taskDate > toDate) return false;
        }

        // Filter by overdue
        if (filters.overdue) {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (!task.dueDate || !task.completed) {
                const dueDate = new Date(task.dueDate);
                if (dueDate >= today) return false;
            }
        }

        return true;
    });
}

/**
 * Sort tasks
 */
function sort(taskList, sortBy = 'createdAt', order = 'desc') {
    const sorted = [...taskList];

    sorted.sort((a, b) => {
        let comparison = 0;

        switch (sortBy) {
            case 'priority':
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                comparison = priorityOrder[b.priority] - priorityOrder[a.priority];
                break;
            case 'dueDate':
                if (!a.dueDate && !b.dueDate) comparison = 0;
                else if (!a.dueDate) comparison = 1;
                else if (!b.dueDate) comparison = -1;
                else comparison = new Date(a.dueDate) - new Date(b.dueDate);
                break;
            case 'text':
                comparison = a.text.localeCompare(b.text);
                break;
            case 'createdAt':
            default:
                comparison = new Date(b.createdAt) - new Date(a.createdAt);
        }

        return order === 'asc' ? -comparison : comparison;
    });

    return sorted;
}

/**
 * Calculate statistics
 */
function calculateStats(taskList) {
    const total = taskList.length;
    const completed = taskList.filter(t => t.completed).length;
    const active = total - completed;
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const overdue = taskList.filter(t => 
        !t.completed && 
        t.dueDate && 
        new Date(t.dueDate) < today
    ).length;

    const highPriority = taskList.filter(t => 
        !t.completed && 
        t.priority === 'high'
    ).length;

    const dueToday = taskList.filter(t => 
        !t.completed && 
        t.dueDate && 
        new Date(t.dueDate).toDateString() === today.toDateString()
    ).length;

    const dueTomorrow = taskList.filter(t => {
        if (!t.dueDate || t.completed) return false;
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return new Date(t.dueDate).toDateString() === tomorrow.toDateString();
    });

    // Category breakdown
    const categoryStats = {};
    taskList.forEach(task => {
        if (task.categories) {
            task.categories.forEach(cat => {
                if (!categoryStats[cat]) {
                    categoryStats[cat] = { total: 0, completed: 0 };
                }
                categoryStats[cat].total++;
                if (task.completed) {
                    categoryStats[cat].completed++;
                }
            });
        }
    });

    // Priority breakdown
    const priorityStats = {
        high: taskList.filter(t => t.priority === 'high').length,
        medium: taskList.filter(t => t.priority === 'medium').length,
        low: taskList.filter(t => t.priority === 'low').length
    };

    // Completion trend (last 7 days)
    const completionTrend = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const completedOnDate = taskList.filter(t => 
            t.completed && 
            t.completedAt && 
            t.completedAt.startsWith(dateStr)
        ).length;

        const createdOnDate = taskList.filter(t => 
            t.createdAt.startsWith(dateStr)
        ).length;

        completionTrend.push({
            date: dateStr,
            completed: completedOnDate,
            created: createdOnDate
        });
    }

    return {
        total,
        completed,
        active,
        overdue,
        highPriority,
        dueToday,
        dueTomorrow: dueTomorrow.length,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        categoryStats,
        priorityStats,
        completionTrend
    };
}

/**
 * Group tasks
 */
function groupBy(taskList, field) {
    const groups = {};

    taskList.forEach(task => {
        let key;
        
        switch (field) {
            case 'priority':
                key = task.priority;
                break;
            case 'category':
                key = task.categories?.[0] || 'Uncategorized';
                break;
            case 'dueDate':
                if (!task.dueDate) {
                    key = 'No due date';
                } else {
                    const dueDate = new Date(task.dueDate);
                    const now = new Date();
                    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);

                    if (dueDate < today) {
                        key = 'Overdue';
                    } else if (dueDate.toDateString() === today.toDateString()) {
                        key = 'Today';
                    } else if (dueDate.toDateString() === tomorrow.toDateString()) {
                        key = 'Tomorrow';
                    } else {
                        key = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    }
                }
                break;
            default:
                key = task[field] || 'Unknown';
        }

        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(task);
    });

    return groups;
}

/**
 * Export tasks to various formats
 */
function exportData(taskList, format = 'json') {
    switch (format) {
        case 'json':
            return JSON.stringify(taskList, null, 2);
        
        case 'csv':
            const headers = ['ID', 'Text', 'Completed', 'Priority', 'Due Date', 'Created At', 'Categories'];
            const rows = taskList.map(task => [
                task.id,
                `"${task.text.replace(/"/g, '""')}"`,
                task.completed ? 'Yes' : 'No',
                task.priority,
                task.dueDate || '',
                task.createdAt,
                `"${(task.categories || []).join(', ')}"`
            ]);
            return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        
        case 'markdown':
            let md = '# TaskMaster Export\n\n';
            md += `**Exported:** ${new Date().toISOString()}\n`;
            md += `**Total Tasks:** ${taskList.length}\n\n`;
            
            md += '## Tasks\n\n';
            taskList.forEach((task, i) => {
                md += `- [${task.completed ? 'x' : ' '}] ${task.text}`;
                if (task.priority !== 'medium') {
                    md += ` *(${task.priority})*`;
                }
                if (task.dueDate) {
                    md += ` - Due: ${task.dueDate}`;
                }
                md += '\n';
            });
            
            return md;
        
        default:
            return JSON.stringify(taskList);
    }
}

// Message handler
self.onmessage = function(e) {
    const { type, payload } = e.data;

    switch (type) {
        case 'INIT':
            tasks = payload.tasks || [];
            searchIndex = buildSearchIndex(tasks);
            self.postMessage({ type: 'INIT_COMPLETE', taskCount: tasks.length });
            break;

        case 'UPDATE_TASKS':
            tasks = payload.tasks || [];
            searchIndex = buildSearchIndex(tasks);
            self.postMessage({ type: 'TASKS_UPDATED', taskCount: tasks.length });
            break;

        case 'SEARCH':
            const searchResults = search(payload.query, payload.filters);
            self.postMessage({ type: 'SEARCH_RESULTS', ...searchResults });
            break;

        case 'FILTER':
            const filtered = filterTasks(tasks, payload.filters);
            self.postMessage({ type: 'FILTER_RESULTS', results: filtered });
            break;

        case 'SORT':
            const sorted = sort(tasks, payload.sortBy, payload.order);
            self.postMessage({ type: 'SORT_RESULTS', results: sorted });
            break;

        case 'STATS':
            const stats = calculateStats(tasks);
            self.postMessage({ type: 'STATS_RESULTS', stats });
            break;

        case 'GROUP_BY':
            const grouped = groupBy(tasks, payload.field);
            self.postMessage({ type: 'GROUP_RESULTS', groups: grouped });
            break;

        case 'EXPORT':
            const exported = exportData(tasks, payload.format);
            self.postMessage({ type: 'EXPORT_RESULTS', data: exported });
            break;

        case 'REBUILD_INDEX':
            searchIndex = buildSearchIndex(tasks);
            self.postMessage({ type: 'INDEX_REBUILT' });
            break;

        default:
            console.warn('Unknown message type:', type);
    }
};
