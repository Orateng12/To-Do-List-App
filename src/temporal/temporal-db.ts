/**
 * Temporal Database - Time-Travel Queries
 * ========================================
 * Bitemporal data model tracking both valid time and transaction time
 * Enables querying state at any point in history
 */

import type { Task, TaskId } from '../types';

// ============================================
// TEMPORAL DATA TYPES
// ============================================

export interface TemporalTask {
  taskId: TaskId;
  data: Task;
  validFrom: Date;      // When this state became valid in reality
  validTo?: Date;       // When this state ceased to be valid
  transactionFrom: Date; // When we recorded this in database
  transactionTo?: Date;  // When this record was superseded
  isCurrent: boolean;
}

export interface TemporalQuery {
  taskId?: TaskId;
  asOf?: Date;           // Query state as of this transaction time
  validAsOf?: Date;      // Query state valid at this real time
  fromTransaction?: Date;
  toTransaction?: Date;
  fromValid?: Date;
  toValid?: Date;
}

export interface TemporalVersion {
  version: number;
  data: Task;
  validFrom: Date;
  validTo?: Date;
  recordedAt: Date;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
}

// ============================================
// TEMPORAL INDEX
// ============================================

class TemporalIndex {
  private taskVersions: Map<TaskId, TemporalTask[]> = new Map();
  private transactionTimeline: Array<{ timestamp: Date; taskId: TaskId; version: number }> = [];

  /**
   * Add new temporal record
   */
  add(taskId: TaskId, data: Task, validFrom?: Date): TemporalTask {
    const now = new Date();
    const validFromDate = validFrom || now;

    // End previous version
    this.endCurrentVersion(taskId, now);

    // Create new version
    const temporalTask: TemporalTask = {
      taskId,
      data,
      validFrom: validFromDate,
      validTo: undefined,
      transactionFrom: now,
      transactionTo: undefined,
      isCurrent: true
    };

    if (!this.taskVersions.has(taskId)) {
      this.taskVersions.set(taskId, []);
    }
    this.taskVersions.get(taskId)!.push(temporalTask);

    // Record in transaction timeline
    const version = this.taskVersions.get(taskId)!.length;
    this.transactionTimeline.push({
      timestamp: now,
      taskId,
      version
    });

    return temporalTask;
  }

  /**
   * End current version of task
   */
  private endCurrentVersion(taskId: TaskId, endTime: Date): void {
    const versions = this.taskVersions.get(taskId);
    if (!versions || versions.length === 0) return;

    const current = versions[versions.length - 1];
    if (current.isCurrent) {
      current.validTo = endTime;
      current.transactionTo = endTime;
      current.isCurrent = false;
    }
  }

  /**
   * Query state as of transaction time
   */
  asOfTransaction(taskId: TaskId, timestamp: Date): Task | null {
    const versions = this.taskVersions.get(taskId);
    if (!versions) return null;

    for (let i = versions.length - 1; i >= 0; i--) {
      const version = versions[i];
      if (
        version.transactionFrom <= timestamp &&
        (!version.transactionTo || version.transactionTo > timestamp)
      ) {
        return version.data;
      }
    }

    return null;
  }

  /**
   * Query state valid at real time
   */
  asOfValidTime(taskId: TaskId, timestamp: Date): Task | null {
    const versions = this.taskVersions.get(taskId);
    if (!versions) return null;

    for (const version of versions) {
      if (
        version.validFrom <= timestamp &&
        (!version.validTo || version.validTo > timestamp)
      ) {
        return version.data;
      }
    }

    return null;
  }

  /**
   * Get all versions of task
   */
  getAllVersions(taskId: TaskId): TemporalVersion[] {
    const versions = this.taskVersions.get(taskId) || [];
    return versions.map((v, i) => ({
      version: i + 1,
      data: v.data,
      validFrom: v.validFrom,
      validTo: v.validTo,
      recordedAt: v.transactionFrom,
      operation: i === 0 ? 'CREATE' : v.isCurrent ? 'UPDATE' : 'UPDATE'
    }));
  }

  /**
   * Get current state
   */
  getCurrent(taskId: TaskId): Task | null {
    const versions = this.taskVersions.get(taskId);
    if (!versions || versions.length === 0) return null;

    const current = versions[versions.length - 1];
    return current.isCurrent ? current.data : null;
  }

  /**
   * Query tasks changed in time range
   */
  getChangesInRange(from: Date, to: Date): Array<{
    taskId: TaskId;
    changes: TemporalVersion[];
  }> {
    const changes: Map<TaskId, TemporalVersion[]> = new Map();

    for (const [taskId, versions] of this.taskVersions.entries()) {
      const relevantVersions = versions.filter(v =>
        v.transactionFrom >= from && v.transactionFrom <= to
      );

      if (relevantVersions.length > 0) {
        changes.set(taskId, relevantVersions.map((v, i) => ({
          version: i + 1,
          data: v.data,
          validFrom: v.validFrom,
          validTo: v.validTo,
          recordedAt: v.transactionFrom,
          operation: i === 0 ? 'CREATE' : 'UPDATE' as const
        })));
      }
    }

    return Array.from(changes.entries()).map(([taskId, changes]) => ({
      taskId,
      changes
    }));
  }

  /**
   * Get transaction timeline
   */
  getTimeline(from?: Date, to?: Date): Array<{
    timestamp: Date;
    taskId: TaskId;
    version: number;
  }> {
    let timeline = this.transactionTimeline;

    if (from) {
      timeline = timeline.filter(t => t.timestamp >= from);
    }
    if (to) {
      timeline = timeline.filter(t => t.timestamp <= to);
    }

    return timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Rollback to specific transaction time
   */
  rollbackTo(timestamp: Date): Map<TaskId, Task> {
    const rolledBack = new Map<TaskId, Task>();

    for (const [taskId, versions] of this.taskVersions.entries()) {
      // Find version that was current at rollback time
      let targetVersion: TemporalTask | null = null;

      for (let i = versions.length - 1; i >= 0; i--) {
        if (versions[i].transactionFrom <= timestamp) {
          targetVersion = versions[i];
          break;
        }
      }

      if (targetVersion && targetVersion.isCurrent) {
        rolledBack.set(taskId, targetVersion.data);
      }
    }

    return rolledBack;
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalTasks: number;
    totalVersions: number;
    avgVersionsPerTask: number;
  } {
    let totalVersions = 0;
    for (const versions of this.taskVersions.values()) {
      totalVersions += versions.length;
    }

    return {
      totalTasks: this.taskVersions.size,
      totalVersions,
      avgVersionsPerTask: this.taskVersions.size > 0
        ? totalVersions / this.taskVersions.size
        : 0
    };
  }

  /**
   * Export temporal data
   */
  export(): string {
    return JSON.stringify({
      taskVersions: Array.from(this.taskVersions.entries()).map(([id, versions]) => ({
        taskId: id,
        versions: versions.map(v => ({
          ...v,
          validFrom: v.validFrom.toISOString(),
          validTo: v.validTo?.toISOString(),
          transactionFrom: v.transactionFrom.toISOString(),
          transactionTo: v.transactionTo?.toISOString()
        }))
      })),
      timeline: this.transactionTimeline.map(t => ({
        ...t,
        timestamp: t.timestamp.toISOString()
      }))
    });
  }

  /**
   * Import temporal data
   */
  import(json: string): void {
    const data = JSON.parse(json);

    for (const taskData of data.taskVersions) {
      const versions: TemporalTask[] = taskData.versions.map((v: any) => ({
        ...v,
        validFrom: new Date(v.validFrom),
        validTo: v.validTo ? new Date(v.validTo) : undefined,
        transactionFrom: new Date(v.transactionFrom),
        transactionTo: v.transactionTo ? new Date(v.transactionTo) : undefined
      }));
      this.taskVersions.set(taskData.taskId, versions);
    }

    this.transactionTimeline = data.timeline.map((t: any) => ({
      ...t,
      timestamp: new Date(t.timestamp)
    }));
  }
}

// ============================================
// TEMPORAL QUERY ENGINE
// ============================================

export class TemporalQueryEngine {
  private index: TemporalIndex;

  constructor() {
    this.index = new TemporalIndex();
  }

  /**
   * Record task creation
   */
  createTask(task: Task, validFrom?: Date): void {
    this.index.add(task.id, task, validFrom);
  }

  /**
   * Record task update
   */
  updateTask(task: Task, validFrom?: Date): void {
    this.index.add(task.id, task, validFrom);
  }

  /**
   * Query current state
   */
  getCurrent(taskId: TaskId): Task | null {
    return this.index.getCurrent(taskId);
  }

  /**
   * Time-travel query - get state as of transaction time
   */
  asOf(taskId: TaskId, timestamp: Date): Task | null {
    return this.index.asOfTransaction(taskId, timestamp);
  }

  /**
   * Historical query - get state valid at real time
   */
  validAsOf(taskId: TaskId, timestamp: Date): Task | null {
    return this.index.asOfValidTime(taskId, timestamp);
  }

  /**
   * Get version history
   */
  getHistory(taskId: TaskId): TemporalVersion[] {
    return this.index.getAllVersions(taskId);
  }

  /**
   * Query changes in time range
   */
  getChanges(from: Date, to: Date): Array<{
    taskId: TaskId;
    changes: TemporalVersion[];
  }> {
    return this.index.getChangesInRange(from, to);
  }

  /**
   * Get transaction timeline
   */
  getTimeline(from?: Date, to?: Date): Array<{
    timestamp: Date;
    taskId: TaskId;
    version: number;
  }> {
    return this.index.getTimeline(from, to);
  }

  /**
   * Rollback to specific time
   */
  rollbackTo(timestamp: Date): Map<TaskId, Task> {
    return this.index.rollbackTo(timestamp);
  }

  /**
   * Compare two points in time
   */
  compare(taskId: TaskId, time1: Date, time2: Date): {
    state1: Task | null;
    state2: Task | null;
    differences: string[];
  } {
    const state1 = this.index.asOfTransaction(taskId, time1);
    const state2 = this.index.asOfTransaction(taskId, time2);

    const differences: string[] = [];

    if (state1 && state2) {
      if (state1.text !== state2.text) differences.push('text');
      if (state1.status !== state2.status) differences.push('status');
      if (state1.priority !== state2.priority) differences.push('priority');
      if (state1.dueDate !== state2.dueDate) differences.push('dueDate');
    } else if (state1 && !state2) {
      differences.push('task_deleted');
    } else if (!state1 && state2) {
      differences.push('task_created');
    }

    return { state1, state2, differences };
  }

  /**
   * Audit trail for task
   */
  getAuditTrail(taskId: TaskId): Array<{
    timestamp: Date;
    operation: string;
    changes?: Record<string, { from: unknown; to: unknown }>;
  }> {
    const versions = this.index.getAllVersions(taskId);
    const trail: Array<{
      timestamp: Date;
      operation: string;
      changes?: Record<string, { from: unknown; to: unknown }>;
    }> = [];

    for (let i = 0; i < versions.length; i++) {
      const version = versions[i];
      const entry = {
        timestamp: version.recordedAt,
        operation: version.operation,
        changes: undefined as Record<string, { from: unknown; to: unknown }> | undefined
      };

      if (i > 0) {
        const prevVersion = versions[i - 1];
        const changes: Record<string, { from: unknown; to: unknown }> = {};

        if (version.data.text !== prevVersion.data.text) {
          changes.text = { from: prevVersion.data.text, to: version.data.text };
        }
        if (version.data.status !== prevVersion.data.status) {
          changes.status = { from: prevVersion.data.status, to: version.data.status };
        }
        if (version.data.priority !== prevVersion.data.priority) {
          changes.priority = { from: prevVersion.data.priority, to: version.data.priority };
        }

        if (Object.keys(changes).length > 0) {
          entry.changes = changes;
        }
      }

      trail.push(entry);
    }

    return trail;
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalTasks: number;
    totalVersions: number;
    avgVersionsPerTask: number;
  } {
    return this.index.getStats();
  }

  /**
   * Export database
   */
  export(): string {
    return this.index.export();
  }

  /**
   * Import database
   */
  import(json: string): void {
    this.index.import(json);
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const temporalDatabase = new TemporalQueryEngine();
