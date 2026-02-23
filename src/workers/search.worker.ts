/**
 * Web Worker - Background Processing for Heavy Computations
 * ==========================================================
 * Offloads search, encryption, and analytics to prevent UI blocking
 */

import type { WorkerMessage, WorkerResponse, Task } from '../types';

// ============================================
// SEARCH WORKER
// ============================================

function searchTasks(
  tasks: Task[],
  query: string,
  options: { fuzzy?: boolean; limit?: number } = {}
): Task[] {
  const { fuzzy = false, limit = 100 } = options;
  const normalizedQuery = query.toLowerCase().trim();
  
  if (!normalizedQuery) {
    return tasks.slice(0, limit);
  }

  const results: Array<{ task: Task; score: number }> = [];

  for (const task of tasks) {
    let score = 0;

    // Exact match in text
    if (task.text.toLowerCase().includes(normalizedQuery)) {
      score += 10;
    }

    // Match in description/notes
    if (task.description?.toLowerCase().includes(normalizedQuery)) {
      score += 5;
    }
    if (task.notes?.toLowerCase().includes(normalizedQuery)) {
      score += 3;
    }

    // Match in tags
    if (task.tags.some(tag => tag.toLowerCase().includes(normalizedQuery))) {
      score += 7;
    }

    // Fuzzy matching (simple implementation)
    if (fuzzy && score === 0) {
      score = calculateFuzzyScore(task.text, normalizedQuery);
    }

    if (score > 0) {
      results.push({ task, score });
    }
  }

  // Sort by relevance score
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, limit).map(r => r.task);
}

function calculateFuzzyScore(text: string, query: string): number {
  const normalizedText = text.toLowerCase();
  let score = 0;
  let queryIndex = 0;

  for (let i = 0; i < normalizedText.length && queryIndex < query.length; i++) {
    if (normalizedText[i] === query[queryIndex]) {
      score += 1;
      queryIndex++;
    }
  }

  // Return score based on how many characters matched in order
  return queryIndex === query.length ? score * 0.5 : 0;
}

// ============================================
// ANALYTICS WORKER
// ============================================

function calculateProductivityMetrics(tasks: Task[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const completedTasks = tasks.filter(t => t.status === 'completed');
  
  // Completion rate
  const completionRate = tasks.length > 0 
    ? (completedTasks.length / tasks.length) * 100 
    : 0;

  // Tasks completed today
  const completedToday = completedTasks.filter(t => 
    t.completedAt && new Date(t.completedAt) >= today
  ).length;

  // This week
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const completedThisWeek = completedTasks.filter(t =>
    t.completedAt && new Date(t.completedAt) >= weekAgo
  ).length;

  // This month
  const monthAgo = new Date(today);
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  const completedThisMonth = completedTasks.filter(t =>
    t.completedAt && new Date(t.completedAt) >= monthAgo
  ).length;

  // Calculate streak
  const streakDays = calculateStreak(completedTasks);

  // Priority distribution
  const priorityDistribution = {
    low: tasks.filter(t => t.priority === 'low').length,
    medium: tasks.filter(t => t.priority === 'medium').length,
    high: tasks.filter(t => t.priority === 'high').length,
    critical: tasks.filter(t => t.priority === 'critical').length
  };

  // Best/worst day of week
  const dayStats = getDayOfWeekStats(completedTasks);
  const bestDay = Object.entries(dayStats).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Monday';
  const worstDay = Object.entries(dayStats).sort((a, b) => a[1] - b[1])[0]?.[0] || 'Sunday';

  return {
    completionRate: Math.round(completionRate * 100) / 100,
    averageCompletionTime: calculateAverageCompletionTime(completedTasks),
    tasksCompletedToday: completedToday,
    tasksCompletedThisWeek: completedThisWeek,
    tasksCompletedThisMonth: completedThisMonth,
    streakDays,
    bestDayOfWeek: bestDay,
    worstDayOfWeek: worstDay,
    priorityDistribution
  };
}

function calculateStreak(completedTasks: Task[]): number {
  if (completedTasks.length === 0) return 0;

  const dates = new Set(
    completedTasks
      .filter(t => t.completedAt)
      .map(t => new Date(t.completedAt!).toDateString())
  );

  let streak = 0;
  const today = new Date();
  
  for (let i = 0; i < 365; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    if (dates.has(date.toDateString())) {
      streak++;
    } else if (i > 0) {
      // Allow today to not be completed yet
      break;
    }
  }

  return streak;
}

function calculateAverageCompletionTime(completedTasks: Task[]): number {
  const tasksWithTimes = completedTasks.filter(
    t => t.createdAt && t.completedAt
  );

  if (tasksWithTimes.length === 0) return 0;

  const totalMinutes = tasksWithTimes.reduce((acc, task) => {
    const created = new Date(task.createdAt).getTime();
    const completed = new Date(task.completedAt!).getTime();
    return acc + (completed - created) / (1000 * 60);
  }, 0);

  return Math.round(totalMinutes / tasksWithTimes.length);
}

function getDayOfWeekStats(completedTasks: Task[]): Record<string, number> {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const stats: Record<string, number> = {};
  
  days.forEach(day => { stats[day] = 0; });

  completedTasks.forEach(task => {
    if (task.completedAt) {
      const dayIndex = new Date(task.completedAt).getDay();
      const day = days[dayIndex];
      if (day) {
        stats[day] = (stats[day] || 0) + 1;
      }
    }
  });

  return stats;
}

// ============================================
// MESSAGE HANDLER
// ============================================

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { type, payload, id } = e.data;

  try {
    let result: unknown;

    switch (type) {
      case 'SEARCH': {
        const { tasks, query, options } = payload as {
          tasks: Task[];
          query: string;
          options?: { fuzzy?: boolean; limit?: number };
        };
        result = searchTasks(tasks, query, options);
        break;
      }

      case 'ANALYZE': {
        const { tasks } = payload as { tasks: Task[] };
        result = calculateProductivityMetrics(tasks);
        break;
      }

      case 'SORT': {
        const { tasks, field, order } = payload as {
          tasks: Task[];
          field: keyof Task;
          order: 'asc' | 'desc';
        };
        result = [...tasks].sort((a, b) => {
          const aVal = a[field];
          const bVal = b[field];
          
          if (aVal === undefined || bVal === undefined) return 0;
          
          const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
          return order === 'asc' ? comparison : -comparison;
        });
        break;
      }

      // Note: FILTER case removed - can't serialize functions

      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    const response: WorkerResponse = {
      id,
      type,
      success: true,
      data: result
    };

    self.postMessage(response);
  } catch (error) {
    const response: WorkerResponse = {
      id,
      type,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };

    self.postMessage(response);
  }
};

console.log('[Worker] Search & Analytics worker initialized');
