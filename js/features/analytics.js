/**
 * Productivity Dashboard & Analytics Engine
 * ==========================================
 * Comprehensive task analytics and productivity insights
 * 
 * Features:
 * - Completion rate tracking
 * - Productivity trends
 * - Time-based analytics
 * - Priority distribution
 * - Streak analytics
 * - Weekly/monthly reports
 * - Interactive charts
 */

import { eventBus, AppEvents } from '../core/event-bus.js';

class AnalyticsEngine {
    constructor(taskRepository) {
        this.taskRepository = taskRepository;
        this.cache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
        this.lastCalculated = null;
    }

    /**
     * Get comprehensive analytics
     * @returns {Promise<Object>} Analytics data
     */
    async getAnalytics() {
        // Check cache
        const cached = this._getCached('fullAnalytics');
        if (cached) return cached;
        
        const tasks = await this.taskRepository.getAll();
        const now = new Date();
        
        const analytics = {
            overview: this._calculateOverview(tasks),
            completion: this._calculateCompletion(tasks, now),
            trends: this._calculateTrends(tasks, now),
            priority: this._calculatePriorityDistribution(tasks),
            timeAnalysis: this._calculateTimeAnalysis(tasks, now),
            categories: this._calculateCategoryStats(tasks),
            weeklyReport: this._generateWeeklyReport(tasks, now),
            insights: this._generateInsights(tasks, now)
        };
        
        // Cache results
        this._setCache('fullAnalytics', analytics);
        this.lastCalculated = now;
        
        return analytics;
    }

    /**
     * Calculate overview statistics
     * @private
     */
    _calculateOverview(tasks) {
        const total = tasks.length;
        const completed = tasks.filter(t => t.completed).length;
        const active = total - completed;
        const overdue = tasks.filter(t => 
            !t.completed && t.dueDate && new Date(t.dueDate) < new Date()
        ).length;
        
        return {
            total,
            completed,
            active,
            overdue,
            completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
            efficiency: this._calculateEfficiency(tasks)
        };
    }

    /**
     * Calculate efficiency score
     * @private
     */
    _calculateEfficiency(tasks) {
        if (tasks.length === 0) return 0;
        
        let score = 0;
        let factors = 0;
        
        // Completion rate factor
        const completed = tasks.filter(t => t.completed).length;
        const completionRate = completed / tasks.length;
        score += completionRate * 40;
        factors++;
        
        // On-time completion factor
        const onTime = tasks.filter(t => {
            if (!t.completed || !t.completedAt) return false;
            if (!t.dueDate) return true;
            return new Date(t.completedAt) <= new Date(t.dueDate);
        }).length;
        const onTimeRate = completed > 0 ? onTime / completed : 0;
        score += onTimeRate * 40;
        factors++;
        
        // Active task ratio factor
        const activeRatio = (tasks.length - completed) / tasks.length;
        score += (1 - activeRatio) * 20;
        factors++;
        
        return Math.round(score);
    }

    /**
     * Calculate completion statistics
     * @private
     */
    _calculateCompletion(tasks, now) {
        const completedTasks = tasks.filter(t => t.completed);
        
        // Today's completions
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const completedToday = completedTasks.filter(t => {
            if (!t.completedAt) return false;
            return new Date(t.completedAt) >= today;
        }).length;
        
        // This week's completions
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const completedThisWeek = completedTasks.filter(t => {
            if (!t.completedAt) return false;
            return new Date(t.completedAt) >= weekAgo;
        }).length;
        
        // This month's completions
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        const completedThisMonth = completedTasks.filter(t => {
            if (!t.completedAt) return false;
            return new Date(t.completedAt) >= monthAgo;
        }).length;
        
        // Average completion time
        const avgCompletionTime = this._calculateAverageCompletionTime(completedTasks);
        
        return {
            today: completedToday,
            thisWeek: completedThisWeek,
            thisMonth: completedThisMonth,
            averageCompletionTime: avgCompletionTime,
            dailyAverage: Math.round(completedThisWeek / 7 * 10) / 10
        };
    }

    /**
     * Calculate average completion time
     * @private
     */
    _calculateAverageCompletionTime(completedTasks) {
        const tasksWithTimes = completedTasks.filter(t => t.createdAt && t.completedAt);
        
        if (tasksWithTimes.length === 0) return null;
        
        const totalHours = tasksWithTimes.reduce((sum, task) => {
            const created = new Date(task.createdAt);
            const completed = new Date(task.completedAt);
            const hours = (completed - created) / (1000 * 60 * 60);
            return sum + Math.min(hours, 168); // Cap at 1 week
        }, 0);
        
        const avgHours = totalHours / tasksWithTimes.length;
        
        if (avgHours < 1) {
            return { value: Math.round(avgHours * 60), unit: 'minutes' };
        } else if (avgHours < 24) {
            return { value: Math.round(avgHours), unit: 'hours' };
        } else {
            return { value: Math.round(avgHours / 24), unit: 'days' };
        }
    }

    /**
     * Calculate productivity trends
     * @private
     */
    _calculateTrends(tasks, now) {
        const days = 14;
        const trend = [];
        
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const dayEnd = new Date(dayStart);
            dayEnd.setDate(dayEnd.getDate() + 1);
            
            const completed = tasks.filter(t => {
                if (!t.completedAt) return false;
                const completedDate = new Date(t.completedAt);
                return completedDate >= dayStart && completedDate < dayEnd;
            }).length;
            
            trend.push({
                date: dayStart.toISOString().split('T')[0],
                day: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
                completed
            });
        }
        
        // Calculate trend direction
        const firstHalf = trend.slice(0, 7).reduce((s, d) => s + d.completed, 0);
        const secondHalf = trend.slice(7).reduce((s, d) => s + d.completed, 0);
        const trendDirection = secondHalf > firstHalf ? 'up' : (secondHalf < firstHalf ? 'down' : 'stable');
        
        return {
            daily: trend,
            direction: trendDirection,
            changePercent: firstHalf > 0 ? Math.round(((secondHalf - firstHalf) / firstHalf) * 100) : 0
        };
    }

    /**
     * Calculate priority distribution
     * @private
     */
    _calculatePriorityDistribution(tasks) {
        const active = tasks.filter(t => !t.completed);
        
        return {
            high: {
                count: active.filter(t => t.priority === 'high').length,
                percentage: active.length > 0 ? Math.round((active.filter(t => t.priority === 'high').length / active.length) * 100) : 0
            },
            medium: {
                count: active.filter(t => t.priority === 'medium').length,
                percentage: active.length > 0 ? Math.round((active.filter(t => t.priority === 'medium').length / active.length) * 100) : 0
            },
            low: {
                count: active.filter(t => t.priority === 'low').length,
                percentage: active.length > 0 ? Math.round((active.filter(t => t.priority === 'low').length / active.length) * 100) : 0
            }
        };
    }

    /**
     * Calculate time-based analysis
     * @private
     */
    _calculateTimeAnalysis(tasks, now) {
        // Hourly completion distribution
        const hourlyDistribution = new Array(24).fill(0);
        const dailyDistribution = new Array(7).fill(0);
        
        tasks.filter(t => t.completed && t.completedAt).forEach(task => {
            const completed = new Date(task.completedAt);
            hourlyDistribution[completed.getHours()]++;
            dailyDistribution[completed.getDay()]++;
        });
        
        // Find peak hours
        const peakHour = hourlyDistribution.reduce((max, val, idx) => 
            val > max.val ? { val, idx } : max, { val: 0, idx: 0 }
        );
        
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const peakDay = dailyDistribution.reduce((max, val, idx) => 
            val > max.val ? { val, idx } : max, { val: 0, idx: 0 }
        );
        
        return {
            hourlyDistribution,
            dailyDistribution,
            peakHour: { hour: peakHour.idx, count: peakHour.val },
            peakDay: { day: dayNames[peakDay.idx], count: peakDay.val },
            morningProductivity: hourlyDistribution.slice(6, 12).reduce((a, b) => a + b, 0),
            afternoonProductivity: hourlyDistribution.slice(12, 18).reduce((a, b) => a + b, 0),
            eveningProductivity: hourlyDistribution.slice(18, 24).reduce((a, b) => a + b, 0)
        };
    }

    /**
     * Calculate category statistics
     * @private
     */
    _calculateCategoryStats(tasks) {
        const categoryCount = new Map();
        
        tasks.forEach(task => {
            if (task.categories && Array.isArray(task.categories)) {
                task.categories.forEach(cat => {
                    categoryCount.set(cat, (categoryCount.get(cat) || 0) + 1);
                });
            }
        });
        
        return Array.from(categoryCount.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }

    /**
     * Generate weekly report
     * @private
     */
    _generateWeeklyReport(tasks, now) {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        const weekTasks = tasks.filter(t => {
            const taskDate = new Date(t.createdAt);
            return taskDate >= weekAgo;
        });
        
        const completed = weekTasks.filter(t => t.completed).length;
        const created = weekTasks.length;
        
        // Best day
        const dayCounts = new Array(7).fill(0);
        weekTasks.filter(t => t.completed && t.completedAt).forEach(task => {
            const day = new Date(task.completedAt).getDay();
            dayCounts[day]++;
        });
        
        const bestDay = dayCounts.reduce((max, val, idx) => 
            val > max.val ? { val, idx } : max, { val: 0, idx: 0 }
        );
        
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        return {
            tasksCreated: created,
            tasksCompleted: completed,
            completionRate: created > 0 ? Math.round((completed / created) * 100) : 0,
            bestDay: { day: dayNames[bestDay.idx], count: bestDay.val },
            averagePerDay: Math.round(created / 7 * 10) / 10
        };
    }

    /**
     * Generate actionable insights
     * @private
     */
    _generateInsights(tasks, now) {
        const insights = [];
        const analytics = this._calculateOverview(tasks);
        
        // Overdue tasks insight
        const overdue = tasks.filter(t => 
            !t.completed && t.dueDate && new Date(t.dueDate) < now
        ).length;
        
        if (overdue > 3) {
            insights.push({
                type: 'warning',
                title: 'Overdue Tasks',
                message: `You have ${overdue} overdue tasks. Consider rescheduling or completing them.`,
                priority: 'high'
            });
        }
        
        // Low completion rate insight
        if (analytics.completionRate < 50 && tasks.length > 5) {
            insights.push({
                type: 'info',
                title: 'Completion Rate',
                message: `Your completion rate is ${analytics.completionRate}%. Try breaking tasks into smaller subtasks.`,
                priority: 'medium'
            });
        }
        
        // High priority overload
        const highPriority = tasks.filter(t => !t.completed && t.priority === 'high').length;
        if (highPriority > 5) {
            insights.push({
                type: 'warning',
                title: 'Priority Balance',
                message: `You have ${highPriority} high-priority tasks. Consider reprioritizing some to medium.`,
                priority: 'medium'
            });
        }
        
        // Productivity pattern insight
        const timeAnalysis = this._calculateTimeAnalysis(tasks, now);
        if (timeAnalysis.peakHour.count > 5) {
            insights.push({
                type: 'success',
                title: 'Peak Productivity',
                message: `You're most productive at ${this._formatHour(timeAnalysis.peakHour.hour)}. Schedule important tasks then!`,
                priority: 'low'
            });
        }
        
        // Streak encouragement
        if (analytics.completed > 0) {
            insights.push({
                type: 'success',
                title: 'Keep It Up!',
                message: `You've completed ${analytics.completed} tasks. Great progress!`,
                priority: 'low'
            });
        }
        
        return insights.sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
    }

    /**
     * Format hour for display
     * @private
     */
    _formatHour(hour) {
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
        return `${displayHour} ${period}`;
    }

    /**
     * Cache management
     * @private
     */
    _getCached(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        
        if (Date.now() - item.timestamp > this.cacheExpiry) {
            this.cache.delete(key);
            return null;
        }
        
        return item.data;
    }

    _setCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }
}

/**
 * Dashboard UI Renderer
 */
class DashboardRenderer {
    constructor(container) {
        this.container = container;
        this.analyticsEngine = null;
    }

    /**
     * Initialize dashboard
     */
    async render(analyticsEngine) {
        this.analyticsEngine = analyticsEngine;
        const analytics = await analyticsEngine.getAnalytics();
        
        this.container.innerHTML = `
            <div class="dashboard">
                ${this._renderOverview(analytics.overview)}
                ${this._renderCompletionStats(analytics.completion)}
                ${this._renderTrendChart(analytics.trends)}
                ${this._renderPriorityDistribution(analytics.priority)}
                ${this._renderTimeAnalysis(analytics.timeAnalysis)}
                ${this._renderInsights(analytics.insights)}
            </div>
        `;
    }

    _renderOverview(overview) {
        return `
            <div class="dashboard-section overview">
                <h3>Overview</h3>
                <div class="stats-grid">
                    <div class="stat-card">
                        <span class="stat-value">${overview.total}</span>
                        <span class="stat-label">Total Tasks</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">${overview.completed}</span>
                        <span class="stat-label">Completed</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">${overview.active}</span>
                        <span class="stat-label">Active</span>
                    </div>
                    <div class="stat-card ${overview.overdue > 0 ? 'warning' : ''}">
                        <span class="stat-value">${overview.overdue}</span>
                        <span class="stat-label">Overdue</span>
                    </div>
                </div>
                <div class="efficiency-meter">
                    <div class="efficiency-label">Efficiency Score</div>
                    <div class="efficiency-bar">
                        <div class="efficiency-fill" style="width: ${overview.efficiency}%"></div>
                    </div>
                    <span class="efficiency-value">${overview.efficiency}%</span>
                </div>
            </div>
        `;
    }

    _renderCompletionStats(completion) {
        return `
            <div class="dashboard-section completion">
                <h3>Completion Stats</h3>
                <div class="completion-grid">
                    <div class="completion-item">
                        <span class="completion-value">${completion.today}</span>
                        <span class="completion-label">Today</span>
                    </div>
                    <div class="completion-item">
                        <span class="completion-value">${completion.thisWeek}</span>
                        <span class="completion-label">This Week</span>
                    </div>
                    <div class="completion-item">
                        <span class="completion-value">${completion.thisMonth}</span>
                        <span class="completion-label">This Month</span>
                    </div>
                </div>
                ${completion.averageCompletionTime ? `
                    <p class="avg-completion">
                        Avg. completion time: ${completion.averageCompletionTime.value} ${completion.averageCompletionTime.unit}
                    </p>
                ` : ''}
            </div>
        `;
    }

    _renderTrendChart(trends) {
        const maxCompleted = Math.max(...trends.daily.map(d => d.completed), 1);
        
        return `
            <div class="dashboard-section trends">
                <h3>14-Day Trend ${trends.direction === 'up' ? '📈' : trends.direction === 'down' ? '📉' : '➡️'}</h3>
                <div class="trend-chart">
                    ${trends.daily.map(day => `
                        <div class="trend-bar-container">
                            <div class="trend-bar" style="height: ${(day.completed / maxCompleted) * 100}%"></div>
                            <span class="trend-day">${day.day}</span>
                            <span class="trend-value">${day.completed}</span>
                        </div>
                    `).join('')}
                </div>
                ${trends.changePercent !== 0 ? `
                    <p class="trend-summary">
                        ${trends.changePercent > 0 ? '+' : ''}${trends.changePercent}% vs previous week
                    </p>
                ` : ''}
            </div>
        `;
    }

    _renderPriorityDistribution(priority) {
        return `
            <div class="dashboard-section priority">
                <h3>Priority Distribution</h3>
                <div class="priority-bars">
                    <div class="priority-row">
                        <span class="priority-name high">High</span>
                        <div class="priority-bar-bg">
                            <div class="priority-bar high" style="width: ${priority.high.percentage}%"></div>
                        </div>
                        <span class="priority-count">${priority.high.count}</span>
                    </div>
                    <div class="priority-row">
                        <span class="priority-name medium">Medium</span>
                        <div class="priority-bar-bg">
                            <div class="priority-bar medium" style="width: ${priority.medium.percentage}%"></div>
                        </div>
                        <span class="priority-count">${priority.medium.count}</span>
                    </div>
                    <div class="priority-row">
                        <span class="priority-name low">Low</span>
                        <div class="priority-bar-bg">
                            <div class="priority-bar low" style="width: ${priority.low.percentage}%"></div>
                        </div>
                        <span class="priority-count">${priority.low.count}</span>
                    </div>
                </div>
            </div>
        `;
    }

    _renderTimeAnalysis(time) {
        const maxHour = Math.max(...time.hourlyDistribution, 1);
        
        return `
            <div class="dashboard-section time-analysis">
                <h3>Productivity Patterns</h3>
                <div class="hourly-chart">
                    ${time.hourlyDistribution.map((count, hour) => `
                        <div class="hour-bar-container" title="${hour}:00 - ${count} tasks">
                            <div class="hour-bar" style="height: ${(count / maxHour) * 100}%"></div>
                            ${hour % 3 === 0 ? `<span class="hour-label">${hour}</span>` : ''}
                        </div>
                    `).join('')}
                </div>
                <div class="peak-info">
                    <span>🏆 Peak: ${time.peakDay.day} at ${this._formatHour(time.peakHour.hour)}</span>
                </div>
            </div>
        `;
    }

    _renderInsights(insights) {
        if (insights.length === 0) return '';
        
        const icons = {
            warning: '⚠️',
            info: 'ℹ️',
            success: '✅'
        };
        
        return `
            <div class="dashboard-section insights">
                <h3>Insights</h3>
                <div class="insights-list">
                    ${insights.map(insight => `
                        <div class="insight-card ${insight.type}">
                            <span class="insight-icon">${icons[insight.type]}</span>
                            <div class="insight-content">
                                <strong>${insight.title}</strong>
                                <p>${insight.message}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    _formatHour(hour) {
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
        return `${displayHour}:${period}`;
    }
}

export { AnalyticsEngine, DashboardRenderer };
