/**
 * Analytics Dashboard - Charts and Statistics
 * ============================================
 * Visual insights into productivity patterns
 */

import { eventBus, EVENTS } from '../event-bus.js';

/**
 * Analytics Manager - Calculates and provides analytics data
 */
export class AnalyticsManager {
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.worker = null;
        this.initWorker();
    }

    /**
     * Initialize Web Worker for background calculations
     */
    initWorker() {
        if (typeof Worker !== 'undefined') {
            this.worker = new Worker('js/workers/search-worker.js');
            
            this.worker.onmessage = (e) => {
                const { type, stats } = e.data;
                if (type === 'STATS_RESULTS') {
                    eventBus.emit(EVENTS.ANALYTICS_UPDATED, { stats });
                }
            };
        }
    }

    /**
     * Get comprehensive analytics
     */
    getAnalytics() {
        const tasks = this.stateManager.getAllTasks();
        return this.calculateAnalytics(tasks);
    }

    /**
     * Calculate analytics from task data
     */
    calculateAnalytics(tasks) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Basic stats
        const total = tasks.length;
        const completed = tasks.filter(t => t.completed).length;
        const active = total - completed;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        // Overdue tasks
        const overdue = tasks.filter(t => 
            !t.completed && 
            t.dueDate && 
            new Date(t.dueDate) < today
        );

        // Due today/tomorrow
        const dueToday = tasks.filter(t => 
            !t.completed && 
            t.dueDate && 
            new Date(t.dueDate).toDateString() === today.toDateString()
        );

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dueTomorrow = tasks.filter(t => 
            !t.completed && 
            t.dueDate && 
            new Date(t.dueDate).toDateString() === tomorrow.toDateString()
        );

        // Priority breakdown
        const priorityBreakdown = {
            high: tasks.filter(t => t.priority === 'high' && !t.completed).length,
            medium: tasks.filter(t => t.priority === 'medium' && !t.completed).length,
            low: tasks.filter(t => t.priority === 'low' && !t.completed).length
        };

        // Category breakdown
        const categoryStats = {};
        tasks.forEach(task => {
            (task.categories || []).forEach(cat => {
                if (!categoryStats[cat]) {
                    categoryStats[cat] = { total: 0, completed: 0, overdue: 0 };
                }
                categoryStats[cat].total++;
                if (task.completed) categoryStats[cat].completed++;
                if (!task.completed && task.dueDate && new Date(task.dueDate) < today) {
                    categoryStats[cat].overdue++;
                }
            });
        });

        // Completion trend (last 30 days)
        const completionTrend = this.calculateCompletionTrend(tasks, 30);

        // Productivity score
        const productivityScore = this.calculateProductivityScore(tasks, completionTrend);

        // Best productivity day
        const bestDay = this.findBestProductivityDay(completionTrend);

        // Average tasks per day
        const avgTasksPerDay = this.calculateAverageTasksPerDay(tasks);

        // Streak calculation
        const currentStreak = this.calculateStreak(tasks, 'current');
        const longestStreak = this.calculateStreak(tasks, 'longest');

        return {
            overview: {
                total,
                completed,
                active,
                completionRate,
                overdueCount: overdue.length,
                dueTodayCount: dueToday.length,
                dueTomorrowCount: dueTomorrow.length
            },
            priority: priorityBreakdown,
            categories: categoryStats,
            trend: completionTrend,
            productivity: {
                score: productivityScore,
                bestDay,
                avgTasksPerDay,
                currentStreak,
                longestStreak
            },
            overdue: overdue.map(t => ({
                id: t.id,
                text: t.text,
                dueDate: t.dueDate,
                daysOverdue: this.getDaysOverdue(t.dueDate)
            })),
            dueSoon: [
                ...dueToday.map(t => ({ ...t, dueLabel: 'Today' })),
                ...dueTomorrow.map(t => ({ ...t, dueLabel: 'Tomorrow' }))
            ]
        };
    }

    /**
     * Calculate completion trend
     */
    calculateCompletionTrend(tasks, days = 30) {
        const trend = [];
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });

            // Tasks completed on this date
            const completed = tasks.filter(t => 
                t.completed && 
                t.completedAt && 
                t.completedAt.startsWith(dateStr)
            ).length;

            // Tasks created on this date
            const created = tasks.filter(t => 
                t.createdAt.startsWith(dateStr)
            ).length;

            trend.push({
                date: dateStr,
                day: dayName,
                completed,
                created
            });
        }

        return trend;
    }

    /**
     * Calculate productivity score (0-100)
     */
    calculateProductivityScore(tasks, trend) {
        let score = 50; // Base score

        // Completion rate factor (0-25 points)
        const completionRate = tasks.length > 0 
            ? (tasks.filter(t => t.completed).length / tasks.length) * 25 
            : 0;
        score += completionRate;

        // Consistency factor (0-15 points)
        const activeDays = trend.filter(d => d.completed > 0).length;
        const consistencyScore = (activeDays / trend.length) * 15;
        score += consistencyScore;

        // Recent activity factor (0-10 points)
        const recentCompleted = trend.slice(-7).reduce((sum, d) => sum + d.completed, 0);
        const recentScore = Math.min(10, recentCompleted / 2);
        score += recentScore;

        return Math.round(Math.min(100, Math.max(0, score)));
    }

    /**
     * Find best productivity day
     */
    findBestProductivityDay(trend) {
        const dayTotals = {};
        
        trend.forEach(d => {
            if (!dayTotals[d.day]) {
                dayTotals[d.day] = { total: 0, count: 0 };
            }
            dayTotals[d.day].total += d.completed;
            dayTotals[d.day].count++;
        });

        let bestDay = null;
        let bestAvg = 0;

        Object.entries(dayTotals).forEach(([day, data]) => {
            const avg = data.total / data.count;
            if (avg > bestAvg) {
                bestAvg = avg;
                bestDay = { day, avg: Math.round(avg * 10) / 10 };
            }
        });

        return bestDay;
    }

    /**
     * Calculate average tasks per day
     */
    calculateAverageTasksPerDay(tasks) {
        if (tasks.length === 0) return 0;

        const dates = tasks.map(t => new Date(t.createdAt).toDateString());
        const uniqueDates = new Set(dates);
        
        return Math.round((tasks.length / uniqueDates.size) * 10) / 10;
    }

    /**
     * Calculate streak
     */
    calculateStreak(tasks, type = 'current') {
        const completedDates = tasks
            .filter(t => t.completed && t.completedAt)
            .map(t => new Date(t.completedAt).toDateString());
        
        const uniqueDates = [...new Set(completedDates)].sort((a, b) => 
            new Date(a) - new Date(b)
        );

        if (uniqueDates.length === 0) return 0;

        if (type === 'longest') {
            return this.findLongestStreak(uniqueDates);
        }

        return this.findCurrentStreak(uniqueDates);
    }

    /**
     * Find current streak
     */
    findCurrentStreak(dates) {
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        
        // Check if streak is active (completed today or yesterday)
        if (!dates.includes(today) && !dates.includes(yesterday)) {
            return 0;
        }

        let streak = 0;
        let currentDate = new Date();

        // Count backwards from today
        while (true) {
            const dateStr = currentDate.toDateString();
            if (dates.includes(dateStr)) {
                streak++;
                currentDate.setDate(currentDate.getDate() - 1);
            } else if (currentDate.toDateString() === new Date().toDateString()) {
                // Today not completed yet, but streak continues if yesterday was
                currentDate.setDate(currentDate.getDate() - 1);
            } else {
                break;
            }
        }

        return streak;
    }

    /**
     * Find longest streak
     */
    findLongestStreak(dates) {
        if (dates.length === 0) return 0;

        let longest = 1;
        let current = 1;

        for (let i = 1; i < dates.length; i++) {
            const prevDate = new Date(dates[i - 1]);
            const currDate = new Date(dates[i]);
            const diffDays = Math.round((currDate - prevDate) / 86400000);

            if (diffDays <= 2) { // Allow 1 day gap
                current++;
                longest = Math.max(longest, current);
            } else {
                current = 1;
            }
        }

        return longest;
    }

    /**
     * Get days overdue
     */
    getDaysOverdue(dueDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(dueDate);
        const diff = today - due;
        return Math.ceil(diff / 86400000);
    }

    /**
     * Get weekly summary
     */
    getWeeklySummary() {
        const tasks = this.stateManager.getAllTasks();
        const now = new Date();
        const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

        const thisWeek = tasks.filter(t => 
            new Date(t.createdAt) >= weekAgo
        );

        const completedThisWeek = thisWeek.filter(t => 
            t.completed && 
            t.completedAt && 
            new Date(t.completedAt) >= weekAgo
        );

        return {
            created: thisWeek.length,
            completed: completedThisWeek.length,
            completionRate: thisWeek.length > 0 
                ? Math.round((completedThisWeek.length / thisWeek.length) * 100) 
                : 0
        };
    }

    /**
     * Get monthly summary
     */
    getMonthlySummary() {
        const tasks = this.stateManager.getAllTasks();
        const now = new Date();
        const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

        const thisMonth = tasks.filter(t => 
            new Date(t.createdAt) >= monthAgo
        );

        const completedThisMonth = thisMonth.filter(t => 
            t.completed && 
            t.completedAt && 
            new Date(t.completedAt) >= monthAgo
        );

        return {
            created: thisMonth.length,
            completed: completedThisMonth.length,
            completionRate: thisMonth.length > 0 
                ? Math.round((completedThisMonth.length / thisMonth.length) * 100) 
                : 0
        };
    }
}

/**
 * Chart Renderer - Creates visual charts
 */
export class ChartRenderer {
    constructor() {
        this.colors = {
            primary: '#6366f1',
            success: '#22c55e',
            warning: '#f59e0b',
            danger: '#ef4444',
            info: '#3b82f6',
            purple: '#8b5cf6',
            pink: '#ec4899'
        };
    }

    /**
     * Render a bar chart
     */
    renderBarChart(container, data, options = {}) {
        const {
            width = 400,
            height = 200,
            barColor = this.colors.primary,
            showLabels = true,
            showValues = true
        } = options;

        const maxValue = Math.max(...data.map(d => d.value));
        const barWidth = (width - 40) / data.length - 10;
        const chartHeight = height - 40;

        let svg = `<svg width="${width}" height="${height}" class="bar-chart">`;
        
        // Bars
        data.forEach((d, i) => {
            const x = 40 + i * (barWidth + 10);
            const barHeight = maxValue > 0 ? (d.value / maxValue) * chartHeight : 0;
            const y = height - 20 - barHeight;

            svg += `
                <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" 
                      fill="${barColor}" rx="4" class="chart-bar">
                    <title>${d.label}: ${d.value}</title>
                </rect>
            `;

            if (showLabels) {
                svg += `
                    <text x="${x + barWidth/2}" y="${height - 5}" 
                          text-anchor="middle" font-size="10" fill="var(--text-secondary)">
                        ${d.label}
                    </text>
                `;
            }

            if (showValues && d.value > 0) {
                svg += `
                    <text x="${x + barWidth/2}" y="${y - 5}" 
                          text-anchor="middle" font-size="10" fill="var(--text-primary)">
                        ${d.value}
                    </text>
                `;
            }
        });

        svg += '</svg>';
        return svg;
    }

    /**
     * Render a line chart
     */
    renderLineChart(container, data, options = {}) {
        const {
            width = 400,
            height = 200,
            lineColor = this.colors.primary,
            fillColor = 'rgba(99, 102, 241, 0.1)',
            showPoints = true
        } = options;

        const maxValue = Math.max(...data.map(d => d.value), 1);
        const chartWidth = width - 40;
        const chartHeight = height - 40;
        const stepX = chartWidth / (data.length - 1 || 1);

        // Generate path
        let path = '';
        let fillPath = '';
        
        data.forEach((d, i) => {
            const x = 40 + i * stepX;
            const y = height - 20 - (d.value / maxValue) * chartHeight;
            
            if (i === 0) {
                path += `M ${x} ${y}`;
                fillPath += `M ${x} ${height - 20} L ${x} ${y}`;
            } else {
                path += ` L ${x} ${y}`;
                fillPath += ` L ${x} ${y}`;
            }
        });

        fillPath += ` L ${40 + (data.length - 1) * stepX} ${height - 20} Z`;

        let svg = `<svg width="${width}" height="${height}" class="line-chart">`;
        
        // Fill area
        svg += `<path d="${fillPath}" fill="${fillColor}" />`;
        
        // Line
        svg += `<path d="${path}" stroke="${lineColor}" stroke-width="2" fill="none" />`;

        // Points
        if (showPoints) {
            data.forEach((d, i) => {
                const x = 40 + i * stepX;
                const y = height - 20 - (d.value / maxValue) * chartHeight;
                svg += `<circle cx="${x}" cy="${y}" r="4" fill="${lineColor}" />`;
            });
        }

        svg += '</svg>';
        return svg;
    }

    /**
     * Render a donut chart
     */
    renderDonutChart(data, options = {}) {
        const {
            size = 200,
            strokeWidth = 20
        } = options;

        const radius = (size - strokeWidth) / 2;
        const circumference = 2 * Math.PI * radius;
        const total = data.reduce((sum, d) => sum + d.value, 0);

        let svg = `<svg width="${size}" height="${size}" class="donut-chart" viewBox="0 0 ${size} ${size}">`;
        
        // Background circle
        svg += `<circle cx="${size/2}" cy="${size/2}" r="${radius}" 
                       fill="none" stroke="var(--bg-tertiary)" stroke-width="${strokeWidth}" />`;

        // Data segments
        let offset = 0;
        data.forEach((d, i) => {
            const segmentLength = (d.value / total) * circumference;
            const dashArray = `${segmentLength} ${circumference - segmentLength}`;
            
            svg += `
                <circle cx="${size/2}" cy="${size/2}" r="${radius}" 
                        fill="none" stroke="${d.color}" stroke-width="${strokeWidth}"
                        stroke-dasharray="${dashArray}" stroke-dashoffset="${-offset}"
                        transform="rotate(-90 ${size/2} ${size/2})">
                    <title>${d.label}: ${d.value} (${Math.round(d.value/total*100)}%)</title>
                </circle>
            `;
            
            offset += segmentLength;
        });

        // Center text
        svg += `
            <text x="${size/2}" y="${size/2 - 10}" text-anchor="middle" 
                  font-size="24" font-weight="bold" fill="var(--text-primary)">
                ${total}
            </text>
            <text x="${size/2}" y="${size/2 + 15}" text-anchor="middle" 
                  font-size="12" fill="var(--text-secondary)">
                Total
            </text>
        `;

        svg += '</svg>';
        return svg;
    }

    /**
     * Render progress bar
     */
    renderProgressBar(percentage, options = {}) {
        const {
            width = 300,
            height = 8,
            color = this.colors.primary,
            showLabel = true
        } = options;

        let html = `
            <div class="progress-bar-container" style="width: ${width}px;">
                <div class="progress-bar" style="width: ${width}px; height: ${height}px;">
                    <div class="progress-fill" style="width: ${percentage}%; background: ${color};"></div>
                </div>
        `;

        if (showLabel) {
            html += `<span class="progress-label">${percentage}%</span>`;
        }

        html += '</div>';
        return html;
    }

    /**
     * Render stats cards
     */
    renderStatsCards(stats) {
        return `
            <div class="stats-grid">
                ${this.renderStatCard('Total Tasks', stats.total, '📋', this.colors.primary)}
                ${this.renderStatCard('Completed', stats.completed, '✅', this.colors.success)}
                ${this.renderStatCard('Active', stats.active, '⏳', this.colors.warning)}
                ${this.renderStatCard('Overdue', stats.overdueCount, '⚠️', this.colors.danger)}
            </div>
        `;
    }

    /**
     * Render single stat card
     */
    renderStatCard(label, value, icon, color) {
        return `
            <div class="stat-card" style="border-left-color: ${color}">
                <div class="stat-icon" style="background: ${color}20">${icon}</div>
                <div class="stat-info">
                    <span class="stat-value">${value}</span>
                    <span class="stat-label">${label}</span>
                </div>
            </div>
        `;
    }
}

/**
 * Analytics Dashboard UI Component
 */
export class AnalyticsDashboard {
    constructor(analyticsManager) {
        this.analyticsManager = analyticsManager;
        this.chartRenderer = new ChartRenderer();
        this.container = null;
    }

    /**
     * Initialize dashboard
     */
    init(containerSelector) {
        this.container = document.querySelector(containerSelector);
        if (!this.container) return;

        this.render();
        
        // Auto-refresh on data change
        eventBus.on(EVENTS.TASKS_CHANGED, () => this.render());
    }

    /**
     * Render full dashboard
     */
    render() {
        if (!this.container) return;

        const analytics = this.analyticsManager.getAnalytics();
        const weeklySummary = this.analyticsManager.getWeeklySummary();
        const monthlySummary = this.analyticsManager.getMonthlySummary();

        this.container.innerHTML = `
            <div class="analytics-dashboard">
                <h2 class="dashboard-title">📊 Analytics Dashboard</h2>
                
                ${this.chartRenderer.renderStatsCards(analytics.overview)}

                <div class="analytics-section">
                    <h3>Productivity Score</h3>
                    <div class="productivity-score ${this.getScoreClass(analytics.productivity.score)}">
                        ${this.chartRenderer.renderDonutChart([
                            { value: analytics.productivity.score, color: this.getColorForScore(analytics.productivity.score) },
                            { value: 100 - analytics.productivity.score, color: 'var(--bg-tertiary)' }
                        ], { size: 150, strokeWidth: 15 })}
                    </div>
                    <p class="score-description">${this.getScoreDescription(analytics.productivity.score)}</p>
                </div>

                <div class="analytics-section">
                    <h3>Completion Trend (30 Days)</h3>
                    ${this.chartRenderer.renderLineChart(
                        analytics.trend.map(d => ({ label: d.day, value: d.completed })),
                        { lineColor: this.colors.success, fillColor: 'rgba(34, 197, 94, 0.1)' }
                    )}
                </div>

                <div class="analytics-section">
                    <h3>Tasks by Priority</h3>
                    ${this.chartRenderer.renderBarChart(
                        [
                            { label: 'High', value: analytics.priority.high },
                            { label: 'Medium', value: analytics.priority.medium },
                            { label: 'Low', value: analytics.priority.low }
                        ],
                        { barColor: this.colors.danger }
                    )}
                </div>

                <div class="analytics-grid">
                    <div class="analytics-card">
                        <h4>🔥 Current Streak</h4>
                        <p class="big-number">${analytics.productivity.currentStreak} days</p>
                    </div>
                    <div class="analytics-card">
                        <h4>🏆 Longest Streak</h4>
                        <p class="big-number">${analytics.productivity.longestStreak} days</p>
                    </div>
                    <div class="analytics-card">
                        <h4>📈 Avg Tasks/Day</h4>
                        <p class="big-number">${analytics.productivity.avgTasksPerDay}</p>
                    </div>
                    <div class="analytics-card">
                        <h4>⭐ Best Day</h4>
                        <p class="big-number">${analytics.productivity.bestDay?.day || 'N/A'}</p>
                    </div>
                </div>

                ${analytics.overdue.length > 0 ? `
                    <div class="analytics-section warning">
                        <h3>⚠️ Overdue Tasks (${analytics.overdue.length})</h3>
                        <ul class="overdue-list">
                            ${analytics.overdue.map(t => `
                                <li>
                                    <span>${t.text}</span>
                                    <span class="overdue-days">${t.daysOverdue}d overdue</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}

                ${analytics.dueSoon.length > 0 ? `
                    <div class="analytics-section info">
                        <h3>📅 Due Soon</h3>
                        <ul class="due-soon-list">
                            ${analytics.dueSoon.map(t => `
                                <li>
                                    <span>${t.text}</span>
                                    <span class="due-label ${t.dueLabel === 'Today' ? 'urgent' : ''}">${t.dueLabel}</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;
    }

    getScoreClass(score) {
        if (score >= 80) return 'excellent';
        if (score >= 60) return 'good';
        if (score >= 40) return 'average';
        return 'needs-improvement';
    }

    getColorForScore(score) {
        if (score >= 80) return this.chartRenderer.colors.success;
        if (score >= 60) return this.chartRenderer.colors.warning;
        return this.chartRenderer.colors.danger;
    }

    getScoreDescription(score) {
        if (score >= 80) return 'Excellent! You\'re highly productive!';
        if (score >= 60) return 'Good job! Keep it up!';
        if (score >= 40) return 'Average. Room for improvement.';
        return 'Let\'s work on your productivity!';
    }
}
