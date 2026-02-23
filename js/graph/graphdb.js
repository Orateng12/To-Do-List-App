/**
 * Graph Database for Task Relationships
 * =======================================
 * Property graph model with Cypher-like query language
 */

import { eventBus, EVENTS } from '../core/event-bus.js';

/**
 * Graph Node
 */
export class Node {
    constructor(id, labels = [], properties = {}) {
        this.id = id;
        this.labels = labels;
        this.properties = properties;
        this.inEdges = [];
        this.outEdges = [];
    }

    /**
     * Add label
     */
    addLabel(label) {
        if (!this.labels.includes(label)) {
            this.labels.push(label);
        }
    }

    /**
     * Remove label
     */
    removeLabel(label) {
        this.labels = this.labels.filter(l => l !== label);
    }

    /**
     * Has label
     */
    hasLabel(label) {
        return this.labels.includes(label);
    }

    /**
     * Set property
     */
    setProperty(key, value) {
        this.properties[key] = value;
    }

    /**
     * Get property
     */
    getProperty(key, defaultValue = null) {
        return this.properties[key] !== undefined ? this.properties[key] : defaultValue;
    }

    /**
     * Delete property
     */
    deleteProperty(key) {
        delete this.properties[key];
    }

    /**
     * Get all properties
     */
    getProperties() {
        return { ...this.properties };
    }

    /**
     * Serialize node
     */
    toJSON() {
        return {
            id: this.id,
            labels: this.labels,
            properties: this.properties
        };
    }

    /**
     * Deserialize node
     */
    static fromJSON(json) {
        return new Node(json.id, json.labels, json.properties);
    }
}

/**
 * Graph Edge (Relationship)
 */
export class Edge {
    constructor(id, fromNode, toNode, type, properties = {}) {
        this.id = id;
        this.fromNode = fromNode;
        this.toNode = toNode;
        this.type = type;
        this.properties = properties;
    }

    /**
     * Set property
     */
    setProperty(key, value) {
        this.properties[key] = value;
    }

    /**
     * Get property
     */
    getProperty(key, defaultValue = null) {
        return this.properties[key] !== undefined ? this.properties[key] : defaultValue;
    }

    /**
     * Serialize edge
     */
    toJSON() {
        return {
            id: this.id,
            fromNode: this.fromNode.id,
            toNode: this.toNode.id,
            type: this.type,
            properties: this.properties
        };
    }

    /**
     * Deserialize edge
     */
    static fromJSON(json, nodes) {
        const fromNode = nodes.get(json.fromNode);
        const toNode = nodes.get(json.toNode);
        return new Edge(json.id, fromNode, toNode, json.type, json.properties);
    }
}

/**
 * Graph Database
 */
export class GraphDB {
    constructor() {
        this.nodes = new Map();
        this.edges = new Map();
        this.nodeIndex = new Map(); // label -> Set(nodeId)
        this.edgeIndex = new Map(); // type -> Set(edgeId)
        this.edgeCount = 0;
    }

    /**
     * Create node
     */
    createNode(id, labels = [], properties = {}) {
        const node = new Node(id, labels, properties);
        this.nodes.set(id, node);

        // Index by labels
        labels.forEach(label => {
            if (!this.nodeIndex.has(label)) {
                this.nodeIndex.set(label, new Set());
            }
            this.nodeIndex.get(label).add(id);
        });

        return node;
    }

    /**
     * Get node
     */
    getNode(id) {
        return this.nodes.get(id);
    }

    /**
     * Delete node
     */
    deleteNode(id) {
        const node = this.nodes.get(id);
        if (!node) return false;

        // Remove edges
        [...node.inEdges, ...node.outEdges].forEach(edge => {
            this.deleteEdge(edge.id);
        });

        // Remove from index
        node.labels.forEach(label => {
            const indexSet = this.nodeIndex.get(label);
            if (indexSet) {
                indexSet.delete(id);
            }
        });

        this.nodes.delete(id);
        return true;
    }

    /**
     * Find nodes by label
     */
    findByLabel(label) {
        const nodeIds = this.nodeIndex.get(label);
        if (!nodeIds) return [];
        return Array.from(nodeIds).map(id => this.nodes.get(id));
    }

    /**
     * Find nodes by property
     */
    findByProperty(key, value) {
        const results = [];
        for (const node of this.nodes.values()) {
            if (node.properties[key] === value) {
                results.push(node);
            }
        }
        return results;
    }

    /**
     * Create relationship
     */
    createEdge(fromNodeId, toNodeId, type, properties = {}) {
        const fromNode = this.nodes.get(fromNodeId);
        const toNode = this.nodes.get(toNodeId);

        if (!fromNode || !toNode) {
            throw new Error('Invalid node IDs');
        }

        const id = `edge_${this.edgeCount++}`;
        const edge = new Edge(id, fromNode, toNode, type, properties);

        this.edges.set(id, edge);
        fromNode.outEdges.push(edge);
        toNode.inEdges.push(edge);

        // Index by type
        if (!this.edgeIndex.has(type)) {
            this.edgeIndex.set(type, new Set());
        }
        this.edgeIndex.get(type).add(id);

        return edge;
    }

    /**
     * Get edge
     */
    getEdge(id) {
        return this.edges.get(id);
    }

    /**
     * Delete edge
     */
    deleteEdge(id) {
        const edge = this.edges.get(id);
        if (!edge) return false;

        // Remove from node edge lists
        edge.fromNode.outEdges = edge.fromNode.outEdges.filter(e => e.id !== id);
        edge.toNode.inEdges = edge.toNode.inEdges.filter(e => e.id !== id);

        // Remove from index
        const indexSet = this.edgeIndex.get(edge.type);
        if (indexSet) {
            indexSet.delete(id);
        }

        this.edges.delete(id);
        return true;
    }

    /**
     * Find edges by type
     */
    findByType(type) {
        const edgeIds = this.edgeIndex.get(type);
        if (!edgeIds) return [];
        return Array.from(edgeIds).map(id => this.edges.get(id));
    }

    /**
     * Get outgoing edges
     */
    getOutgoing(nodeId, type = null) {
        const node = this.nodes.get(nodeId);
        if (!node) return [];

        let edges = [...node.outEdges];
        if (type) {
            edges = edges.filter(e => e.type === type);
        }
        return edges;
    }

    /**
     * Get incoming edges
     */
    getIncoming(nodeId, type = null) {
        const node = this.nodes.get(nodeId);
        if (!node) return [];

        let edges = [...node.inEdges];
        if (type) {
            edges = edges.filter(e => e.type === type);
        }
        return edges;
    }

    /**
     * Get neighbors (connected nodes)
     */
    getNeighbors(nodeId, direction = 'both', type = null) {
        const node = this.nodes.get(nodeId);
        if (!node) return [];

        const neighbors = new Map();

        if (direction === 'out' || direction === 'both') {
            this.getOutgoing(nodeId, type).forEach(edge => {
                neighbors.set(edge.toNode.id, edge.toNode);
            });
        }

        if (direction === 'in' || direction === 'both') {
            this.getIncoming(nodeId, type).forEach(edge => {
                neighbors.set(edge.fromNode.id, edge.fromNode);
            });
        }

        return Array.from(neighbors.values());
    }

    /**
     * Find path between nodes (BFS)
     */
    findPath(fromNodeId, toNodeId, maxDepth = 10) {
        const queue = [[fromNodeId]];
        const visited = new Set([fromNodeId]);

        while (queue.length > 0 && visited.size < maxDepth) {
            const path = queue.shift();
            const currentId = path[path.length - 1];

            if (currentId === toNodeId) {
                return path.map(id => this.nodes.get(id));
            }

            const neighbors = this.getNeighbors(currentId);
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor.id)) {
                    visited.add(neighbor.id);
                    queue.push([...path, neighbor.id]);
                }
            }
        }

        return null; // No path found
    }

    /**
     * Run Cypher-like query
     */
    query(cypher) {
        const parser = new GraphQueryParser(this);
        return parser.parse(cypher);
    }

    /**
     * Get graph statistics
     */
    getStats() {
        const labelCounts = {};
        const typeCounts = {};

        this.nodeIndex.forEach((set, label) => {
            labelCounts[label] = set.size;
        });

        this.edgeIndex.forEach((set, type) => {
            typeCounts[type] = set.size;
        });

        return {
            nodeCount: this.nodes.size,
            edgeCount: this.edges.size,
            labelCounts,
            typeCounts,
            avgDegree: this.nodes.size > 0 
                ? (2 * this.edges.size / this.nodes.size).toFixed(2) 
                : 0
        };
    }

    /**
     * Export graph
     */
    export() {
        return {
            nodes: Array.from(this.nodes.values()).map(n => n.toJSON()),
            edges: Array.from(this.edges.values()).map(e => e.toJSON())
        };
    }

    /**
     * Import graph
     */
    import(data) {
        // Import nodes first
        data.nodes.forEach(nodeJson => {
            const node = Node.fromJSON(nodeJson);
            this.nodes.set(node.id, node);
            
            // Rebuild index
            node.labels.forEach(label => {
                if (!this.nodeIndex.has(label)) {
                    this.nodeIndex.set(label, new Set());
                }
                this.nodeIndex.get(label).add(node.id);
            });
        });

        // Import edges
        data.edges.forEach(edgeJson => {
            const edge = Edge.fromJSON(edgeJson, this.nodes);
            this.edges.set(edge.id, edge);
            
            // Rebuild node edge references
            edge.fromNode.outEdges.push(edge);
            edge.toNode.inEdges.push(edge);

            // Rebuild index
            if (!this.edgeIndex.has(edge.type)) {
                this.edgeIndex.set(edge.type, new Set());
            }
            this.edgeIndex.get(edge.type).add(edge.id);
        });
    }
}

/**
 * Graph Query Parser (Cypher-like)
 */
export class GraphQueryParser {
    constructor(graph) {
        this.graph = graph;
    }

    /**
     * Parse and execute query
     */
    parse(cypher) {
        // Simple parser for basic patterns
        // MATCH (n:Label)-[r:TYPE]->(m:Label) WHERE n.prop = value RETURN n, m

        const match = cypher.match(/MATCH\s+(.+?)(?:\s+WHERE\s+(.+?))?(?:\s+RETURN\s+(.+))?/i);
        if (!match) {
            return { error: 'Invalid query syntax' };
        }

        const [, pattern, whereClause, returnClause] = match;
        
        // Parse pattern
        const nodes = this.parsePattern(pattern);
        
        // Execute query
        let results = this.executeMatch(nodes);
        
        // Apply WHERE clause
        if (whereClause) {
            results = this.applyWhere(results, whereClause);
        }

        // Apply RETURN
        if (returnClause) {
            results = this.applyReturn(results, returnClause);
        }

        return { results, count: results.length };
    }

    /**
     * Parse MATCH pattern
     */
    parsePattern(pattern) {
        const nodes = [];
        const nodeRegex = /\((\w+)(?::(\w+))?\)/g;
        let match;

        while ((match = nodeRegex.exec(pattern)) !== null) {
            nodes.push({
                variable: match[1],
                label: match[2] || null
            });
        }

        return nodes;
    }

    /**
     * Execute MATCH
     */
    executeMatch(nodes) {
        if (nodes.length === 0) return [];

        const results = [];
        const firstNode = nodes[0];

        // Get starting nodes
        let startingNodes;
        if (firstNode.label) {
            startingNodes = this.graph.findByLabel(firstNode.label);
        } else {
            startingNodes = Array.from(this.graph.nodes.values());
        }

        // Build result objects
        startingNodes.forEach(node => {
            const result = {};
            result[firstNode.variable] = node;
            results.push(result);
        });

        return results;
    }

    /**
     * Apply WHERE clause
     */
    applyWhere(results, whereClause) {
        // Simple property comparison
        const propMatch = whereClause.match(/(\w+)\.(\w+)\s*=\s*['"]([^'"]+)['"]/);
        if (!propMatch) return results;

        const [, variable, property, value] = propMatch;

        return results.filter(result => {
            const node = result[variable];
            return node && node.getProperty(property) === value;
        });
    }

    /**
     * Apply RETURN clause
     */
    applyReturn(results, returnClause) {
        const variables = returnClause.split(',').map(v => v.trim());
        
        return results.map(result => {
            const filtered = {};
            variables.forEach(v => {
                if (result[v]) {
                    filtered[v] = result[v].toJSON();
                }
            });
            return filtered;
        });
    }
}

/**
 * Task Graph - Specialized graph for task relationships
 */
export class TaskGraph {
    constructor() {
        this.graph = new GraphDB();
        this.setupEventListeners();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        eventBus.on(EVENTS.TASK_ADDED, (data) => {
            this.addTaskNode(data.task);
        });

        eventBus.on(EVENTS.TASK_UPDATED, (data) => {
            this.updateTaskNode(data.task);
        });

        eventBus.on(EVENTS.TASK_DELETED, (data) => {
            this.removeTaskNode(data.id || data.task?.id);
        });
    }

    /**
     * Add task node
     */
    addTaskNode(task) {
        const labels = ['Task'];
        if (task.priority === 'high') labels.push('HighPriority');
        if (task.completed) labels.push('Completed');
        
        this.graph.createNode(task.id, labels, {
            text: task.text,
            priority: task.priority,
            dueDate: task.dueDate,
            completed: task.completed,
            createdAt: task.createdAt
        });

        // Link to categories
        (task.categories || []).forEach(category => {
            let categoryNode = this.graph.findByLabel('Category')
                .find(n => n.getProperty('name') === category);
            
            if (!categoryNode) {
                categoryNode = this.graph.createNode(
                    `cat_${category}`,
                    ['Category'],
                    { name: category }
                );
            }
            
            this.graph.createEdge(task.id, categoryNode.id, 'BELONGS_TO');
        });
    }

    /**
     * Update task node
     */
    updateTaskNode(task) {
        const node = this.graph.getNode(task.id);
        if (!node) return;

        node.setProperty('text', task.text);
        node.setProperty('priority', task.priority);
        node.setProperty('dueDate', task.dueDate);
        node.setProperty('completed', task.completed);

        // Update labels
        if (task.priority === 'high') {
            node.addLabel('HighPriority');
        }
        if (task.completed) {
            node.addLabel('Completed');
        }
    }

    /**
     * Remove task node
     */
    removeTaskNode(taskId) {
        this.graph.deleteNode(taskId);
    }

    /**
     * Create dependency between tasks
     */
    createDependency(fromTaskId, toTaskId, type = 'BLOCKS') {
        this.graph.createEdge(fromTaskId, toTaskId, type);
    }

    /**
     * Get task dependencies
     */
    getDependencies(taskId) {
        return this.graph.getNeighbors(taskId, 'both');
    }

    /**
     * Find related tasks
     */
    findRelatedTasks(taskId) {
        const task = this.graph.getNode(taskId);
        if (!task) return [];

        // Find tasks with same category
        const categories = this.graph.getNeighbors(taskId, 'out', 'BELONGS_TO');
        const related = new Set();

        categories.forEach(cat => {
            const tasks = this.graph.getNeighbors(cat.id, 'in', 'BELONGS_TO');
            tasks.forEach(t => {
                if (t.id !== taskId) {
                    related.add(t);
                }
            });
        });

        return Array.from(related);
    }

    /**
     * Get task graph
     */
    getGraph() {
        return this.graph;
    }

    /**
     * Query graph
     */
    query(cypher) {
        return this.graph.query(cypher);
    }

    /**
     * Get recommendations
     */
    getRecommendations(taskId) {
        const related = this.findRelatedTasks(taskId);
        
        // Score by similarity
        const task = this.graph.getNode(taskId);
        const scored = related.map(t => {
            let score = 0;
            
            // Same priority
            if (t.getProperty('priority') === task.getProperty('priority')) {
                score += 2;
            }
            
            // Same category
            const taskCats = this.graph.getNeighbors(taskId, 'out', 'BELONGS_TO');
            const tCats = this.graph.getNeighbors(t.id, 'out', 'BELONGS_TO');
            score += taskCats.filter(c => tCats.some(tc => tc.id === c.id)).length;
            
            return { task: t, score };
        });

        return scored
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map(r => r.task.toJSON());
    }
}

/**
 * Create task graph
 */
export function createTaskGraph() {
    return new TaskGraph();
}
