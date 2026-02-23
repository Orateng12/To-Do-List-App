/**
 * GraphQL Client Layer
 * =====================
 * Type-safe GraphQL API client with caching and optimistic updates
 * 
 * Features:
 * - Query/mutation builders
 * - Response caching
 * - Optimistic UI updates
 * - Automatic refetching
 * - Error handling with retry
 */

// ============================================
// GRAPHQL SCHEMA DEFINITIONS (Client-side)
// ============================================
const Schema = {
    types: `
        type Task {
            id: ID!
            text: String!
            priority: Priority!
            dueDate: String
            completed: Boolean!
            notes: String
            tags: [String!]
            createdAt: String!
            updatedAt: String
            completedAt: String
            category: Category
            assignee: User
            subtasks: [Subtask!]
        }
        
        type Subtask {
            id: ID!
            text: String!
            completed: Boolean!
        }
        
        type Category {
            id: ID!
            name: String!
            color: String
            parentId: ID
        }
        
        type User {
            id: ID!
            email: String!
            name: String
            avatar: String
        }
        
        enum Priority {
            low
            medium
            high
        }
        
        type TaskStats {
            total: Int!
            completed: Int!
            active: Int!
            overdue: Int!
            completionRate: Float!
            priorityDistribution: PriorityDistribution!
        }
        
        type PriorityDistribution {
            low: Int!
            medium: Int!
            high: Int!
        }
        
        type Query {
            tasks(filter: TaskFilter, sort: TaskSort): [Task!]!
            task(id: ID!): Task
            categories: [Category!]!
            stats: TaskStats!
            me: User
        }
        
        type Mutation {
            createTask(input: CreateTaskInput!): Task!
            updateTask(id: ID!, input: UpdateTaskInput!): Task!
            deleteTask(id: ID!): Boolean!
            toggleTask(id: ID!): Task!
            createCategory(input: CreateCategoryInput!): Category!
        }
        
        input TaskFilter {
            completed: Boolean
            priority: Priority
            categoryId: ID
            search: String
            dueBefore: String
            dueAfter: String
        }
        
        input TaskSort {
            field: String!
            direction: SortDirection!
        }
        
        enum SortDirection {
            asc
            desc
        }
        
        input CreateTaskInput {
            text: String!
            priority: Priority
            dueDate: String
            notes: String
            categoryId: ID
        }
        
        input UpdateTaskInput {
            text: String
            priority: Priority
            dueDate: String
            completed: Boolean
            notes: String
            categoryId: ID
        }
        
        input CreateCategoryInput {
            name: String!
            color: String
            parentId: ID
        }
    `
};

// ============================================
// GRAPHQL QUERIES & MUTATIONS
// ============================================
const Queries = {
    GetTasks: `
        query GetTasks($filter: TaskFilter, $sort: TaskSort) {
            tasks(filter: $filter, sort: $sort) {
                id text priority dueDate completed notes tags
                createdAt updatedAt
                category { id name color }
            }
        }
    `,
    
    GetTask: `
        query GetTask($id: ID!) {
            task(id: $id) {
                id text priority dueDate completed notes tags
                createdAt updatedAt completedAt
                category { id name color }
                assignee { id name avatar }
                subtasks { id text completed }
            }
        }
    `,
    
    GetStats: `
        query GetStats {
            stats {
                total completed active overdue completionRate
                priorityDistribution { low medium high }
            }
        }
    `,
    
    GetCategories: `
        query GetCategories {
            categories {
                id name color parentId
            }
        }
    `
};

const Mutations = {
    CreateTask: `
        mutation CreateTask($input: CreateTaskInput!) {
            createTask(input: $input) {
                id text priority dueDate completed createdAt
            }
        }
    `,
    
    UpdateTask: `
        mutation UpdateTask($id: ID!, $input: UpdateTaskInput!) {
            updateTask(id: $id, input: $input) {
                id text priority dueDate completed updatedAt
            }
        }
    `,
    
    DeleteTask: `
        mutation DeleteTask($id: ID!) {
            deleteTask(id: $id)
        }
    `,
    
    ToggleTask: `
        mutation ToggleTask($id: ID!) {
            toggleTask(id: $id) {
                id completed completedAt
            }
        }
    `
};

// ============================================
// GRAPHQL CLIENT
// ============================================
class GraphQLClient {
    constructor(endpoint, options = {}) {
        this.endpoint = endpoint;
        this.options = {
            cacheEnabled: true,
            defaultTimeout: 10000,
            retryAttempts: 3,
            retryDelay: 1000,
            ...options
        };
        
        this.cache = new Map();
        this.pendingRequests = new Map();
        this.optimisticUpdates = new Map();
        this.subscribers = new Map();
        
        // Headers
        this.headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
    }

    /**
     * Set authorization token
     * @param {string} token - Auth token
     */
    setToken(token) {
        this.headers.Authorization = `Bearer ${token}`;
    }

    /**
     * Execute a GraphQL query
     * @param {string} query - GraphQL query string
     * @param {Object} variables - Query variables
     * @param {Object} options - Request options
     * @returns {Promise<Object>}
     */
    async query(query, variables = {}, options = {}) {
        const cacheKey = this._generateCacheKey(query, variables);
        
        // Check cache first
        if (this.options.cacheEnabled && !options.skipCache) {
            const cached = this.cache.get(cacheKey);
            if (cached && !this._isExpired(cached)) {
                return cached.data;
            }
        }
        
        // Check for pending request (deduplication)
        if (this.pendingRequests.has(cacheKey)) {
            return this.pendingRequests.get(cacheKey);
        }
        
        const requestPromise = this._executeRequest(query, variables, options);
        this.pendingRequests.set(cacheKey, requestPromise);
        
        try {
            const result = await requestPromise;
            
            // Cache successful response
            if (this.options.cacheEnabled) {
                this.cache.set(cacheKey, {
                    data: result,
                    timestamp: Date.now()
                });
            }
            
            return result;
        } finally {
            this.pendingRequests.delete(cacheKey);
        }
    }

    /**
     * Execute a GraphQL mutation
     * @param {string} mutation - GraphQL mutation string
     * @param {Object} variables - Mutation variables
     * @param {Object} options - Request options
     * @returns {Promise<Object>}
     */
    async mutate(mutation, variables = {}, options = {}) {
        // Optimistic update
        if (options.optimisticResponse) {
            this._applyOptimisticUpdate(options.optimisticResponse, options.cacheKey);
        }
        
        try {
            const result = await this._executeRequest(mutation, variables, options);
            
            // Clear optimistic update
            if (options.cacheKey) {
                this._clearOptimisticUpdate(options.cacheKey);
            }
            
            // Invalidate related cache entries
            if (options.invalidateCache) {
                this._invalidateCache(options.invalidateCache);
            }
            
            return result;
        } catch (error) {
            // Rollback optimistic update
            if (options.cacheKey) {
                this._rollbackOptimisticUpdate(options.cacheKey);
            }
            throw error;
        }
    }

    /**
     * Execute HTTP request
     * @private
     * @param {string} query - GraphQL query/mutation
     * @param {Object} variables - Variables
     * @param {Object} options - Request options
     * @returns {Promise<Object>}
     */
    async _executeRequest(query, variables, options = {}) {
        const body = JSON.stringify({ query, variables });
        
        let lastError;
        
        for (let attempt = 0; attempt < this.options.retryAttempts; attempt++) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), options.timeout || this.options.defaultTimeout);
                
                const response = await fetch(this.endpoint, {
                    method: 'POST',
                    headers: this.headers,
                    body,
                    signal: controller.signal
                });
                
                clearTimeout(timeout);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const result = await response.json();
                
                if (result.errors) {
                    throw new GraphQLError(result.errors);
                }
                
                return result.data;
                
            } catch (error) {
                lastError = error;
                
                if (error.name === 'AbortError') {
                    throw new Error('Request timeout');
                }
                
                // Don't retry on GraphQL errors
                if (error instanceof GraphQLError) {
                    throw error;
                }
                
                // Wait before retry
                await new Promise(resolve => 
                    setTimeout(resolve, this.options.retryDelay * (attempt + 1))
                );
            }
        }
        
        throw lastError;
    }

    /**
     * Subscribe to query updates
     * @param {string} query - GraphQL query
     * @param {Object} variables - Query variables
     * @param {Function} callback - Update callback
     * @returns {Function} Unsubscribe function
     */
    subscribe(query, variables, callback) {
        const cacheKey = this._generateCacheKey(query, variables);
        
        if (!this.subscribers.has(cacheKey)) {
            this.subscribers.set(cacheKey, new Set());
        }
        
        this.subscribers.get(cacheKey).add(callback);
        
        // Return cached data immediately if available
        const cached = this.cache.get(cacheKey);
        if (cached) {
            callback(cached.data);
        }
        
        return () => {
            this.subscribers.get(cacheKey)?.delete(callback);
        };
    }

    /**
     * Notify subscribers of update
     * @private
     * @param {string} cacheKey - Cache key
     * @param {Object} data - New data
     */
    _notifySubscribers(cacheKey, data) {
        this.subscribers.get(cacheKey)?.forEach(callback => {
            try {
                callback(data);
            } catch (e) {
                console.error('[GraphQL] Subscriber error:', e);
            }
        });
    }

    /**
     * Apply optimistic update
     * @private
     * @param {Object} response - Optimistic response
     * @param {string} cacheKey - Cache key
     */
    _applyOptimisticUpdate(response, cacheKey) {
        if (!cacheKey || !this.options.cacheEnabled) return;
        
        const cached = this.cache.get(cacheKey);
        if (cached) {
            this.optimisticUpdates.set(cacheKey, {
                original: cached.data,
                optimistic: response
            });
            
            cached.data = response;
            this._notifySubscribers(cacheKey, response);
        }
    }

    /**
     * Clear optimistic update
     * @private
     * @param {string} cacheKey - Cache key
     */
    _clearOptimisticUpdate(cacheKey) {
        this.optimisticUpdates.delete(cacheKey);
    }

    /**
     * Rollback optimistic update
     * @private
     * @param {string} cacheKey - Cache key
     */
    _rollbackOptimisticUpdate(cacheKey) {
        const update = this.optimisticUpdates.get(cacheKey);
        if (update && this.cache.has(cacheKey)) {
            this.cache.get(cacheKey).data = update.original;
            this._notifySubscribers(cacheKey, update.original);
        }
        this.optimisticUpdates.delete(cacheKey);
    }

    /**
     * Invalidate cache entries
     * @private
     * @param {string|string[]} patterns - Cache key patterns to invalidate
     */
    _invalidateCache(patterns) {
        const patternList = Array.isArray(patterns) ? patterns : [patterns];
        
        for (const [key] of this.cache) {
            if (patternList.some(pattern => key.includes(pattern))) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Check if cached entry is expired
     * @private
     * @param {Object} entry - Cache entry
     * @returns {boolean}
     */
    _isExpired(entry) {
        const maxAge = 5 * 60 * 1000; // 5 minutes default
        return Date.now() - entry.timestamp > maxAge;
    }

    /**
     * Generate cache key
     * @private
     * @param {string} query - Query string
     * @param {Object} variables - Variables
     * @returns {string}
     */
    _generateCacheKey(query, variables) {
        return `${query}:${JSON.stringify(variables)}`;
    }

    /**
     * Clear entire cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     * @returns {Object}
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            pendingRequests: this.pendingRequests.size,
            optimisticUpdates: this.optimisticUpdates.size,
            subscribers: this.subscribers.size
        };
    }
}

// ============================================
// GRAPHQL ERROR
// ============================================
class GraphQLError extends Error {
    constructor(errors) {
        super(errors.map(e => e.message).join(', '));
        this.name = 'GraphQLError';
        this.errors = errors;
    }
}

// ============================================
// TASK API (High-level wrapper)
// ============================================
class TaskAPI {
    constructor(client) {
        this.client = client;
    }

    /**
     * Get all tasks
     * @param {Object} filter - Filter options
     * @param {Object} sort - Sort options
     * @returns {Promise<Array>}
     */
    async getTasks(filter = {}, sort = { field: 'createdAt', direction: 'desc' }) {
        const result = await this.client.query(Queries.GetTasks, { filter, sort });
        return result.tasks || [];
    }

    /**
     * Get single task
     * @param {string} id - Task ID
     * @returns {Promise<Object>}
     */
    async getTask(id) {
        const result = await this.client.query(Queries.GetTask, { id });
        return result.task;
    }

    /**
     * Create task
     * @param {Object} input - Task input
     * @returns {Promise<Object>}
     */
    async createTask(input) {
        return this.client.mutate(Mutations.CreateTask, { input }, {
            invalidateCache: ['tasks']
        });
    }

    /**
     * Update task
     * @param {string} id - Task ID
     * @param {Object} input - Update input
     * @returns {Promise<Object>}
     */
    async updateTask(id, input) {
        return this.client.mutate(Mutations.UpdateTask, { id, input }, {
            invalidateCache: [`task:${id}`]
        });
    }

    /**
     * Delete task
     * @param {string} id - Task ID
     * @returns {Promise<boolean>}
     */
    async deleteTask(id) {
        return this.client.mutate(Mutations.DeleteTask, { id }, {
            invalidateCache: ['tasks', `task:${id}`]
        });
    }

    /**
     * Toggle task completion
     * @param {string} id - Task ID
     * @returns {Promise<Object>}
     */
    async toggleTask(id) {
        return this.client.mutate(Mutations.ToggleTask, { id }, {
            invalidateCache: [`task:${id}`]
        });
    }

    /**
     * Get statistics
     * @returns {Promise<Object>}
     */
    async getStats() {
        return this.client.query(Queries.GetStats);
    }
}

// Export
export { GraphQLClient, TaskAPI, Queries, Mutations, Schema, GraphQLError };
