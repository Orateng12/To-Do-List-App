/**
 * Graph Database - Task Relationship Management
 * ==============================================
 * Property graph model for complex task dependencies and relationships
 */

import type { Task, TaskId } from '../types';

// ============================================
// GRAPH DATA TYPES
// ============================================

export type NodeType = 'task' | 'category' | 'tag' | 'user' | 'project';

export interface GraphNode {
  id: string;
  type: NodeType;
  labels: string[];
  properties: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type RelationshipType =
  | 'DEPENDS_ON'
  | 'BLOCKS'
  | 'RELATED_TO'
  | 'SIMILAR_TO'
  | 'PART_OF'
  | 'SUBTASK_OF'
  | 'ASSIGNED_TO'
  | 'TAGGED_WITH'
  | 'FOLLOWS'
  | 'CONFLICTS_WITH'
  | 'DUPLICATE_OF';

export interface GraphRelationship {
  id: string;
  type: RelationshipType;
  fromNode: string;
  toNode: string;
  properties: Record<string, unknown>;
  createdAt: Date;
}

export interface GraphPath {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
  length: number;
}

export interface GraphQuery {
  startNode?: string;
  endNode?: string;
  nodeType?: NodeType;
  relationshipType?: RelationshipType;
  maxDepth?: number;
  where?: (node: GraphNode) => boolean;
}

// ============================================
// GRAPH INDEX
// ============================================

class GraphIndex {
  private nodes: Map<string, GraphNode> = new Map();
  private relationships: Map<string, GraphRelationship> = new Map();
  private nodeByType: Map<NodeType, Set<string>> = new Map();
  private adjacencyList: Map<string, Map<string, string[]>> = new Map();

  /**
   * Create node
   */
  createNode(id: string, type: NodeType, labels: string[], properties: Record<string, unknown>): GraphNode {
    const now = new Date();
    const node: GraphNode = {
      id,
      type,
      labels,
      properties,
      createdAt: now,
      updatedAt: now
    };

    this.nodes.set(id, node);

    // Index by type
    if (!this.nodeByType.has(type)) {
      this.nodeByType.set(type, new Set());
    }
    this.nodeByType.get(type)!.add(id);

    // Initialize adjacency list
    if (!this.adjacencyList.has(id)) {
      this.adjacencyList.set(id, new Map());
    }

    return node;
  }

  /**
   * Get node by ID
   */
  getNode(id: string): GraphNode | null {
    return this.nodes.get(id) || null;
  }

  /**
   * Update node
   */
  updateNode(id: string, properties: Record<string, unknown>): GraphNode | null {
    const node = this.nodes.get(id);
    if (!node) return null;

    node.properties = { ...node.properties, ...properties };
    node.updatedAt = new Date();

    return node;
  }

  /**
   * Delete node
   */
  deleteNode(id: string): boolean {
    const node = this.nodes.get(id);
    if (!node) return false;

    // Remove all relationships
    for (const [relId, rel] of this.relationships.entries()) {
      if (rel.fromNode === id || rel.toNode === id) {
        this.relationships.delete(relId);
      }
    }

    // Remove from adjacency lists
    this.adjacencyList.delete(id);
    for (const adj of this.adjacencyList.values()) {
      adj.delete(id);
    }

    // Remove from type index
    const typeSet = this.nodeByType.get(node.type);
    if (typeSet) {
      typeSet.delete(id);
    }

    return this.nodes.delete(id);
  }

  /**
   * Create relationship
   */
  createRelationship(
    id: string,
    type: RelationshipType,
    fromNode: string,
    toNode: string,
    properties: Record<string, unknown> = {}
  ): GraphRelationship | null {
    // Verify nodes exist
    if (!this.nodes.has(fromNode) || !this.nodes.has(toNode)) {
      return null;
    }

    const now = new Date();
    const relationship: GraphRelationship = {
      id,
      type,
      fromNode,
      toNode,
      properties,
      createdAt: now
    };

    this.relationships.set(id, relationship);

    // Update adjacency list
    const fromAdj = this.adjacencyList.get(fromNode)!;
    if (!fromAdj.has(toNode)) {
      fromAdj.set(toNode, []);
    }
    fromAdj.get(toNode)!.push(type);

    return relationship;
  }

  /**
   * Get relationships for node
   */
  getRelationships(nodeId: string, direction: 'out' | 'in' | 'both' = 'out'): GraphRelationship[] {
    const result: GraphRelationship[] = [];

    for (const rel of this.relationships.values()) {
      if (direction === 'out' && rel.fromNode === nodeId) {
        result.push(rel);
      } else if (direction === 'in' && rel.toNode === nodeId) {
        result.push(rel);
      } else if (direction === 'both' && (rel.fromNode === nodeId || rel.toNode === nodeId)) {
        result.push(rel);
      }
    }

    return result;
  }

  /**
   * Get connected nodes
   */
  getConnectedNodes(
    nodeId: string,
    direction: 'out' | 'in' | 'both' = 'out',
    relationshipType?: RelationshipType
  ): GraphNode[] {
    const relationships = this.getRelationships(nodeId, direction);
    const nodes: GraphNode[] = [];

    for (const rel of relationships) {
      if (relationshipType && rel.type !== relationshipType) continue;

      const connectedId = rel.fromNode === nodeId ? rel.toNode : rel.fromNode;
      const node = this.nodes.get(connectedId);
      if (node && !nodes.find(n => n.id === connectedId)) {
        nodes.push(node);
      }
    }

    return nodes;
  }

  /**
   * Find path between nodes (BFS)
   */
  findPath(startId: string, endId: string, maxDepth: number = 10): GraphPath | null {
    if (startId === endId) {
      const node = this.nodes.get(startId);
      if (node) {
        return { nodes: [node], relationships: [], length: 0 };
      }
      return null;
    }

    const queue: Array<{ nodeId: string; path: string[]; rels: string[] }> = [
      { nodeId: startId, path: [startId], rels: [] }
    ];
    const visited = new Set<string>([startId]);

    while (queue.length > 0 && queue[0].path.length <= maxDepth) {
      const { nodeId, path, rels } = queue.shift()!;

      const adj = this.adjacencyList.get(nodeId);
      if (!adj) continue;

      for (const [neighborId, relTypes] of adj.entries()) {
        if (visited.has(neighborId)) continue;

        const newPath = [...path, neighborId];
        const newRels = [...rels, relTypes[0]];

        if (neighborId === endId) {
          const nodes = newPath.map(id => this.nodes.get(id)!).filter(Boolean);
          const relationships = newRels.map((type, i) => {
            const relArray = Array.from(this.relationships.values());
            const found = relArray.find(
              r => r.fromNode === path[i] && r.toNode === newPath[i + 1] && r.type === type
            );
            return found || null;
          }).filter(Boolean);

          return { nodes, relationships, length: nodes.length - 1 };
        }

        visited.add(neighborId);
        queue.push({ nodeId: neighborId, path: newPath, rels: newRels });
      }
    }

    return null;
  }

  /**
   * Query graph
   */
  query(graphQuery: GraphQuery): GraphNode[] {
    let results: GraphNode[] = [];

    // Start from specific node
    if (graphQuery.startNode) {
      const start = this.nodes.get(graphQuery.startNode);
      if (!start) return [];

      const connected = this.getConnectedNodes(
        graphQuery.startNode,
        'both',
        graphQuery.relationshipType
      );

      if (graphQuery.endNode) {
        // Find path to end node
        const path = this.findPath(graphQuery.startNode, graphQuery.endNode, graphQuery.maxDepth || 10);
        if (path) {
          results = path.nodes;
        }
      } else {
        results = [start, ...connected];
      }
    } else {
      // Query all nodes of type
      const typeSet = graphQuery.nodeType ? this.nodeByType.get(graphQuery.nodeType) : new Set(this.nodes.keys());
      if (typeSet) {
        results = Array.from(typeSet).map(id => this.nodes.get(id)!).filter(Boolean);
      }
    }

    // Apply filter
    if (graphQuery.where) {
      results = results.filter(graphQuery.where);
    }

    return results;
  }

  /**
   * Get all nodes of type
   */
  getNodesByType(type: NodeType): GraphNode[] {
    const typeSet = this.nodeByType.get(type);
    if (!typeSet) return [];
    return Array.from(typeSet).map(id => this.nodes.get(id)!).filter(Boolean);
  }

  /**
   * Get graph statistics
   */
  getStats(): {
    nodeCount: number;
    relationshipCount: number;
    nodesByType: Record<NodeType, number>;
    relationshipsByType: Record<RelationshipType, number>;
  } {
    const nodesByType: Record<NodeType, number> = {
      task: 0,
      category: 0,
      tag: 0,
      user: 0,
      project: 0
    };

    for (const [type, set] of this.nodeByType.entries()) {
      nodesByType[type] = set.size;
    }

    const relationshipsByType: Record<RelationshipType, number> = {} as Record<RelationshipType, number>;
    for (const rel of this.relationships.values()) {
      relationshipsByType[rel.type] = (relationshipsByType[rel.type] || 0) + 1;
    }

    return {
      nodeCount: this.nodes.size,
      relationshipCount: this.relationships.size,
      nodesByType,
      relationshipsByType
    };
  }

  /**
   * Export graph
   */
  export(): string {
    return JSON.stringify({
      nodes: Array.from(this.nodes.values()).map(n => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
        updatedAt: n.updatedAt.toISOString()
      })),
      relationships: Array.from(this.relationships.values()).map(r => ({
        ...r,
        createdAt: r.createdAt.toISOString()
      }))
    });
  }

  /**
   * Import graph
   */
  import(json: string): void {
    const data = JSON.parse(json);

    for (const nodeData of data.nodes) {
      this.nodes.set(nodeData.id, {
        ...nodeData,
        createdAt: new Date(nodeData.createdAt),
        updatedAt: new Date(nodeData.updatedAt)
      });

      if (!this.nodeByType.has(nodeData.type)) {
        this.nodeByType.set(nodeData.type, new Set());
      }
      this.nodeByType.get(nodeData.type)!.add(nodeData.id);

      if (!this.adjacencyList.has(nodeData.id)) {
        this.adjacencyList.set(nodeData.id, new Map());
      }
    }

    for (const relData of data.relationships) {
      this.relationships.set(relData.id, {
        ...relData,
        createdAt: new Date(relData.createdAt)
      });

      // Rebuild adjacency list
      const fromAdj = this.adjacencyList.get(relData.fromNode)!;
      if (!fromAdj.has(relData.toNode)) {
        fromAdj.set(relData.toNode, []);
      }
      fromAdj.get(relData.toNode)!.push(relData.type);
    }
  }
}

// ============================================
// TASK GRAPH MANAGER
// ============================================

export class TaskGraphManager {
  private index: GraphIndex;

  constructor() {
    this.index = new GraphIndex();
  }

  /**
   * Add task to graph
   */
  addTask(task: Task): GraphNode {
    return this.index.createNode(task.id, 'task', ['Task'], {
      text: task.text,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      createdAt: task.createdAt,
      completedAt: task.completedAt
    });
  }

  /**
   * Update task in graph
   */
  updateTask(task: Task): GraphNode | null {
    return this.index.updateNode(task.id, {
      text: task.text,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      completedAt: task.completedAt
    });
  }

  /**
   * Remove task from graph
   */
  removeTask(taskId: TaskId): boolean {
    return this.index.deleteNode(taskId);
  }

  /**
   * Create dependency relationship
   */
  addDependency(fromTask: TaskId, toTask: TaskId, type: 'blocks' | 'depends' | 'related'): void {
    const relType: RelationshipType =
      type === 'blocks' ? 'BLOCKS' :
      type === 'depends' ? 'DEPENDS_ON' : 'RELATED_TO';

    const relId = `rel_${fromTask}_${toTask}_${relType}`;
    this.index.createRelationship(relId, relType, fromTask, toTask);
  }

  /**
   * Get task dependencies
   */
  getDependencies(taskId: TaskId): {
    blocking: GraphNode[];
    blockedBy: GraphNode[];
    related: GraphNode[];
  } {
    const blocking = this.index.getConnectedNodes(taskId, 'out', 'BLOCKS');
    const blockedBy = this.index.getConnectedNodes(taskId, 'in', 'BLOCKS');
    const related = this.index.getConnectedNodes(taskId, 'both', 'RELATED_TO');

    return { blocking, blockedBy, related };
  }

  /**
   * Find dependency chain
   */
  findDependencyChain(taskId: TaskId, maxDepth: number = 10): GraphPath | null {
    // Find all tasks this task depends on (directly or indirectly)
    const allDependencies = new Set<TaskId>();
    const queue: TaskId[] = [taskId];

    while (queue.length > 0 && allDependencies.size < maxDepth) {
      const current = queue.shift()!;
      const deps = this.index.getConnectedNodes(current, 'in', 'DEPENDS_ON');

      for (const dep of deps) {
        if (!allDependencies.has(dep.id)) {
          allDependencies.add(dep.id);
          queue.push(dep.id);
        }
      }
    }

    // Build path
    const nodes = Array.from(allDependencies).map(id => this.index.getNode(id)).filter(Boolean) as GraphNode[];
    return {
      nodes: [this.index.getNode(taskId)!, ...nodes],
      relationships: [],
      length: nodes.length
    };
  }

  /**
   * Detect circular dependencies
   */
  detectCircularDependencies(): Array<{ cycle: string[]; taskId: TaskId }> {
    const cycles: Array<{ cycle: string[]; taskId: TaskId }> = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string, path: string[]): void => {
      if (recursionStack.has(nodeId)) {
        // Found cycle
        const cycleStart = path.indexOf(nodeId);
        const cycle = path.slice(cycleStart);
        cycles.push({ cycle, taskId: nodeId as TaskId });
        return;
      }

      if (visited.has(nodeId)) return;

      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const deps = this.index.getConnectedNodes(nodeId, 'in', 'DEPENDS_ON');
      for (const dep of deps) {
        dfs(dep.id, [...path]);
      }

      recursionStack.delete(nodeId);
    };

    for (const node of this.index.getNodesByType('task')) {
      if (!visited.has(node.id)) {
        dfs(node.id, []);
      }
    }

    return cycles;
  }

  /**
   * Get tasks affected by task completion
   */
  getAffectedTasks(taskId: TaskId): TaskId[] {
    // Tasks that depend on this one
    const dependents = this.index.getConnectedNodes(taskId, 'in', 'DEPENDS_ON');
    return dependents.map(n => n.id as TaskId);
  }

  /**
   * Find similar tasks using graph traversal
   */
  findSimilarTasks(taskId: TaskId, maxResults: number = 5): GraphNode[] {
    const task = this.index.getNode(taskId);
    if (!task) return [];

    // Find tasks with same tags
    const tagNodes = this.index.getConnectedNodes(taskId, 'out', 'TAGGED_WITH');
    const similarByTag = new Set<string>();

    for (const tag of tagNodes) {
      const taggedTasks = this.index.getConnectedNodes(tag.id, 'in', 'TAGGED_WITH');
      for (const t of taggedTasks) {
        if (t.id !== taskId) {
          similarByTag.add(t.id);
        }
      }
    }

    // Find tasks in same category
    const categoryNodes = this.index.getConnectedNodes(taskId, 'out', 'PART_OF');
    const similarByCategory = new Set<string>();

    for (const cat of categoryNodes) {
      const categoryTasks = this.index.getConnectedNodes(cat.id, 'in', 'PART_OF');
      for (const t of categoryTasks) {
        if (t.id !== taskId) {
          similarByCategory.add(t.id);
        }
      }
    }

    // Combine results
    const similarIds = new Set([...similarByTag, ...similarByCategory]);
    const similarNodes = Array.from(similarIds)
      .map(id => this.index.getNode(id))
      .filter(Boolean) as GraphNode[];
    return similarNodes.slice(0, maxResults);
  }

  /**
   * Get critical path (longest dependency chain)
   */
  getCriticalPath(): GraphPath | null {
    const tasks = this.index.getNodesByType('task');
    let longestPath: GraphPath | null = null;

    // Find tasks with no dependencies (start nodes)
    const startNodes = tasks.filter(task => {
      const deps = this.index.getRelationships(task.id, 'in');
      return deps.filter(r => r.type === 'DEPENDS_ON').length === 0;
    });

    for (const start of startNodes) {
      // BFS to find longest path from this node
      const queue: Array<{ nodeId: string; path: string[] }> = [
        { nodeId: start.id, path: [start.id] }
      ];

      while (queue.length > 0) {
        const { nodeId, path } = queue.shift()!;
        const dependents = this.index.getConnectedNodes(nodeId, 'out', 'DEPENDS_ON');

        if (dependents.length === 0) {
          // End of path
          if (!longestPath || path.length > longestPath.length) {
            const nodes = path.map(id => this.index.getNode(id)!).filter(Boolean);
            longestPath = { nodes, relationships: [], length: nodes.length - 1 };
          }
        } else {
          for (const dep of dependents) {
            if (!path.includes(dep.id)) {
              queue.push({ nodeId: dep.id, path: [...path, dep.id] });
            }
          }
        }
      }
    }

    return longestPath;
  }

  /**
   * Get graph statistics
   */
  getStats(): {
    taskCount: number;
    relationshipCount: number;
    circularDependencies: number;
    averageDependencies: number;
  } {
    const stats = this.index.getStats();
    const circularDeps = this.detectCircularDependencies();
    const tasks = this.index.getNodesByType('task');

    let totalDeps = 0;
    for (const task of tasks) {
      const deps = this.index.getRelationships(task.id, 'both');
      totalDeps += deps.filter(r => r.type === 'DEPENDS_ON').length;
    }

    return {
      taskCount: stats.nodesByType.task,
      relationshipCount: stats.relationshipCount,
      circularDependencies: circularDeps.length,
      averageDependencies: tasks.length > 0 ? totalDeps / tasks.length : 0
    };
  }

  /**
   * Export graph
   */
  export(): string {
    return this.index.export();
  }

  /**
   * Import graph
   */
  import(json: string): void {
    this.index.import(json);
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const taskGraphManager = new TaskGraphManager();
