/**
 * Advanced Analytics Dashboard
 * =============================
 * 
 * Comprehensive productivity analytics with interactive visualizations
 * 
 * Features:
 * - Task completion trends
 * - Productivity heatmaps
 * - Category breakdown
 * - Time analysis
 * - Goal tracking
 * - Performance metrics
 */

import { eventBus, AppEvents } from '../core/event-bus.js';

// ============================================
// ANALYTICS ENGINE - Core Calculations
// ============================================
class AnalyticsEngine {
    constructor(taskRepository) {
        this.taskRepository = taskRepository;
    }

    /**
     * Get comprehensive analytics
     */
    async getAnalytics(dateRange = 'all') {
        const tasks = await this.taskRepository.getAll();
        const filtered = this._filterByDateRange(tasks, dateRange);

        return {
            overview: this._calculateOverview(filtered),
            trends: this._calculateTrends(filtered),
            categories: this._calculateCategoryStats(filtered),
            priorities: this._calculatePriorityStats(filtered),
            timeAnalysis: this._calculateTimeAnalysis(filtered),
            productivity: this._calculateProductivityMetrics(filtered),
            goals: this._calculateGoalProgress(filtered)
        };
    }

    /**
     * Get task completion trends
     */
    async getCompletionTrends(days = 30) {
        const tasks = await this.taskRepository.getAll();
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        const trends = [];

        for (let i = days - 1; i >= 0; i--) {
            const dayStart = now - (i * dayMs);
            const dayEnd = dayStart + dayMs;
            
            const completed = tasks.filter(t => 
                t.completed && 
                t.completedAt &&
                new Date(t.completedAt).getTime() >= dayStart &&
                new Date(t.completedAt).getTime() < dayEnd
            ).length;

            const created = tasks.filter(t => 
                new Date(t.createdAt).getTime() >= dayStart &&
                new Date(t.createdAt).getTime() < dayEnd
            ).length;

            trends.push({
                date: new Date(dayStart).toISOString().split('T')[0],
                completed,
                created,
                ratio: created > 0 ? completed / created : 0
            });
        }

        return trends;
    }

    /**
     * Get productivity heatmap data
     */
    async getHeatmapData() {
        const tasks = await this.taskRepository.getAll();
        const completedTasks = tasks.filter(t => t.completed && t.completedAt);

        // Initialize heatmap (7 days x 24 hours)
        const heatmap = [];
        for (let day = 0; day < 7; day++) {
            heatmap[day] = new Array(24).fill(0);
        }

        // Fill heatmap
        for (const task of completedTasks) {
            const date = new Date(task.completedAt);
            const day = date.getDay();
            const hour = date.getHours();
            heatmap[day][hour]++;
        }

        return {
            heatmap,
            dayLabels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            hourLabels: Array.from({ length: 24 }, (_, i) => `${i}:00`)
        };
    }

    /**
     * Get category breakdown
     */
    async getCategoryBreakdown(dateRange = 'all') {
        const tasks = await this.taskRepository.getAll();
        const filtered = this._filterByDateRange(tasks, dateRange);

        const categoryStats = new Map();

        for (const task of filtered) {
            const categories = task.categories || ['uncategorized'];
            for (const category of categories) {
                if (!categoryStats.has(category)) {
                    categoryStats.set(category, { total: 0, completed: 0, pending: 0 });
                }
                const stats = categoryStats.get(category);
                stats.total++;
                if (task.completed) {
                    stats.completed++;
                } else {
                    stats.pending++;
                }
            }
        }

        return Array.from(categoryStats.entries()).map(([name, stats]) => ({
            name,
            ...stats,
            completionRate: stats.total > 0 ? stats.completed / stats.total : 0
        })).sort((a, b) => b.total - a.total);
    }

    /**
     * Get weekly summary
     */
    async getWeeklySummary() {
        const tasks = await this.taskRepository.getAll();
        const now = Date.now();
        const weekMs = 7 * 24 * 60 * 60 * 1000;
        const lastWeek = now - weekMs;

        const thisWeekTasks = tasks.filter(t => 
            new Date(t.createdAt).getTime() >= lastWeek
        );

        const completed = thisWeekTasks.filter(t => t.completed).length;
        const pending = thisWeekTasks.length - completed;

        // Compare to previous week
        const twoWeeksAgo = lastWeek - weekMs;
        const lastWeekTasks = tasks.filter(t => 
            new Date(t.createdAt).getTime() >= twoWeeksAgo &&
            new Date(t.createdAt).getTime() < lastWeek
        );
        const lastWeekCompleted = lastWeekTasks.filter(t => t.completed).length;

        const growth = lastWeekCompleted > 0 
            ? ((completed - lastWeekCompleted) / lastWeekCompleted) * 100 
            : 0;

        return {
            totalTasks: thisWeekTasks.length,
            completed,
            pending,
            completionRate: thisWeekTasks.length > 0 ? completed / thisWeekTasks.length : 0,
            growth: Math.round(growth * 100) / 100,
            trend: growth >= 0 ? 'up' : 'down'
        };
    }

    /**
     * Get streak information
     */
    async getStreakInfo() {
        const tasks = await this.taskRepository.getAll();
        const completedTasks = tasks
            .filter(t => t.completed && t.completedAt)
            .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

        // Group by date
        const dates = new Set();
        for (const task of completedTasks) {
            dates.add(new Date(task.completedAt).toDateString());
        }

        // Calculate current streak
        let currentStreak = 0;
        let currentStreakType = 'days';
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();

        if (dates.has(today) || dates.has(yesterday)) {
            const sortedDates = Array.from(dates)
                .map(d => new Date(d).getTime())
                .sort((a, b) => b - a);

            const dayMs = 24 * 60 * 60 * 1000;
            for (let i = 0; i < sortedDates.length - 1; i++) {
                const diff = (sortedDates[i] - sortedDates[i + 1]) / dayMs;
                if (diff <= 1.5) {
                    currentStreak++;
                } else {
                    break;
                }
            }
            currentStreak++; // Include first day
        }

        // Calculate best streak
        let bestStreak = 0;
        let streak = 0;
        const sortedDates = Array.from(dates)
            .map(d => new Date(d).getTime())
            .sort((a, b) => b - a);

        for (let i = 0; i < sortedDates.length - 1; i++) {
            const diff = (sortedDates[i] - sortedDates[i + 1]) / dayMs;
            if (diff <= 1.5) {
                streak++;
            } else {
                bestStreak = Math.max(bestStreak, streak);
                streak = 0;
            }
        }
        bestStreak = Math.max(bestStreak, streak + 1);

        return {
            currentStreak,
            currentStreakType,
            bestStreak,
            bestStreakType: 'days',
            totalCompletedDays: dates.size
        };
    }

    // ==================== Private Methods ====================

    _filterByDateRange(tasks, dateRange) {
        if (dateRange === 'all') return tasks;

        const now = Date.now();
        let cutoff;

        switch (dateRange) {
            case 'today':
                cutoff = new Date();
                cutoff.setHours(0, 0, 0, 0);
                break;
            case 'week':
                cutoff = new Date(now - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                cutoff = new Date(now - 30 * 24 * 60 * 60 * 1000);
                break;
            case 'year':
                cutoff = new Date(now - 365 * 24 * 60 * 60 * 1000);
                break;
            default:
                cutoff = new Date(dateRange);
        }

        return tasks.filter(t => new Date(t.createdAt) >= cutoff);
    }

    _calculateOverview(tasks) {
        const total = tasks.length;
        const completed = tasks.filter(t => t.completed).length;
        const pending = total - completed;
        const overdue = tasks.filter(t => 
            !t.completed && 
            t.dueDate && 
            new Date(t.dueDate) < new Date()
        ).length;

        return {
            total,
            completed,
            pending,
            overdue,
            completionRate: total > 0 ? Math.round((completed / total) * 10000) / 100 : 0
        };
    }

    _calculateTrends(tasks) {
        const byMonth = new Map();
        
        for (const task of tasks) {
            const month = new Date(task.createdAt).toISOString().slice(0, 7);
            if (!byMonth.has(month)) {
                byMonth.set(month, { total: 0, completed: 0 });
            }
            byMonth.get(month).total++;
            if (task.completed) {
                byMonth.get(month).completed++;
            }
        }

        return Array.from(byMonth.entries())
            .map(([month, data]) => ({ month, ...data }))
            .sort((a, b) => a.month.localeCompare(b.month));
    }

    _calculateCategoryStats(tasks) {
        const categories = new Map();

        for (const task of tasks) {
            for (const cat of (task.categories || ['uncategorized'])) {
                if (!categories.has(cat)) {
                    categories.set(cat, { total: 0, completed: 0 });
                }
                categories.get(cat).total++;
                if (task.completed) {
                    categories.get(cat).completed++;
                }
            }
        }

        return Array.from(categories.entries()).map(([name, data]) => ({
            name,
            ...data,
            completionRate: data.total > 0 ? data.completed / data.total : 0
        }));
    }

    _calculatePriorityStats(tasks) {
        const priorities = { high: 0, medium: 0, low: 0 };
        const completed = { high: 0, medium: 0, low: 0 };

        for (const task of tasks) {
            const priority = task.priority || 'medium';
            priorities[priority]++;
            if (task.completed) {
                completed[priority]++;
            }
        }

        return {
            distribution: priorities,
            completionRates: {
                high: priorities.high > 0 ? completed.high / priorities.high : 0,
                medium: priorities.medium > 0 ? completed.medium / priorities.medium : 0,
                low: priorities.low > 0 ? completed.low / priorities.low : 0
            }
        };
    }

    _calculateTimeAnalysis(tasks) {
        const byHour = new Array(24).fill(0);
        const byDay = new Array(7).fill(0);

        for (const task of tasks.filter(t => t.completed && t.completedAt)) {
            const date = new Date(t.completedAt);
            byHour[date.getHours()]++;
            byDay[date.getDay()]++;
        }

        return {
            byHour,
            byDay,
            peakHour: byHour.indexOf(Math.max(...byHour)),
            peakDay: byDay.indexOf(Math.max(...byDay))
        };
    }

    _calculateProductivityMetrics(tasks) {
        const completedTasks = tasks.filter(t => t.completed && t.completedAt);
        
        if (completedTasks.length === 0) {
            return {
                avgCompletionTime: 0,
                tasksPerDay: 0,
                consistency: 0
            };
        }

        // Calculate average completion time
        let totalCompletionTime = 0;
        let count = 0;
        for (const task of completedTasks) {
            if (task.completedAt && task.createdAt) {
                const time = (new Date(task.completedAt) - new Date(task.createdAt)) / (1000 * 60 * 60);
                totalCompletionTime += time;
                count++;
            }
        }

        // Calculate tasks per day
        const dateRange = tasks.reduce((range, t) => {
            const time = new Date(t.createdAt).getTime();
            return {
                min: Math.min(range.min, time),
                max: Math.max(range.max, time)
            };
        }, { min: Infinity, max: 0 });

        const days = Math.max(1, (dateRange.max - dateRange.min) / (1000 * 60 * 60 * 24));

        return {
            avgCompletionTime: count > 0 ? Math.round(totalCompletionTime / count) : 0,
            tasksPerDay: Math.round((completedTasks.length / days) * 100) / 100,
            consistency: this._calculateConsistency(completedTasks)
        };
    }

    _calculateConsistency(completedTasks) {
        // Calculate consistency score (0-100)
        const dates = new Set(completedTasks.map(t => 
            new Date(t.completedAt).toDateString()
        ));

        if (dates.size === 0) return 0;

        const sortedDates = Array.from(dates)
            .map(d => new Date(d).getTime())
            .sort((a, b) => a - b);

        const gaps = [];
        for (let i = 1; i < sortedDates.length; i++) {
            const gap = (sortedDates[i] - sortedDates[i - 1]) / (1000 * 60 * 60 * 24);
            gaps.push(gap);
        }

        if (gaps.length === 0) return 100;

        const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        const variance = gaps.reduce((sum, gap) => sum + Math.pow(gap - avgGap, 2), 0) / gaps.length;
        const stdDev = Math.sqrt(variance);

        // Lower stdDev = more consistent
        const consistency = Math.max(0, 100 - (stdDev * 20));
        return Math.round(consistency);
    }

    _calculateGoalProgress(tasks) {
        // Example: Goal to complete 100 tasks
        const completed = tasks.filter(t => t.completed).length;
        const goal = 100;

        return {
            goal,
            current: completed,
            progress: Math.min(1, completed / goal),
            remaining: Math.max(0, goal - completed)
        };
    }
}

// ============================================
// CHART RENDERER - SVG Chart Generation
// ============================================
class ChartRenderer {
    constructor(container) {
        this.container = typeof container === 'string' 
            ? document.querySelector(container) 
            : container;
    }

    /**
     * Render bar chart
     */
    renderBarChart(data, options = {}) {
        const {
            width = 400,
            height = 200,
            margin = { top: 20, right: 20, bottom: 40, left: 40 },
            colors = ['#6366f1', '#818cf8', '#a5b4fc'],
            showLabels = true
        } = options;

        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;

        const maxValue = Math.max(...data.map(d => d.value));
        const barWidth = chartWidth / data.length - 10;

        let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
        
        // Y-axis
        svg += `<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" stroke="var(--border-color)" />`;
        
        // X-axis
        svg += `<line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="var(--border-color)" />`;

        // Bars
        data.forEach((d, i) => {
            const barHeight = (d.value / maxValue) * chartHeight;
            const x = margin.left + i * (barWidth + 10) + 5;
            const y = height - margin.bottom - barHeight;
            const color = colors[i % colors.length];

            svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" rx="4" />`;

            if (showLabels) {
                svg += `<text x="${x + barWidth / 2}" y="${height - margin.bottom + 20}" text-anchor="middle" fill="var(--text-secondary)" font-size="10">${d.label}</text>`;
                svg += `<text x="${x + barWidth / 2}" y="${y - 5}" text-anchor="middle" fill="var(--text-primary)" font-size="10">${d.value}</text>`;
            }
        });

        svg += '</svg>';
        return svg;
    }

    /**
     * Render line chart
     */
    renderLineChart(data, options = {}) {
        const {
            width = 400,
            height = 200,
            margin = { top: 20, right: 20, bottom: 40, left: 40 },
            color = '#6366f1',
            showPoints = true
        } = options;

        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;

        const maxValue = Math.max(...data.map(d => d.value));
        const minValue = Math.min(...data.map(d => d.value));
        const range = maxValue - minValue || 1;

        const points = data.map((d, i) => ({
            x: margin.left + (i / (data.length - 1)) * chartWidth,
            y: height - margin.bottom - ((d.value - minValue) / range) * chartHeight,
            ...d
        }));

        let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
        
        // Grid lines
        for (let i = 0; i <= 4; i++) {
            const y = margin.top + (i / 4) * chartHeight;
            svg += `<line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="var(--border-color)" stroke-dasharray="4" opacity="0.5" />`;
        }

        // Line
        const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        svg += `<path d="${pathD}" fill="none" stroke="${color}" stroke-width="2" />`;

        // Points
        if (showPoints) {
            points.forEach(p => {
                svg += `<circle cx="${p.x}" cy="${p.y}" r="4" fill="${color}" />`;
            });
        }

        // Labels
        points.forEach((p, i) => {
            if (i % Math.ceil(points.length / 5) === 0) {
                svg += `<text x="${p.x}" y="${height - margin.bottom + 15}" text-anchor="middle" fill="var(--text-secondary)" font-size="10">${p.label}</text>`;
            }
        });

        svg += '</svg>';
        return svg;
    }

    /**
     * Render donut chart
     */
    renderDonutChart(data, options = {}) {
        const {
            width = 200,
            height = 200,
            colors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6'],
            showLabels = true
        } = options;

        const total = data.reduce((sum, d) => sum + d.value, 0);
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 2 - 20;
        const innerRadius = radius * 0.6;

        let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
        
        let currentAngle = -Math.PI / 2;

        data.forEach((d, i) => {
            const angle = (d.value / total) * 2 * Math.PI;
            const color = colors[i % colors.length];

            const x1 = centerX + radius * Math.cos(currentAngle);
            const y1 = centerY + radius * Math.sin(currentAngle);
            const x2 = centerX + radius * Math.cos(currentAngle + angle);
            const y2 = centerY + radius * Math.sin(currentAngle + angle);
            const x3 = centerX + innerRadius * Math.cos(currentAngle + angle);
            const y3 = centerY + innerRadius * Math.sin(currentAngle + angle);
            const x4 = centerX + innerRadius * Math.cos(currentAngle);
            const y4 = centerY + innerRadius * Math.sin(currentAngle);

            const largeArc = angle > Math.PI ? 1 : 0;

            const pathD = [
                `M ${x1} ${y1}`,
                `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
                `L ${x3} ${y3}`,
                `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}`,
                'Z'
            ].join(' ');

            svg += `<path d="${pathD}" fill="${color}" />`;

            currentAngle += angle;
        });

        // Center text
        svg += `<text x="${centerX}" y="${centerY - 10}" text-anchor="middle" fill="var(--text-primary)" font-size="24" font-weight="bold">${total}</text>`;
        svg += `<text x="${centerX}" y="${centerY + 15}" text-anchor="middle" fill="var(--text-secondary)" font-size="12">Total</text>`;

        svg += '</svg>';
        return svg;
    }

    /**
     * Render heatmap
     */
    renderHeatmap(data, options = {}) {
        const {
            cellSize = 15,
            cellGap = 2,
            colors = ['#1a1a1a', '#2d2d4a', '#4a4a6a', '#6366f1', '#818cf8', '#a5b4fc']
        } = options;

        const width = (24 * (cellSize + cellGap)) + 50;
        const height = (7 * (cellSize + cellGap)) + 30;

        let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;

        // Day labels
        data.dayLabels.forEach((label, i) => {
            svg += `<text x="45" y="${i * (cellSize + cellGap) + cellSize + 5}" fill="var(--text-secondary)" font-size="10">${label}</text>`;
        });

        // Hour labels
        for (let i = 0; i < 24; i += 4) {
            svg += `<text x="${50 + i * (cellSize + cellGap)}" y="15" fill="var(--text-secondary)" font-size="10" text-anchor="middle">${i}:00</text>`;
        }

        // Heatmap cells
        data.heatmap.forEach((row, dayIndex) => {
            row.forEach((value, hourIndex) => {
                const colorIndex = Math.min(colors.length - 1, Math.floor((value / 10) * colors.length));
                const color = colors[colorIndex];
                const x = 50 + hourIndex * (cellSize + cellGap);
                const y = dayIndex * (cellSize + cellGap);

                svg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${color}" rx="2" />`;
            });
        });

        svg += '</svg>';
        return svg;
    }

    render(container, chart) {
        if (typeof container === 'string') {
            container = document.querySelector(container);
        }
        container.innerHTML = chart;
    }
}

// ============================================
// ANALYTICS DASHBOARD - Main Component
// ============================================
class AnalyticsDashboard {
    constructor(taskRepository, container) {
        this.taskRepository = taskRepository;
        this.container = typeof container === 'string' 
            ? document.querySelector(container) 
            : container;
        
        this.engine = new AnalyticsEngine(taskRepository);
        this.chartRenderer = new ChartRenderer();
    }

    /**
     * Render full dashboard
     */
    async render(options = {}) {
        const { dateRange = 'all' } = options;
        
        const analytics = await this.engine.getAnalytics(dateRange);
        const trends = await this.engine.getCompletionTrends(14);
        const heatmap = await this.engine.getHeatmapData();
        const categories = await this.engine.getCategoryBreakdown(dateRange);
        const streak = await this.engine.getStreakInfo();
        const weekly = await this.engine.getWeeklySummary();

        const dashboard = `
            <div class="analytics-dashboard">
                ${this._renderOverviewCards(analytics.overview, weekly, streak)}
                ${this._renderCharts(trends, categories, heatmap, analytics)}
                ${this._renderInsights(analytics)}
            </div>
        `;

        if (this.container) {
            this.container.innerHTML = dashboard;
        }

        eventBus.emit('analytics:dashboard-rendered', { analytics, options });

        return dashboard;
    }

    /**
     * Export analytics as report
     */
    async exportReport(format = 'json') {
        const analytics = await this.engine.getAnalytics();
        const trends = await this.engine.getCompletionTrends(30);
        const streak = await this.engine.getStreakInfo();

        const report = {
            generatedAt: new Date().toISOString(),
            period: 'all',
            summary: {
                ...analytics.overview,
                streak
            },
            trends,
            detailed: analytics
        };

        if (format === 'json') {
            return JSON.stringify(report, null, 2);
        } else if (format === 'csv') {
            return this._toCSV(trends);
        }

        return report;
    }

    // ==================== Private Methods ====================

    _renderOverviewCards(overview, weekly, streak) {
        return `
            <div class="analytics-overview">
                <div class="analytics-card">
                    <div class="card-icon">📊</div>
                    <div class="card-content">
                        <div class="card-value">${overview.total}</div>
                        <div class="card-label">Total Tasks</div>
                    </div>
                </div>
                <div class="analytics-card">
                    <div class="card-icon">✅</div>
                    <div class="card-content">
                        <div class="card-value">${overview.completed}</div>
                        <div class="card-label">Completed</div>
                    </div>
                </div>
                <div class="analytics-card">
                    <div class="card-icon">📈</div>
                    <div class="card-content">
                        <div class="card-value">${overview.completionRate}%</div>
                        <div class="card-label">Completion Rate</div>
                    </div>
                </div>
                <div class="analytics-card ${weekly.trend === 'up' ? 'positive' : 'negative'}">
                    <div class="card-icon">📉</div>
                    <div class="card-content">
                        <div class="card-value">${weekly.growth >= 0 ? '+' : ''}${weekly.growth}%</div>
                        <div class="card-label">vs Last Week</div>
                    </div>
                </div>
                <div class="analytics-card">
                    <div class="card-icon">🔥</div>
                    <div class="card-content">
                        <div class="card-value">${streak.currentStreak}</div>
                        <div class="card-label">Day Streak</div>
                    </div>
                </div>
                <div class="analytics-card">
                    <div class="card-icon">🏆</div>
                    <div class="card-content">
                        <div class="card-value">${streak.bestStreak}</div>
                        <div class="card-label">Best Streak</div>
                    </div>
                </div>
            </div>
        `;
    }

    _renderCharts(trends, categories, heatmap, analytics) {
        const trendChart = this.chartRenderer.renderLineChart(
            trends.map(t => ({ label: t.date.slice(5), value: t.completed })),
            { color: '#6366f1' }
        );

        const categoryChart = this.chartRenderer.renderBarChart(
            categories.slice(0, 7).map(c => ({ label: c.name.slice(0, 8), value: c.total })),
            { colors: ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899'] }
        );

        const priorityChart = this.chartRenderer.renderDonutChart(
            [
                { name: 'High', value: analytics.priorities.distribution.high },
                { name: 'Medium', value: analytics.priorities.distribution.medium },
                { name: 'Low', value: analytics.priorities.distribution.low }
            ],
            { colors: ['#ef4444', '#f59e0b', '#22c55e'] }
        );

        const heatmapChart = this.chartRenderer.renderHeatmap(heatmap);

        return `
            <div class="analytics-charts">
                <div class="chart-container">
                    <h4>Completion Trends</h4>
                    ${trendChart}
                </div>
                <div class="chart-container">
                    <h4>Categories</h4>
                    ${categoryChart}
                </div>
                <div class="chart-container">
                    <h4>Priority Distribution</h4>
                    ${priorityChart}
                </div>
                <div class="chart-container full-width">
                    <h4>Productivity Heatmap</h4>
                    ${heatmapChart}
                </div>
            </div>
        `;
    }

    _renderInsights(analytics) {
        const insights = [];

        if (analytics.overview.completionRate >= 80) {
            insights.push({ type: 'success', text: 'Excellent completion rate! Keep it up!' });
        } else if (analytics.overview.completionRate < 50) {
            insights.push({ type: 'warning', text: 'Consider breaking down large tasks into smaller ones.' });
        }

        if (analytics.productivity.consistency >= 70) {
            insights.push({ type: 'success', text: 'Great consistency! You\'re building strong habits.' });
        }

        if (analytics.overview.overdue > 5) {
            insights.push({ type: 'error', text: `You have ${analytics.overview.overdue} overdue tasks. Consider reprioritizing.` });
        }

        return `
            <div class="analytics-insights">
                <h4>💡 Insights</h4>
                <div class="insights-list">
                    ${insights.map(i => `
                        <div class="insight-item ${i.type}">
                            <span class="insight-icon">${i.type === 'success' ? '✓' : i.type === 'warning' ? '⚠' : '✕'}</span>
                            <span class="insight-text">${i.text}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    _toCSV(trends) {
        const headers = ['Date', 'Completed', 'Created', 'Ratio'];
        const rows = trends.map(t => [t.date, t.completed, t.created, t.ratio.toFixed(2)]);
        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }
}

// Export
export { AnalyticsDashboard, AnalyticsEngine, ChartRenderer };
