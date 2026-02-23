/**
 * CRDT (Conflict-free Replicated Data Type) Implementation
 * =========================================================
 * Enables real-time collaboration with automatic conflict resolution
 * Uses Vector Clocks and LWW (Last-Writer-Wins) registers
 */

import type { Task, TaskId } from '../types';

// ============================================
// VECTOR CLOCK - For causality tracking
// ============================================

export interface VectorClock {
  nodeId: string;
  clock: Map<string, number>;
}

export class VectorClockImpl implements VectorClock {
  nodeId: string;
  clock: Map<string, number>;

  constructor(nodeId: string, initialClock?: Map<string, number>) {
    this.nodeId = nodeId;
    this.clock = initialClock || new Map();
  }

  /**
   * Increment local clock
   */
  increment(): void {
    const current = this.clock.get(this.nodeId) || 0;
    this.clock.set(this.nodeId, current + 1);
  }

  /**
   * Merge with another vector clock (take max of each component)
   */
  merge(other: VectorClock): void {
    for (const [nodeId, time] of other.clock.entries()) {
      const current = this.clock.get(nodeId) || 0;
      this.clock.set(nodeId, Math.max(current, time));
    }
  }

  /**
   * Compare with another vector clock
   * Returns: 'before' | 'after' | 'concurrent' | 'equal'
   */
  compare(other: VectorClock): 'before' | 'after' | 'concurrent' | 'equal' {
    let hasBefore = false;
    let hasAfter = false;

    const allNodes = new Set([...this.clock.keys(), ...other.clock.keys()]);

    for (const nodeId of allNodes) {
      const thisTime = this.clock.get(nodeId) || 0;
      const otherTime = other.clock.get(nodeId) || 0;

      if (thisTime < otherTime) hasBefore = true;
      if (thisTime > otherTime) hasAfter = true;
    }

    if (hasBefore && hasAfter) return 'concurrent';
    if (hasBefore) return 'before';
    if (hasAfter) return 'after';
    return 'equal';
  }

  /**
   * Serialize to JSON-safe format
   */
  toJSON(): { nodeId: string; clock: [string, number][] } {
    return {
      nodeId: this.nodeId,
      clock: Array.from(this.clock.entries())
    };
  }

  /**
   * Deserialize from JSON
   */
  static fromJSON(json: { nodeId: string; clock: [string, number][] }): VectorClockImpl {
    return new VectorClockImpl(json.nodeId, new Map(json.clock));
  }
}

// ============================================
// LWW REGISTER - Last-Writer-Wins for simple values
// ============================================

export interface LWWRegister<T> {
  value: T;
  timestamp: number;
  nodeId: string;
}

export class LWWRegisterImpl<T> implements LWWRegister<T> {
  value: T;
  timestamp: number;
  nodeId: string;

  constructor(value: T, timestamp: number, nodeId: string) {
    this.value = value;
    this.timestamp = timestamp;
    this.nodeId = nodeId;
  }

  /**
   * Set new value with provided timestamp
   */
  set(newValue: T, timestamp: number, nodeId: string): void {
    if (timestamp > this.timestamp || (timestamp === this.timestamp && nodeId > this.nodeId)) {
      this.value = newValue;
      this.timestamp = timestamp;
      this.nodeId = nodeId;
    }
  }

  /**
   * Merge with another register (take the one with higher timestamp)
   */
  merge(other: LWWRegister<T>): void {
    if (
      other.timestamp > this.timestamp ||
      (other.timestamp === this.timestamp && other.nodeId > this.nodeId)
    ) {
      this.value = other.value;
      this.timestamp = other.timestamp;
      this.nodeId = other.nodeId;
    }
  }

  /**
   * Get current value
   */
  get(): T {
    return this.value;
  }
}

// ============================================
// G-SET - Grow-only Set
// ============================================

export class GSet<T> {
  private elements: Set<T>;

  constructor(elements?: Set<T>) {
    this.elements = elements || new Set();
  }

  /**
   * Add element (can only grow, never shrink)
   */
  add(element: T): void {
    this.elements.add(element);
  }

  /**
   * Check if element exists
   */
  has(element: T): boolean {
    return this.elements.has(element);
  }

  /**
   * Merge with another G-Set (union)
   */
  merge(other: GSet<T>): void {
    for (const elem of other.elements) {
      this.elements.add(elem);
    }
  }

  /**
   * Get all elements
   */
  values(): T[] {
    return Array.from(this.elements);
  }
}

// ============================================
// 2P-SET - Two-Phase Set (can add and remove)
// ============================================

export class TwoPSet<T> {
  private added: GSet<T>;
  private removed: GSet<T>;

  constructor() {
    this.added = new GSet<T>();
    this.removed = new GSet<T>();
  }

  /**
   * Add element
   */
  add(element: T): void {
    this.added.add(element);
  }

  /**
   * Remove element (once removed, cannot be re-added)
   */
  remove(element: T): void {
    if (this.added.has(element)) {
      this.removed.add(element);
    }
  }

  /**
   * Check if element exists (added but not removed)
   */
  has(element: T): boolean {
    return this.added.has(element) && !this.removed.has(element);
  }

  /**
   * Merge with another 2P-Set
   */
  merge(other: TwoPSet<T>): void {
    this.added.merge(other.added);
    this.removed.merge(other.removed);
  }

  /**
   * Get all current elements
   */
  values(): T[] {
    return this.added.values().filter(e => !this.removed.has(e));
  }
}

// ============================================
// OR-SET - Observed-Remove Set (better than 2P-Set)
// ============================================

interface ORSetEntry<T> {
  element: T;
  uniqueId: string;
}

export class ORSet<T> {
  private elements: Map<T, Set<string>>;
  private tombstones: Map<T, Set<string>>;

  constructor() {
    this.elements = new Map();
    this.tombstones = new Map();
  }

  /**
   * Add element with unique identifier
   */
  add(element: T, uniqueId: string): void {
    if (!this.elements.has(element)) {
      this.elements.set(element, new Set());
    }
    this.elements.get(element)!.add(uniqueId);
  }

  /**
   * Remove specific element instance
   */
  remove(element: T, uniqueIds?: Set<string>): void {
    const elementIds = this.elements.get(element);
    if (!elementIds) return;

    if (!this.tombstones.has(element)) {
      this.tombstones.set(element, new Set());
    }

    const toRemove = uniqueIds || elementIds;
    for (const id of toRemove) {
      if (elementIds.has(id)) {
        this.tombstones.get(element)!.add(id);
      }
    }
  }

  /**
   * Check if element exists
   */
  has(element: T): boolean {
    const elementIds = this.elements.get(element);
    const tombstoneIds = this.tombstones.get(element);

    if (!elementIds) return false;
    if (!tombstoneIds) return true;

    // Element exists if any of its IDs are not tombstoned
    for (const id of elementIds) {
      if (!tombstoneIds.has(id)) return true;
    }
    return false;
  }

  /**
   * Merge with another OR-Set
   */
  merge(other: ORSet<T>): void {
    // Merge elements
    for (const [element, ids] of other.elements.entries()) {
      if (!this.elements.has(element)) {
        this.elements.set(element, new Set());
      }
      for (const id of ids) {
        this.elements.get(element)!.add(id);
      }
    }

    // Merge tombstones
    for (const [element, ids] of other.tombstones.entries()) {
      if (!this.tombstones.has(element)) {
        this.tombstones.set(element, new Set());
      }
      for (const id of ids) {
        this.tombstones.get(element)!.add(id);
      }
    }
  }

  /**
   * Get all current elements
   */
  values(): T[] {
    const result: T[] = [];
    for (const element of this.elements.keys()) {
      if (this.has(element)) {
        result.push(element);
      }
    }
    return result;
  }
}

// ============================================
// LWW-MAP - Last-Writer-Wins Map for task state
// ============================================

export interface TaskState {
  id: TaskId;
  text: LWWRegisterImpl<string>;
  status: LWWRegisterImpl<'pending' | 'completed' | 'archived'>;
  priority: LWWRegisterImpl<'low' | 'medium' | 'high' | 'critical'>;
  dueDate: LWWRegisterImpl<string | undefined>;
  tags: ORSet<string>;
  vectorClock: VectorClockImpl;
}

export class LWWMap {
  private nodeId: string;
  private tasks: Map<TaskId, TaskState>;

  constructor(nodeId: string) {
    this.nodeId = nodeId;
    this.tasks = new Map();
  }

  /**
   * Create or get task state
   */
  getOrCreateTask(taskId: TaskId): TaskState {
    if (!this.tasks.has(taskId)) {
      const now = Date.now();
      this.tasks.set(taskId, {
        id: taskId,
        text: new LWWRegisterImpl('', now, this.nodeId),
        status: new LWWRegisterImpl('pending', now, this.nodeId),
        priority: new LWWRegisterImpl('medium', now, this.nodeId),
        dueDate: new LWWRegisterImpl(undefined, now, this.nodeId),
        tags: new ORSet(),
        vectorClock: new VectorClockImpl(this.nodeId)
      });
    }
    return this.tasks.get(taskId)!;
  }

  /**
   * Update task text
   */
  updateText(taskId: TaskId, text: string): void {
    const task = this.getOrCreateTask(taskId);
    task.vectorClock.increment();
    task.text.set(text, Date.now(), this.nodeId);
  }

  /**
   * Update task status
   */
  updateStatus(taskId: TaskId, status: 'pending' | 'completed' | 'archived'): void {
    const task = this.getOrCreateTask(taskId);
    task.vectorClock.increment();
    task.status.set(status, Date.now(), this.nodeId);
  }

  /**
   * Update task priority
   */
  updatePriority(taskId: TaskId, priority: 'low' | 'medium' | 'high' | 'critical'): void {
    const task = this.getOrCreateTask(taskId);
    task.vectorClock.increment();
    task.priority.set(priority, Date.now(), this.nodeId);
  }

  /**
   * Update task due date
   */
  updateDueDate(taskId: TaskId, dueDate: string | undefined): void {
    const task = this.getOrCreateTask(taskId);
    task.vectorClock.increment();
    task.dueDate.set(dueDate, Date.now(), this.nodeId);
  }

  /**
   * Add tag to task
   */
  addTag(taskId: TaskId, tag: string): void {
    const task = this.getOrCreateTask(taskId);
    task.vectorClock.increment();
    task.tags.add(tag, this.generateUniqueId());
  }

  /**
   * Remove tag from task
   */
  removeTag(taskId: TaskId, tag: string): void {
    const task = this.getOrCreateTask(taskId);
    task.vectorClock.increment();
    task.tags.remove(tag);
  }

  /**
   * Delete task
   */
  deleteTask(taskId: TaskId): void {
    this.tasks.delete(taskId);
  }

  /**
   * Get task as plain object
   */
  getTask(taskId: TaskId): Task | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    return {
      id: task.id,
      text: task.text.get(),
      status: task.status.get(),
      priority: task.priority.get(),
      dueDate: task.dueDate.get(),
      tags: task.tags.values(),
      categories: [],
      subtasks: [],
      createdAt: new Date(task.vectorClock.clock.get(this.nodeId) || Date.now()).toISOString(),
      updatedAt: new Date().toISOString(),
      version: Array.from(task.vectorClock.clock.values()).reduce((a, b) => a + b, 0),
      recurrence: 'none'
    };
  }

  /**
   * Get all tasks
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.keys())
      .map(id => this.getTask(id))
      .filter((t): t is Task => t !== null);
  }

  /**
   * Merge with another LWW-Map
   */
  merge(other: LWWMap): void {
    for (const [taskId, otherTask] of other.tasks.entries()) {
      const localTask = this.tasks.get(taskId);

      if (!localTask) {
        // Task doesn't exist locally, add it
        this.tasks.set(taskId, otherTask);
      } else {
        // Merge task fields using LWW semantics
        const comparison = localTask.vectorClock.compare(otherTask.vectorClock);

        if (comparison === 'before') {
          // Remote is newer, take remote values
          localTask.text.merge(otherTask.text);
          localTask.status.merge(otherTask.status);
          localTask.priority.merge(otherTask.priority);
          localTask.dueDate.merge(otherTask.dueDate);
          localTask.tags.merge(otherTask.tags);
          localTask.vectorClock.merge(otherTask.vectorClock);
        } else if (comparison === 'concurrent') {
          // Concurrent updates - merge all fields
          localTask.text.merge(otherTask.text);
          localTask.status.merge(otherTask.status);
          localTask.priority.merge(otherTask.priority);
          localTask.dueDate.merge(otherTask.dueDate);
          localTask.tags.merge(otherTask.tags);
          localTask.vectorClock.merge(otherTask.vectorClock);
        }
        // If local is 'after', keep local values
      }
    }
  }

  /**
   * Generate unique ID for OR-Set entries
   */
  private generateUniqueId(): string {
    return `${this.nodeId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Export state for synchronization
   */
  export(): string {
    const state = {
      nodeId: this.nodeId,
      tasks: Array.from(this.tasks.entries()).map(([id, task]) => ({
        id,
        text: task.text.get(),
        textTimestamp: task.text.timestamp,
        textNodeId: task.text.nodeId,
        status: task.status.get(),
        statusTimestamp: task.status.timestamp,
        statusNodeId: task.status.nodeId,
        priority: task.priority.get(),
        priorityTimestamp: task.priority.timestamp,
        priorityNodeId: task.priority.nodeId,
        dueDate: task.dueDate.get(),
        dueDateTimestamp: task.dueDate.timestamp,
        dueDateNodeId: task.dueDate.nodeId,
        tags: task.tags.values(),
        vectorClock: task.vectorClock.toJSON()
      }))
    };
    return JSON.stringify(state);
  }

  /**
   * Import state from synchronization
   */
  import(json: string): void {
    const state = JSON.parse(json);
    const remoteMap = new LWWMap(state.nodeId);

    // Reconstruct remote state
    for (const taskData of state.tasks) {
      const task = remoteMap.getOrCreateTask(taskData.id);
      task.text.set(taskData.text, taskData.textTimestamp, taskData.textNodeId);
      task.status.set(taskData.status, taskData.statusTimestamp, taskData.statusNodeId);
      task.priority.set(taskData.priority, taskData.priorityTimestamp, taskData.priorityNodeId);
      task.dueDate.set(taskData.dueDate, taskData.dueDateTimestamp, taskData.dueDateNodeId);
      for (const tag of taskData.tags) {
        task.tags.add(tag, `${taskData.id}-${tag}`);
      }
      task.vectorClock = VectorClockImpl.fromJSON(taskData.vectorClock);
    }

    // Merge with local state
    this.merge(remoteMap);
  }
}

// ============================================
// COLLABORATION ENGINE - Manages peer connections
// ============================================

export interface Peer {
  id: string;
  lastSeen: number;
  vectorClock: VectorClock;
}

export class CollaborationEngine {
  private localMap: LWWMap;
  private peers: Map<string, Peer>;
  private broadcastCallback: ((data: string) => void) | null = null;

  constructor(nodeId: string) {
    this.localMap = new LWWMap(nodeId);
    this.peers = new Map();
  }

  /**
   * Set broadcast callback for network layer
   */
  onBroadcast(callback: (data: string) => void): void {
    this.broadcastCallback = callback;
  }

  /**
   * Create a new task
   */
  createTask(text: string): TaskId {
    const taskId = this.generateTaskId();
    this.localMap.updateText(taskId, text);
    this.broadcast();
    return taskId;
  }

  /**
   * Update task
   */
  updateTask(taskId: TaskId, updates: Partial<{
    text: string;
    status: 'pending' | 'completed' | 'archived';
    priority: 'low' | 'medium' | 'high' | 'critical';
    dueDate: string;
  }>): void {
    if (updates.text !== undefined) this.localMap.updateText(taskId, updates.text);
    if (updates.status !== undefined) this.localMap.updateStatus(taskId, updates.status);
    if (updates.priority !== undefined) this.localMap.updatePriority(taskId, updates.priority);
    if (updates.dueDate !== undefined) this.localMap.updateDueDate(taskId, updates.dueDate);
    this.broadcast();
  }

  /**
   * Delete task
   */
  deleteTask(taskId: TaskId): void {
    this.localMap.deleteTask(taskId);
    this.broadcast();
  }

  /**
   * Get all tasks
   */
  getTasks(): Task[] {
    return this.localMap.getAllTasks();
  }

  /**
   * Receive state from peer
   */
  receiveFromPeer(peerId: string, stateJson: string): void {
    // Update peer info
    this.peers.set(peerId, {
      id: peerId,
      lastSeen: Date.now(),
      vectorClock: { nodeId: peerId, clock: new Map() }
    });

    // Create temporary map and merge
    const remoteMap = new LWWMap(peerId);
    remoteMap.import(stateJson);
    this.localMap.merge(remoteMap);
  }

  /**
   * Broadcast local state to all peers
   */
  private broadcast(): void {
    if (this.broadcastCallback) {
      this.broadcastCallback(this.localMap.export());
    }
  }

  /**
   * Get collaboration statistics
   */
  getStats(): {
    taskCount: number;
    peerCount: number;
    nodeId: string;
  } {
    return {
      taskCount: this.localMap.getAllTasks().length,
      peerCount: this.peers.size,
      nodeId: (this.localMap as any).nodeId
    };
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): TaskId {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================
// EXPORTS
// ============================================

export function createCollaborationEngine(nodeId: string): CollaborationEngine {
  return new CollaborationEngine(nodeId);
}

// Singleton for local node
const localNodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
export const collaborationEngine = createCollaborationEngine(localNodeId);
