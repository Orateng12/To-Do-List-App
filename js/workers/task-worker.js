/**
 * TaskMaster Web Worker
 * ======================
 * Background processing for heavy computations
 * 
 * Handles:
 * - Bulk data processing
 * - Search indexing
 * - Data synchronization
 * - Analytics calculations
 * - ML predictions
 */

// Message types
const MessageType = {
    // Requests
    PROCESS_BULK: 'PROCESS_BULK',
    INDEX_SEARCH: 'INDEX_SEARCH',
    SEARCH_QUERY: 'SEARCH_QUERY',
    CALCULATE_ANALYTICS: 'CALCULATE_ANALYTICS',
    PREDICT_PRIORITY: 'PREDICT_PRIORITY',
    SYNC_DATA: 'SYNC_DATA',
    ENCRYPT_DATA: 'ENCRYPT_DATA',
    DECRYPT_DATA: 'DECRYPT_DATA',
    
    // Responses
    RESULT: 'RESULT',
    ERROR: 'ERROR',
    PROGRESS: 'PROGRESS'
};

// ==================== Search Index ====================

class SearchIndex {
    constructor() {
        this.index = new Map();
        this.documentCount = 0;
    }

    /**
     * Add document to index
     * @param {string} id - Document ID
     * @param {string} text - Text to index
     */
    add(id, text) {
        const tokens = this._tokenize(text);
        tokens.forEach(token => {
            if (!this.index.has(token)) {
                this.index.set(token, new Set());
            }
            this.index.get(token).add(id);
        });
        this.documentCount++;
    }

    /**
     * Remove document from index
     * @param {string} id - Document ID
     */
    remove(id) {
        this.index.forEach((ids, token) => {
            ids.delete(id);
            if (ids.size === 0) {
                this.index.delete(token);
            }
        });
        this.documentCount--;
    }

    /**
     * Search for documents
     * @param {string} query - Search query
     * @returns {string[]} Matching document IDs
     */
    search(query) {
        const tokens = this._tokenize(query);
        if (tokens.length === 0) return [];

        // Find documents that match all tokens (AND search)
        const resultSets = tokens.map(token => this.index.get(token) || new Set());
        
        if (resultSets.length === 0) return [];

        // Intersect all sets
        const intersection = resultSets.reduce((acc, set) => {
            return new Set([...acc].filter(id => set.has(id)));
        }, resultSets[0]);

        return [...intersection];
    }

    /**
     * Tokenize text into searchable terms
     * @private
     */
    _tokenize(text) {
        if (!text) return [];
        return text
            .toLowerCase()
            .split(/[\s,.-]+/)
            .filter(token => token.length > 1);
    }

    /**
     * Clear the index
     */
    clear() {
        this.index.clear();
        this.documentCount = 0;
    }

    /**
     * Get index statistics
     */
    getStats() {
        return {
            documentCount: this.documentCount,
            termCount: this.index.size,
            avgTermsPerDoc: this.documentCount > 0 
                ? this.index.size / this.documentCount 
                : 0
        };
    }
}

// ==================== Analytics Engine ====================

const AnalyticsEngine = {
    /**
     * Calculate task statistics
     * @param {Array} tasks - Array of tasks
     * @returns {Object} Analytics data
     */
    calculateStats(tasks) {
        const total = tasks.length;
        const completed = tasks.filter(t => t.completed).length;
        const active = total - completed;
        
        // Priority distribution
        const priorityDist = {
            low: tasks.filter(t => t.priority === 'low').length,
            medium: tasks.filter(t => t.priority === 'medium').length,
            high: tasks.filter(t => t.priority === 'high').length
        };

        // Overdue tasks
        const now = Date.now();
        const overdue = tasks.filter(t => 
            !t.completed && 
            t.dueDate && 
            new Date(t.dueDate).getTime() < now
        ).length;

        // Completion rate
        const completionRate = total > 0 ? (completed / total) * 100 : 0;

        // Tasks by creation date (last 7 days)
        const dailyStats = this._calculateDailyStats(tasks);

        // Average completion time
        const avgCompletionTime = this._calculateAvgCompletionTime(tasks);

        return {
            total,
            completed,
            active,
            overdue,
            completionRate: Math.round(completionRate * 100) / 100,
            priorityDistribution: priorityDist,
            dailyStats,
            avgCompletionTime,
            calculatedAt: new Date().toISOString()
        };
    },

    /**
     * Calculate daily task creation stats
     * @private
     */
    _calculateDailyStats(tasks) {
        const days = 7;
        const stats = [];
        const now = new Date();

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);
            
            const dateStr = date.toISOString().split('T')[0];
            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);

            const created = tasks.filter(t => {
                const tDate = new Date(t.createdAt);
                return tDate >= date && tDate < nextDate;
            }).length;

            stats.push({ date: dateStr, created });
        }

        return stats;
    },

    /**
     * Calculate average time to complete tasks
     * @private
     */
    _calculateAvgCompletionTime(tasks) {
        const completedTasks = tasks.filter(t => 
            t.completed && t.createdAt && t.completedAt
        );

        if (completedTasks.length === 0) return null;

        const totalMs = completedTasks.reduce((acc, task) => {
            const created = new Date(task.createdAt).getTime();
            const completed = new Date(task.completedAt).getTime();
            return acc + (completed - created);
        }, 0);

        const avgMs = totalMs / completedTasks.length;
        const hours = Math.round(avgMs / (1000 * 60 * 60));

        return {
            milliseconds: avgMs,
            hours,
            days: Math.round(hours / 24 * 100) / 100
        };
    }
};

// ==================== ML Priority Predictor ====================

const PriorityPredictor = {
    /**
     * Predict task priority based on content
     * Simple heuristic-based prediction
     * 
     * @param {Object} task - Task data
     * @returns {string} Predicted priority
     */
    predict(task) {
        let score = 0;

        // Keywords that suggest high priority
        const highPriorityKeywords = [
            'urgent', 'asap', 'emergency', 'critical', 'important',
            'deadline', 'today', 'now', 'immediately', 'rush'
        ];

        // Keywords that suggest low priority
        const lowPriorityKeywords = [
            'later', 'sometime', 'maybe', 'optional', 'nice to have',
            'when possible', 'convenience', 'low priority'
        ];

        const text = (task.text || '').toLowerCase();

        // Score based on keywords
        highPriorityKeywords.forEach(keyword => {
            if (text.includes(keyword)) score += 2;
        });

        lowPriorityKeywords.forEach(keyword => {
            if (text.includes(keyword)) score -= 2;
        });

        // Score based on due date proximity
        if (task.dueDate) {
            const dueDate = new Date(task.dueDate);
            const now = new Date();
            const daysUntilDue = (dueDate - now) / (1000 * 60 * 60 * 24);

            if (daysUntilDue < 0) score += 5; // Overdue
            else if (daysUntilDue < 1) score += 4; // Due today
            else if (daysUntilDue < 3) score += 2; // Due in 2-3 days
            else if (daysUntilDue > 14) score -= 1; // Due in more than 2 weeks
        }

        // Score based on text length (longer tasks might be more complex)
        if (task.text && task.text.length > 100) score += 1;

        // Determine priority
        if (score >= 3) return 'high';
        if (score <= -2) return 'low';
        return 'medium';
    },

    /**
     * Batch predict priorities
     * @param {Array} tasks - Array of tasks
     * @returns {Array} Tasks with predicted priorities
     */
    predictBatch(tasks) {
        return tasks.map(task => ({
            ...task,
            predictedPriority: this.predict(task),
            priorityScore: this._calculateScore(task)
        }));
    },

    /**
     * Calculate raw priority score
     * @private
     */
    _calculateScore(task) {
        let score = 0;
        const text = (task.text || '').toLowerCase();

        ['urgent', 'asap', 'emergency', 'critical'].forEach(k => {
            if (text.includes(k)) score += 2;
        });

        if (task.dueDate) {
            const dueDate = new Date(task.dueDate);
            const now = new Date();
            const daysUntilDue = (dueDate - now) / (1000 * 60 * 60 * 24);
            if (daysUntilDue < 1) score += 4;
            else if (daysUntilDue < 3) score += 2;
        }

        return score;
    }
};

// ==================== Message Handler ====================

const searchIndex = new SearchIndex();

self.onmessage = async function(e) {
    const { type, payload, id } = e.data;

    try {
        let result;

        switch (type) {
            case MessageType.PROCESS_BULK:
                result = await processBulk(payload.tasks, payload.operation);
                break;

            case MessageType.INDEX_SEARCH:
                searchIndex.clear();
                payload.tasks.forEach(task => {
                    searchIndex.add(task.id, task.text);
                });
                result = searchIndex.getStats();
                break;

            case MessageType.SEARCH_QUERY:
                result = searchIndex.search(payload.query);
                break;

            case MessageType.CALCULATE_ANALYTICS:
                result = AnalyticsEngine.calculateStats(payload.tasks);
                break;

            case MessageType.PREDICT_PRIORITY:
                result = PriorityPredictor.predict(payload.task);
                break;

            case MessageType.PREDICT_PRIORITY_BATCH:
                result = PriorityPredictor.predictBatch(payload.tasks);
                break;

            case MessageType.ENCRYPT_DATA:
                result = await encryptData(payload.data, payload.key);
                break;

            case MessageType.DECRYPT_DATA:
                result = await decryptData(payload.encryptedData, payload.key);
                break;

            default:
                throw new Error(`Unknown message type: ${type}`);
        }

        self.postMessage({
            type: MessageType.RESULT,
            id,
            result
        });

    } catch (error) {
        self.postMessage({
            type: MessageType.ERROR,
            id,
            error: error.message
        });
    }
};

/**
 * Process bulk operations
 * @private
 */
async function processBulk(tasks, operation) {
    const batchSize = 100;
    const results = [];

    for (let i = 0; i < tasks.length; i += batchSize) {
        const batch = tasks.slice(i, i + batchSize);
        
        // Report progress
        self.postMessage({
            type: MessageType.PROGRESS,
            progress: {
                current: i,
                total: tasks.length,
                percent: Math.round((i / tasks.length) * 100)
            }
        });

        switch (operation) {
            case 'transform':
                results.push(...batch.map(t => ({ ...t, processed: true })));
                break;
            case 'validate':
                results.push(...batch.map(t => ({ ...t, valid: validateTask(t) })));
                break;
            case 'normalize':
                results.push(...batch.map(t => normalizeTask(t)));
                break;
        }

        // Yield to main thread
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    return results;
}

/**
 * Validate a task
 * @private
 */
function validateTask(task) {
    return !!(task.id && task.text && task.priority);
}

/**
 * Normalize a task
 * @private
 */
function normalizeTask(task) {
    return {
        ...task,
        text: task.text.trim(),
        priority: ['low', 'medium', 'high'].includes(task.priority) 
            ? task.priority 
            : 'medium'
    };
}

/**
 * Simple encryption (XOR with key - for demo purposes)
 * In production, use Web Crypto API
 * @private
 */
async function encryptData(data, key) {
    const text = JSON.stringify(data);
    const encoded = new TextEncoder().encode(text);
    const keyBytes = new TextEncoder().encode(key);
    
    const encrypted = encoded.map((byte, i) => 
        byte ^ keyBytes[i % keyBytes.length]
    );
    
    return Array.from(encrypted);
}

/**
 * Simple decryption
 * @private
 */
async function decryptData(encryptedArray, key) {
    const keyBytes = new TextEncoder().encode(key);
    
    const decrypted = new Uint8Array(
        encryptedArray.map((byte, i) => 
            byte ^ keyBytes[i % keyBytes.length]
        )
    );
    
    const text = new TextDecoder().decode(decrypted);
    return JSON.parse(text);
}

// Export for potential module usage
export { MessageType, SearchIndex, AnalyticsEngine, PriorityPredictor };
