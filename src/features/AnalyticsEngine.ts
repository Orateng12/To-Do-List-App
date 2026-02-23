/**
 * Analytics Dashboard Module
 * ===========================
 * Comprehensive productivity analytics with D3.js-style data processing
 */

import type { Task, Priority, Analytics, ProductivityMetrics, TrendData, DailyTrend, GoalProgress } from '../types';

export interface AnalyticsData {
  metrics: ProductivityMetrics;
  trends: TrendData;
  goals: GoalProgress[];
  heatmap: HeatmapData;
  categories: CategoryAnalytics[];
  priorities: PriorityAnalytics[];
}

export interface HeatmapData {
  dates: Record<string, number>;
  maxCount: number;
}

export interface CategoryAnalytics {
  name: string;
  total: number;
  completed: number;
  completionRate: number;
  averageCompletionTime: number;
}

export interface PriorityAnalytics {
  priority: Priority;
  total: number;
  completed: number;
  completionRate: number;
  overdue: number;
}

export interface TimeDistribution {
  hour: number;
  tasksCreated: number;
  tasksCompleted: number;
}

export class AnalyticsEngine {
  /**
   * Calculate comprehensive analytics
   */
  calculate(tasks: Task[]): AnalyticsData {
    return {
      metrics: this.calculateMetrics(tasks),
      trends: this.calculateTrends(tasks),
      goals: this.calculateGoals(tasks),
      heatmap: this.calculateHeatmap(tasks),
      categories: this.calculateCategoryAnalytics(tasks),
      priorities: this.calculatePriorityAnalytics(tasks)
    };
  }

  /**
   * Calculate productivity metrics
   */
  private calculateMetrics(tasks: Task[]): ProductivityMetrics {
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const totalTasks = tasks.length;
    
    // Completion rate
    const completionRate = totalTasks > 0 
      ? (completedTasks.length / totalTasks) * 100 
      : 0;

    // Average completion time (in hours)
    const averageCompletionTime = this.calculateAverageCompletionTime(completedTasks);

    // Tasks completed today
    const today = new Date().toDateString();
    const tasksCompletedToday = completedTasks.filter(t => 
      t.completedAt && new Date(t.completedAt).toDateString() === today
    ).length;

    // This week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const tasksCompletedThisWeek = completedTasks.filter(t =>
      t.completedAt && new Date(t.completedAt) >= weekAgo
    ).length;

    // This month
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const tasksCompletedThisMonth = completedTasks.filter(t =>
      t.completedAt && new Date(t.completedAt) >= monthAgo
    ).length;

    // Streak calculation
    const streakDays = this.calculateStreak(completedTasks);

    // Best/worst day of week
    const dayStats = this.getDayOfWeekStats(completedTasks);
    const sortedDays = Object.entries(dayStats).sort((a, b) => b[1] - a[1]);
    const bestDayOfWeek = sortedDays[0]?.[0] || 'Monday';
    const worstDayOfWeek = sortedDays[sortedDays.length - 1]?.[0] || 'Sunday';

    // Priority distribution
    const priorityDistribution: Record<Priority, number> = {
      low: tasks.filter(t => t.priority === 'low').length,
      medium: tasks.filter(t => t.priority === 'medium').length,
      high: tasks.filter(t => t.priority === 'high').length,
      critical: tasks.filter(t => t.priority === 'critical').length
    };

    // Category distribution
    const categoryDistribution: Record<string, number> = {};
    tasks.forEach(task => {
      task.categories?.forEach(cat => {
        categoryDistribution[cat] = (categoryDistribution[cat] || 0) + 1;
      });
    });

    return {
      completionRate: Math.round(completionRate * 100) / 100,
      averageCompletionTime,
      tasksCompletedToday,
      tasksCompletedThisWeek,
      tasksCompletedThisMonth,
      streakDays,
      bestDayOfWeek,
      worstDayOfWeek,
      priorityDistribution,
      categoryDistribution
    };
  }

  /**
   * Calculate trend data
   */
  private calculateTrends(tasks: Task[]): TrendData {
    return {
      daily: this.calculateDailyTrend(tasks),
      weekly: this.calculateWeeklyTrend(tasks),
      monthly: this.calculateMonthlyTrend(tasks)
    };
  }

  /**
   * Calculate daily trend (last 30 days)
   */
  private calculateDailyTrend(tasks: Task[]): DailyTrend[] {
    const daily: DailyTrend[] = [];
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));
      
      const completed = tasks.filter(t => 
        t.status === 'completed' && 
        t.completedAt &&
        new Date(t.completedAt) >= dayStart && 
        new Date(t.completedAt) <= dayEnd
      ).length;
      
      const created = tasks.filter(t => 
        new Date(t.createdAt) >= dayStart && 
        new Date(t.createdAt) <= dayEnd
      ).length;
      
      const overdue = tasks.filter(t => 
        t.status !== 'completed' &&
        t.dueDate &&
        new Date(t.dueDate) < dayStart
      ).length;
      
      daily.push({
        date: dateStr,
        completed,
        created,
        overdue
      });
    }
    
    return daily;
  }

  /**
   * Calculate weekly trend (last 12 weeks)
   */
  private calculateWeeklyTrend(tasks: Task[]): { week: string; completed: number; completionRate: number }[] {
    const weekly: { week: string; completed: number; completionRate: number }[] = [];
    const today = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - (i * 7) - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      
      const weekTasks = tasks.filter(t => 
        new Date(t.createdAt) >= weekStart && 
        new Date(t.createdAt) <= weekEnd
      );
      
      const completed = weekTasks.filter(t => 
        t.status === 'completed' &&
        t.completedAt &&
        new Date(t.completedAt) >= weekStart && 
        new Date(t.completedAt) <= weekEnd
      ).length;
      
      const completionRate = weekTasks.length > 0 
        ? (completed / weekTasks.length) * 100 
        : 0;
      
      weekly.push({
        week: weekStart.toISOString().split('T')[0],
        completed,
        completionRate: Math.round(completionRate * 100) / 100
      });
    }
    
    return weekly;
  }

  /**
   * Calculate monthly trend (last 12 months)
   */
  private calculateMonthlyTrend(tasks: Task[]): { month: string; completed: number; averageDaily: number }[] {
    const monthly: { month: string; completed: number; averageDaily: number }[] = [];
    const today = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthStr = monthDate.toISOString().slice(0, 7); // YYYY-MM
      
      const monthStart = new Date(monthDate);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);
      
      const completed = tasks.filter(t => 
        t.status === 'completed' &&
        t.completedAt &&
        new Date(t.completedAt) >= monthStart && 
        new Date(t.completedAt) <= monthEnd
      ).length;
      
      const daysInMonth = monthEnd.getDate();
      const averageDaily = completed / daysInMonth;
      
      monthly.push({
        month: monthStr,
        completed,
        averageDaily: Math.round(averageDaily * 100) / 100
      });
    }
    
    return monthly;
  }

  /**
   * Calculate goal progress
   */
  private calculateGoals(tasks: Task[]): GoalProgress[] {
    const goals: GoalProgress[] = [];
    const today = new Date();
    
    // Daily tasks goal
    const todayCompleted = tasks.filter(t => 
      t.status === 'completed' && 
      t.completedAt &&
      new Date(t.completedAt).toDateString() === today.toDateString()
    ).length;
    
    goals.push({
      id: 'daily-tasks',
      name: 'Daily Tasks',
      target: 5,
      current: todayCompleted,
      progress: Math.min((todayCompleted / 5) * 100, 100),
      onTrack: todayCompleted >= 3
    });
    
    // Weekly completion goal
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekCompleted = tasks.filter(t => 
      t.status === 'completed' && 
      t.completedAt &&
      new Date(t.completedAt) >= weekAgo
    ).length;
    
    goals.push({
      id: 'weekly-completion',
      name: 'Weekly Completion',
      target: 20,
      current: weekCompleted,
      deadline: new Date(today.setDate(today.getDate() + (7 - today.getDay()))).toISOString(),
      progress: Math.min((weekCompleted / 20) * 100, 100),
      onTrack: weekCompleted >= 10
    });
    
    // Streak goal
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const streakDays = this.calculateStreak(completedTasks);
    
    goals.push({
      id: 'streak-goal',
      name: '7-Day Streak',
      target: 7,
      current: streakDays,
      progress: Math.min((streakDays / 7) * 100, 100),
      onTrack: streakDays >= 5
    });
    
    return goals;
  }

  /**
   * Calculate heatmap data for contribution graph
   */
  private calculateHeatmap(tasks: Task[]): HeatmapData {
    const dates: Record<string, number> = {};
    const today = new Date();
    
    // Initialize last 365 days
    for (let i = 364; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates[date.toISOString().split('T')[0]] = 0;
    }
    
    // Count completed tasks per day
    tasks.filter(t => t.status === 'completed' && t.completedAt).forEach(task => {
      const dateStr = new Date(task.completedAt!).toISOString().split('T')[0];
      if (dates[dateStr] !== undefined) {
        dates[dateStr]++;
      }
    });
    
    const maxCount = Math.max(...Object.values(dates), 1);
    
    return { dates, maxCount };
  }

  /**
   * Calculate category analytics
   */
  private calculateCategoryAnalytics(tasks: Task[]): CategoryAnalytics[] {
    const categoryMap = new Map<string, { total: number; completed: number; completionTimes: number[] }>();
    
    tasks.forEach(task => {
      task.categories?.forEach(category => {
        const data = categoryMap.get(category) || { total: 0, completed: 0, completionTimes: [] };
        data.total++;
        
        if (task.status === 'completed' && task.completedAt) {
          data.completed++;
          const completionTime = (new Date(task.completedAt).getTime() - new Date(task.createdAt).getTime()) / (1000 * 60 * 60);
          data.completionTimes.push(completionTime);
        }
        
        categoryMap.set(category, data);
      });
    });
    
    return Array.from(categoryMap.entries()).map(([name, data]) => ({
      name,
      total: data.total,
      completed: data.completed,
      completionRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) / 100 : 0,
      averageCompletionTime: data.completionTimes.length > 0 
        ? Math.round(data.completionTimes.reduce((a, b) => a + b, 0) / data.completionTimes.length) 
        : 0
    }));
  }

  /**
   * Calculate priority analytics
   */
  private calculatePriorityAnalytics(tasks: Task[]): PriorityAnalytics[] {
    const priorities: Priority[] = ['low', 'medium', 'high', 'critical'];
    const now = new Date();
    
    return priorities.map(priority => {
      const priorityTasks = tasks.filter(t => t.priority === priority);
      const completed = priorityTasks.filter(t => t.status === 'completed').length;
      const overdue = priorityTasks.filter(t => 
        t.status !== 'completed' && 
        t.dueDate && 
        new Date(t.dueDate) < now
      ).length;
      
      return {
        priority,
        total: priorityTasks.length,
        completed,
        completionRate: priorityTasks.length > 0 ? Math.round((completed / priorityTasks.length) * 100) / 100 : 0,
        overdue
      };
    });
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  private calculateAverageCompletionTime(completedTasks: Task[]): number {
    if (completedTasks.length === 0) return 0;
    
    const tasksWithTimes = completedTasks.filter(t => t.createdAt && t.completedAt);
    if (tasksWithTimes.length === 0) return 0;
    
    const totalHours = tasksWithTimes.reduce((acc, task) => {
      const created = new Date(task.createdAt).getTime();
      const completed = new Date(task.completedAt!).getTime();
      return acc + (completed - created) / (1000 * 60 * 60);
    }, 0);
    
    return Math.round(totalHours / tasksWithTimes.length);
  }

  private calculateStreak(completedTasks: Task[]): number {
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

  private getDayOfWeekStats(completedTasks: Task[]): Record<string, number> {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const stats: Record<string, number> = {};
    days.forEach(day => { stats[day] = 0; });
    
    completedTasks.forEach(task => {
      if (task.completedAt) {
        const day = days[new Date(task.completedAt).getDay()];
        stats[day]++;
      }
    });
    
    return stats;
  }
}

// Singleton instance
export const analyticsEngine = new AnalyticsEngine();
