/**
 * Time Blocking & Task Estimation Module
 * =======================================
 * Schedule tasks into time blocks with intelligent estimation
 */

import type { Task, TaskId } from '../types';

export interface TimeBlock {
  id: string;
  taskId?: TaskId;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  color: string;
  completed: boolean;
  estimatedMinutes: number;
  actualMinutes?: number;
  priority: 'low' | 'medium' | 'high';
  bufferBefore: number; // minutes
  bufferAfter: number; // minutes
}

export interface DaySchedule {
  date: string;
  blocks: TimeBlock[];
  totalScheduled: number; // minutes
  totalAvailable: number; // minutes
  utilization: number; // percentage
}

export interface EstimationModel {
  taskId: TaskId;
  estimatedMinutes: number;
  actualMinutes: number;
  confidence: number;
  factors: EstimationFactor[];
}

export type EstimationFactor = 'complexity' | 'familiarity' | 'dependencies' | 'interruptions';

export interface TimeBlockingSettings {
  workDayStart: number; // hour (0-23)
  workDayEnd: number; // hour (0-23)
  defaultBlockDuration: number; // minutes
  defaultBuffer: number; // minutes
  maxUtilization: number; // percentage
  colors: Record<string, string>;
}

export class TimeBlockingEngine {
  private settings: TimeBlockingSettings = {
    workDayStart: 8,
    workDayEnd: 18,
    defaultBlockDuration: 60,
    defaultBuffer: 10,
    maxUtilization: 80,
    colors: {
      work: '#6366f1',
      personal: '#22c55e',
      meeting: '#f59e0b',
      break: '#ef4444',
      deep: '#8b5cf6',
      admin: '#64748b'
    }
  };

  private estimationHistory: EstimationModel[] = [];

  /**
   * Update settings
   */
  updateSettings(settings: Partial<TimeBlockingSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  /**
   * Create a time block
   */
  createBlock(options: {
    taskId?: TaskId;
    title: string;
    description?: string;
    startTime: Date;
    duration: number;
    color?: string;
    priority?: 'low' | 'medium' | 'high';
  }): TimeBlock {
    const durationWithBuffer = options.duration + this.settings.defaultBuffer * 2;
    const endTime = new Date(options.startTime.getTime() + durationWithBuffer * 60000);
    
    return {
      id: this.generateId(),
      taskId: options.taskId,
      title: options.title,
      description: options.description,
      startTime: options.startTime,
      endTime,
      color: options.color ?? this.settings.colors.work,
      completed: false,
      estimatedMinutes: options.duration,
      priority: options.priority ?? 'medium',
      bufferBefore: this.settings.defaultBuffer,
      bufferAfter: this.settings.defaultBuffer
    };
  }

  /**
   * Schedule a task into a time block
   */
  scheduleTask(task: Task, date: Date): TimeBlock {
    const estimatedMinutes = task.estimatedMinutes || this.estimateTask(task);
    
    // Find available slot
    const availableSlot = this.findAvailableSlot(date, estimatedMinutes);
    
    return this.createBlock({
      taskId: task.id,
      title: task.text,
      startTime: availableSlot,
      duration: estimatedMinutes,
      priority: this.priorityToBlockPriority(task.priority)
    });
  }

  /**
   * Generate day schedule
   */
  generateDaySchedule(date: Date, tasks: Task[]): DaySchedule {
    const blocks: TimeBlock[] = [];
    const totalAvailable = (this.settings.workDayEnd - this.settings.workDayStart) * 60;
    
    // Sort tasks by priority and due date
    const sortedTasks = this.sortTasksByPriority(tasks);
    
    // Schedule tasks
    let currentTime = new Date(date);
    currentTime.setHours(this.settings.workDayStart, 0, 0, 0);
    
    for (const task of sortedTasks) {
      const estimatedMinutes = task.estimatedMinutes || this.estimateTask(task);
      const endTime = new Date(currentTime.getTime() + estimatedMinutes * 60000);
      
      // Check if we're still within work hours
      if (endTime.getHours() >= this.settings.workDayEnd) {
        break;
      }
      
      const block = this.scheduleTask(task, currentTime);
      blocks.push(block);
      
      // Move to next slot
      currentTime = new Date(endTime.getTime() + this.settings.defaultBuffer * 60000);
    }
    
    const totalScheduled = blocks.reduce((acc, block) => acc + block.estimatedMinutes, 0);
    const utilization = (totalScheduled / totalAvailable) * 100;

    return {
      date: date.toISOString().split('T')[0]!,
      blocks,
      totalScheduled,
      totalAvailable,
      utilization: Math.round(utilization * 100) / 100
    };
  }

  /**
   * Estimate task duration using historical data
   */
  estimateTask(task: Task): number {
    // Base estimation on priority
    const baseEstimates: Record<string, number> = {
      low: 30,
      medium: 60,
      high: 90,
      critical: 120
    };
    
    let estimate = baseEstimates[task.priority] || 60;
    
    // Adjust based on subtasks
    if (task.subtasks && task.subtasks.length > 0) {
      estimate *= 1 + (task.subtasks.length * 0.2);
    }
    
    // Adjust based on historical accuracy
    const historical = this.estimationHistory.filter(e => e.taskId === task.id);
    if (historical.length > 0) {
      const avgAccuracy = historical.reduce((acc, h) => acc + (h.actualMinutes / h.estimatedMinutes), 0) / historical.length;
      estimate *= avgAccuracy;
    }
    
    // Adjust based on categories
    if (task.categories && task.categories.length > 0) {
      // Complex categories take longer
      estimate *= 1 + (task.categories.length * 0.1);
    }
    
    return Math.round(estimate / 15) * 15; // Round to nearest 15 minutes
  }

  /**
   * Record actual time spent for learning
   */
  recordActualTime(taskId: TaskId, actualMinutes: number, factors: EstimationFactor[]): void {
    const historical = this.estimationHistory.find(e => e.taskId === taskId);
    
    if (historical) {
      // Update existing estimation
      const accuracy = actualMinutes / historical.estimatedMinutes;
      historical.actualMinutes = actualMinutes;
      historical.confidence = Math.min(accuracy > 0.8 && accuracy < 1.2 ? 1 : 0.5, 1);
      historical.factors = factors;
    }
  }

  /**
   * Find available time slot
   */
  findAvailableSlot(date: Date, duration: number, existingBlocks: TimeBlock[] = []): Date {
    let slotStart = new Date(date);
    slotStart.setHours(this.settings.workDayStart, 0, 0, 0);
    
    const slotEnd = new Date(date);
    slotEnd.setHours(this.settings.workDayEnd, 0, 0, 0);
    
    while (slotStart.getTime() + duration * 60000 <= slotEnd.getTime()) {
      const potentialEnd = new Date(slotStart.getTime() + duration * 60000);
      
      // Check for conflicts
      const hasConflict = existingBlocks.some(block => {
        return (
          (slotStart >= block.startTime && slotStart < block.endTime) ||
          (potentialEnd > block.startTime && potentialEnd <= block.endTime) ||
          (slotStart <= block.startTime && potentialEnd >= block.endTime)
        );
      });
      
      if (!hasConflict) {
        return slotStart;
      }
      
      // Move to next 15-minute slot
      slotStart = new Date(slotStart.getTime() + 15 * 60000);
    }
    
    // No slot found, return end of day
    return slotEnd;
  }

  /**
   * Detect scheduling conflicts
   */
  detectConflicts(blocks: TimeBlock[]): { block1: TimeBlock; block2: TimeBlock }[] {
    const conflicts: { block1: TimeBlock; block2: TimeBlock }[] = [];

    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const block1 = blocks[i]!;
        const block2 = blocks[j]!;

        if (this.blocksOverlap(block1, block2)) {
          conflicts.push({ block1, block2 });
        }
      }
    }

    return conflicts;
  }

  /**
   * Optimize schedule for maximum productivity
   */
  optimizeSchedule(blocks: TimeBlock[]): TimeBlock[] {
    // Sort by priority
    const sorted = [...blocks].sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    
    // Schedule high-priority tasks in morning (peak productivity)
    const optimized: TimeBlock[] = [];
    const morningEnd = new Date(sorted[0]?.startTime || new Date());
    morningEnd.setHours(12, 0, 0, 0);
    
    for (const block of sorted) {
      if (block.priority === 'high' && block.startTime < morningEnd) {
        optimized.push(block);
      }
    }
    
    // Add breaks between deep work
    for (const block of sorted) {
      if (!optimized.includes(block)) {
        optimized.push(block);
      }
    }
    
    return optimized;
  }

  /**
   * Get weekly time distribution
   */
  getWeeklyDistribution(blocks: TimeBlock[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    days.forEach(day => { distribution[day] = 0; });

    blocks.forEach(block => {
      const dayIndex = block.startTime.getDay();
      const day = days[dayIndex]!;
      distribution[day] += block.estimatedMinutes;
    });

    return distribution;
  }

  /**
   * Get productivity insights
   */
  getProductivityInsights(blocks: TimeBlock[]): string[] {
    const insights: string[] = [];
    
    // Check utilization
    const totalScheduled = blocks.reduce((acc, b) => acc + b.estimatedMinutes, 0);
    const totalAvailable = blocks.length > 0 
      ? (this.settings.workDayEnd - this.settings.workDayStart) * 60 * blocks.length 
      : 1;
    const utilization = (totalScheduled / totalAvailable) * 100;
    
    if (utilization > 90) {
      insights.push('⚠️ Schedule is over 90% utilized. Consider adding more buffer time.');
    } else if (utilization < 50) {
      insights.push('💡 Schedule has room for more focused work blocks.');
    }
    
    // Check for deep work
    const deepWorkBlocks = blocks.filter(b => b.priority === 'high');
    if (deepWorkBlocks.length < 2) {
      insights.push('📌 Consider scheduling at least 2 high-priority blocks per day.');
    }
    
    // Check for breaks
    const breakBlocks = blocks.filter(b => b.color === this.settings.colors.break);
    if (breakBlocks.length === 0) {
      insights.push('☕ No breaks scheduled. Regular breaks improve productivity.');
    }
    
    return insights;
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private sortTasksByPriority(tasks: Task[]): Task[] {
    const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

    return [...tasks].sort((a, b) => {
      // First by priority
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Then by due date
      if (a.dueDate && b.dueDate) {
        const aDate = new Date(a.dueDate!);
        const bDate = new Date(b.dueDate!);
        return aDate.getTime() - bDate.getTime();
      }

      return 0;
    });
  }

  private priorityToBlockPriority(priority: string): 'low' | 'medium' | 'high' {
    if (priority === 'critical' || priority === 'high') return 'high';
    if (priority === 'medium') return 'medium';
    return 'low';
  }

  private blocksOverlap(block1: TimeBlock, block2: TimeBlock): boolean {
    return (
      block1.startTime < block2.endTime &&
      block1.endTime > block2.startTime
    );
  }

  private generateId(): string {
    return `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
export const timeBlockingEngine = new TimeBlockingEngine();
