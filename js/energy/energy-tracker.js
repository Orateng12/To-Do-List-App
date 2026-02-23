/**
 * Energy & Mood Tracking System
 * ==============================
 * Track energy levels throughout the day and get AI-powered task recommendations
 *
 * Features:
 * - Energy level tracking (1-10 scale)
 * - Mood tracking with categories
 * - Pattern recognition and analytics
 * - Task recommendations based on energy/mood
 * - Optimal task time suggestions
 * - Energy-aware scheduling
 */

import { eventBus, AppEvents } from '../core/event-bus.js';

class EnergyMoodTracker {
    constructor(taskRepository, storage) {
        this.taskRepository = taskRepository;
        this.storage = storage;
        
        this.ENERGY_LEVELS = {
            VERY_LOW: 1,
            LOW: 2,
            BELOW_AVERAGE: 3,
            AVERAGE: 4,
            ABOVE_AVERAGE: 5,
            GOOD: 6,
            HIGH: 7,
            VERY_HIGH: 8,
            EXCELLENT: 9,
            PEAK: 10
        };

        this.MOOD_CATEGORIES = {
            FOCUSED: 'focused',
            CREATIVE: 'creative',
            ENERGETIC: 'energetic',
            CALM: 'calm',
            STRESSED: 'stressed',
            TIRED: 'tired',
            MOTIVATED: 'motivated',
            NEUTRAL: 'neutral'
        };

        this.TASK_ENERGY_REQUIREMENTS = {
            high: 7,    // High priority tasks need high energy
            medium: 5,  // Medium tasks need average energy
            low: 3      // Low tasks can be done with low energy
        };
    }

    /**
     * Log current energy level
     * @param {number} level - Energy level (1-10)
     * @param {string} notes - Optional notes
     * @returns {Promise<Object>} Energy log entry
     */
    async logEnergy(level, notes = '') {
        if (level < 1 || level > 10) {
            throw new Error('Energy level must be between 1 and 10');
        }

        const entry = {
            id: this._generateId(),
            type: 'energy',
            level,
            notes,
            timestamp: new Date().toISOString(),
            hour: new Date().getHours(),
            dayOfWeek: new Date().getDay()
        };

        await this._saveEntry(entry);

        eventBus.emit(AppEvents.ENERGY_LOGGED, { entry });

        return entry;
    }

    /**
     * Log current mood
     * @param {string} mood - Mood category
     * @param {number} intensity - Intensity (1-5)
     * @param {string} notes - Optional notes
     * @returns {Promise<Object>} Mood log entry
     */
    async logMood(mood, intensity = 3, notes = '') {
        if (!Object.values(this.MOOD_CATEGORIES).includes(mood)) {
            throw new Error('Invalid mood category');
        }

        if (intensity < 1 || intensity > 5) {
            throw new Error('Intensity must be between 1 and 5');
        }

        const entry = {
            id: this._generateId(),
            type: 'mood',
            mood,
            intensity,
            notes,
            timestamp: new Date().toISOString(),
            hour: new Date().getHours(),
            dayOfWeek: new Date().getDay()
        };

        await this._saveEntry(entry);

        eventBus.emit(AppEvents.MOOD_LOGGED, { entry });

        return entry;
    }

    /**
     * Log combined energy and mood
     * @param {number} energyLevel - Energy level (1-10)
     * @param {string} mood - Mood category
     * @param {number} intensity - Mood intensity (1-5)
     * @param {string} notes - Optional notes
     * @returns {Promise<Object>} Combined log entry
     */
    async logCombined(energyLevel, mood, intensity, notes = '') {
        const energyEntry = await this.logEnergy(energyLevel, notes);
        const moodEntry = await this.logMood(mood, intensity, notes);

        const combinedEntry = {
            id: this._generateId(),
            type: 'combined',
            energy: energyEntry,
            mood: moodEntry,
            timestamp: new Date().toISOString()
        };

        eventBus.emit(AppEvents.ENERGY_MOOD_LOGGED, { entry: combinedEntry });

        return combinedEntry;
    }

    /**
     * Get task recommendations based on current energy/mood
     * @param {Object} currentState - Current energy and mood state
     * @returns {Promise<Object>} Task recommendations
     */
    async getRecommendations(currentState = null) {
        const tasks = await this.taskRepository.getAll();
        const activeTasks = tasks.filter(t => !t.completed);

        // Get current state or use latest logs
        const state = currentState || await this.getCurrentState();

        // Score each task based on energy/mood match
        const scoredTasks = activeTasks.map(task => {
            const score = this._calculateTaskScore(task, state);
            return { task, score };
        });

        // Sort by score
        scoredTasks.sort((a, b) => b.score.total - a.score.total);

        // Categorize recommendations
        const recommendations = {
            bestMatch: scoredTasks.slice(0, 3),
            quickWins: scoredTasks.filter(s => s.task.estimatedDuration <= 15),
            deepWork: scoredTasks.filter(s => 
                state.energy >= 7 && s.score.focusMatch >= 0.8
            ),
            lowEnergy: scoredTasks.filter(s => 
                state.energy <= 4 && s.score.energyMatch >= 0.7
            ),
            all: scoredTasks
        };

        eventBus.emit(AppEvents.RECOMMENDATIONS_GENERATED, { state, recommendations });

        return recommendations;
    }

    /**
     * Get current energy/mood state
     * @returns {Promise<Object>} Current state
     */
    async getCurrentState() {
        const entries = await this._getRecentEntries(24); // Last 24 hours

        const energyEntries = entries.filter(e => e.type === 'energy' || e.type === 'combined');
        const moodEntries = entries.filter(e => e.type === 'mood' || e.type === 'combined');

        // Calculate current energy (weighted average, recent entries weighted more)
        let energy = 5; // Default
        if (energyEntries.length > 0) {
            const now = Date.now();
            const weightedSum = energyEntries.reduce((sum, e) => {
                const hoursAgo = (now - new Date(e.timestamp).getTime()) / (1000 * 60 * 60);
                const weight = Math.exp(-hoursAgo / 6); // Decay over 6 hours
                return sum + (e.level * weight);
            }, 0);
            const totalWeight = energyEntries.reduce((sum, e) => {
                const hoursAgo = (now - new Date(e.timestamp).getTime()) / (1000 * 60 * 60);
                return sum + Math.exp(-hoursAgo / 6);
            }, 0);
            energy = Math.round(weightedSum / totalWeight);
        }

        // Get current mood (most recent)
        let mood = this.MOOD_CATEGORIES.NEUTRAL;
        let moodIntensity = 3;
        if (moodEntries.length > 0) {
            const latest = moodEntries[moodEntries.length - 1];
            mood = latest.mood;
            moodIntensity = latest.intensity;
        }

        return {
            energy,
            mood,
            moodIntensity,
            energyTrend: this._calculateTrend(energyEntries),
            loggedEntriesCount: entries.length,
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Get energy patterns and analytics
     * @param {number} days - Number of days to analyze
     * @returns {Promise<Object>} Analytics
     */
    async getAnalytics(days = 30) {
        const entries = await this._getEntries(days);
        
        if (entries.length === 0) {
            return {
                hasData: false,
                message: 'Not enough data. Start logging your energy and mood!'
            };
        }

        const energyEntries = entries.filter(e => e.type === 'energy' || e.type === 'combined');
        const moodEntries = entries.filter(e => e.type === 'mood' || e.type === 'combined');

        // Hourly patterns
        const hourlyEnergy = this._groupByHour(energyEntries);
        
        // Day of week patterns
        const dailyEnergy = this._groupByDayOfWeek(energyEntries);

        // Mood distribution
        const moodDistribution = this._getMoodDistribution(moodEntries);

        // Energy trends
        const trends = this._calculateTrends(energyEntries);

        // Best performing times
        const peakHours = this._findPeakHours(hourlyEnergy);
        const lowHours = this._findLowHours(hourlyEnergy);

        // Correlations
        const moodEnergyCorrelation = this._calculateMoodEnergyCorrelation(entries);

        return {
            hasData: true,
            period: { days, entriesCount: entries.length },
            hourlyPatterns: hourlyEnergy,
            dailyPatterns: dailyEnergy,
            moodDistribution,
            trends,
            peakHours,
            lowHours,
            moodEnergyCorrelation,
            insights: this._generateInsights(hourlyEnergy, dailyEnergy, trends, moodDistribution)
        };
    }

    /**
     * Get optimal times for different task types
     * @returns {Promise<Object>} Optimal time recommendations
     */
    async getOptimalTimes() {
        const analytics = await this.getAnalytics(30);
        
        if (!analytics.hasData) {
            return {
                message: 'Log your energy for 3-7 days to get optimal time recommendations',
                data: null
            };
        }

        const { peakHours, lowHours, dailyPatterns } = analytics;

        return {
            deepWork: {
                hours: peakHours.top.slice(0, 3),
                energyRequired: 7,
                description: 'Best times for complex, focused work'
            },
            creativeWork: {
                hours: peakHours.top.slice(0, 2).concat(peakHours.rising?.slice(0, 1) || []),
                energyRequired: 6,
                description: 'Good times for brainstorming and creative tasks'
            },
            adminTasks: {
                hours: lowHours.bottom.slice(0, 3),
                energyRequired: 3,
                description: 'Low-energy times perfect for routine tasks'
            },
            meetings: {
                hours: this._findMeetingHours(dailyPatterns),
                energyRequired: 5,
                description: 'Balanced energy times good for collaboration'
            },
            bestDayOverall: dailyPatterns.bestDay,
            worstDayOverall: dailyPatterns.worstDay
        };
    }

    /**
     * Check if current state matches task requirements
     * @param {string} taskId - Task ID
     * @returns {Promise<Object>} Match analysis
     */
    async checkTaskMatch(taskId) {
        const task = await this.taskRepository.getById(taskId);
        if (!task) {
            throw new Error('Task not found');
        }

        const currentState = await this.getCurrentState();
        const score = this._calculateTaskScore(task, currentState);

        const requiredEnergy = this.TASK_ENERGY_REQUIREMENTS[task.priority] || 5;
        const energyMatch = currentState.energy >= requiredEnergy;

        // Mood-based recommendations
        const idealMoods = this._getIdealMoodsForTask(task);
        const moodMatch = idealMoods.includes(currentState.mood);

        return {
            taskId,
            task,
            currentState,
            energyMatch,
            currentEnergy: currentState.energy,
            requiredEnergy,
            moodMatch,
            currentMood: currentState.mood,
            idealMoods,
            recommendation: this._getRecommendationText(score, energyMatch, moodMatch),
            confidence: score.total
        };
    }

    /**
     * Export energy/mood data
     * @returns {Promise<Object>} Export data
     */
    async exportData() {
        const entries = await this._getEntries(365); // Last year
        const analytics = await this.getAnalytics(30);

        return {
            exportedAt: new Date().toISOString(),
            entriesCount: entries.length,
            entries,
            analytics,
            format: 'energy-mood-export-v1'
        };
    }

    // ==================== Private Helper Methods ====================

    async _saveEntry(entry) {
        const key = `energy_mood_${entry.id}`;
        await this.storage.saveSetting(key, entry);
        
        // Also maintain a list of entry IDs for querying
        const allIds = await this.storage.getSetting('energy_mood_ids', []);
        allIds.push({ id: entry.id, timestamp: entry.timestamp });
        await this.storage.saveSetting('energy_mood_ids', allIds);
    }

    async _getEntries(days) {
        const allIds = await this.storage.getSetting('energy_mood_ids', []);
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        
        const recentIds = allIds.filter(id => new Date(id.timestamp).getTime() > cutoff);
        const entries = [];

        for (const idInfo of recentIds) {
            const entry = await this.storage.getSetting(`energy_mood_${idInfo.id}`);
            if (entry) {
                entries.push(entry);
            }
        }

        return entries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    async _getRecentEntries(hours) {
        const allIds = await this.storage.getSetting('energy_mood_ids', []);
        const cutoff = Date.now() - (hours * 60 * 60 * 1000);
        
        const recentIds = allIds.filter(id => new Date(id.timestamp).getTime() > cutoff);
        const entries = [];

        for (const idInfo of recentIds) {
            const entry = await this.storage.getSetting(`energy_mood_${idInfo.id}`);
            if (entry) {
                entries.push(entry);
            }
        }

        return entries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    _calculateTaskScore(task, state) {
        const scores = {
            energyMatch: 0,
            moodMatch: 0,
            priorityMatch: 0,
            deadlineMatch: 0,
            total: 0
        };

        // Energy match (0-1)
        const requiredEnergy = this.TASK_ENERGY_REQUIREMENTS[task.priority] || 5;
        const energyDiff = Math.abs(state.energy - requiredEnergy);
        scores.energyMatch = Math.max(0, 1 - (energyDiff / 10));

        // Mood match (0-1)
        const idealMoods = this._getIdealMoodsForTask(task);
        scores.moodMatch = idealMoods.includes(state.mood) ? 1 : 0.5;

        // Priority match (0-1) - higher energy should match higher priority
        const priorityScore = { high: 3, medium: 2, low: 1 };
        const taskPriorityScore = priorityScore[task.priority] || 2;
        const energyBucket = state.energy <= 3 ? 1 : state.energy <= 6 ? 2 : 3;
        scores.priorityMatch = taskPriorityScore === energyBucket ? 1 : 0.7;

        // Deadline match (0-1)
        if (task.dueDate) {
            const daysUntilDue = (new Date(task.dueDate) - Date.now()) / (1000 * 60 * 60 * 24);
            scores.deadlineMatch = daysUntilDue <= 1 ? 1 : daysUntilDue <= 3 ? 0.8 : 0.5;
        } else {
            scores.deadlineMatch = 0.5;
        }

        // Weighted total
        scores.total = (
            scores.energyMatch * 0.3 +
            scores.moodMatch * 0.2 +
            scores.priorityMatch * 0.25 +
            scores.deadlineMatch * 0.25
        );

        return scores;
    }

    _getIdealMoodsForTask(task) {
        const moods = {
            high: [this.MOOD_CATEGORIES.FOCUSED, this.MOOD_CATEGORIES.ENERGETIC, this.MOOD_CATEGORIES.MOTIVATED],
            medium: [this.MOOD_CATEGORIES.FOCUSED, this.MOOD_CATEGORIES.CALM, this.MOOD_CATEGORIES.NEUTRAL],
            low: [this.MOOD_CATEGORIES.CALM, this.MOOD_CATEGORIES.TIRED, this.MOOD_CATEGORIES.NEUTRAL]
        };

        // Creative tasks benefit from creative mood
        if (task.text.toLowerCase().match(/write|design|create|brainstorm|plan/i)) {
            moods.high.unshift(this.MOOD_CATEGORIES.CREATIVE);
        }

        return moods[task.priority] || moods.medium;
    }

    _getRecommendationText(score, energyMatch, moodMatch) {
        if (score.total >= 0.8) {
            return "Perfect time to tackle this task!";
        } else if (energyMatch && moodMatch) {
            return "Good match - go for it!";
        } else if (energyMatch) {
            return "Energy is good, but mood might not be ideal";
        } else if (moodMatch) {
            return "Mood is right, but consider saving energy for higher priority tasks";
        } else {
            return "Consider a lower-priority task or take a break";
        }
    }

    _groupByHour(entries) {
        const hourly = {};
        for (let i = 0; i < 24; i++) {
            hourly[i] = { count: 0, total: 0, average: 0 };
        }

        entries.forEach(e => {
            const hour = e.hour;
            if (hourly[hour]) {
                hourly[hour].count++;
                hourly[hour].total += e.level;
                hourly[hour].average = Math.round((hourly[hour].total / hourly[hour].count) * 10) / 10;
            }
        });

        return hourly;
    }

    _groupByDayOfWeek(entries) {
        const daily = {};
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        dayNames.forEach((day, index) => {
            daily[index] = { name: day, count: 0, total: 0, average: 0 };
        });

        entries.forEach(e => {
            const day = e.dayOfWeek;
            if (daily[day]) {
                daily[day].count++;
                daily[day].total += e.level;
                daily[day].average = Math.round((daily[day].total / daily[day].count) * 10) / 10;
            }
        });

        const days = Object.values(daily);
        const withData = days.filter(d => d.count > 0);
        
        return {
            ...daily,
            bestDay: withData.length ? withData.reduce((a, b) => a.average > b.average ? a : b).name : null,
            worstDay: withData.length ? withData.reduce((a, b) => a.average < b.average ? a : b).name : null
        };
    }

    _getMoodDistribution(entries) {
        const distribution = {};
        Object.values(this.MOOD_CATEGORIES).forEach(mood => {
            distribution[mood] = 0;
        });

        entries.forEach(e => {
            if (e.mood) {
                distribution[e.mood] = (distribution[e.mood] || 0) + 1;
            }
        });

        const total = entries.length;
        return Object.entries(distribution).reduce((acc, [mood, count]) => {
            acc[mood] = {
                count,
                percentage: total > 0 ? Math.round((count / total) * 100) : 0
            };
            return acc;
        }, {});
    }

    _calculateTrend(entries) {
        if (entries.length < 2) return 'stable';

        const recent = entries.slice(-5);
        const older = entries.slice(-10, -5);

        if (older.length === 0) return 'insufficient_data';

        const recentAvg = recent.reduce((sum, e) => sum + e.level, 0) / recent.length;
        const olderAvg = older.reduce((sum, e) => sum + e.level, 0) / older.length;

        const diff = recentAvg - olderAvg;
        if (diff > 0.5) return 'increasing';
        if (diff < -0.5) return 'decreasing';
        return 'stable';
    }

    _calculateTrends(entries) {
        const trend = this._calculateTrend(entries);
        
        // Weekly comparison
        const now = Date.now();
        const thisWeek = entries.filter(e => now - new Date(e.timestamp).getTime() < 7 * 24 * 60 * 60 * 1000);
        const lastWeek = entries.filter(e => {
            const age = now - new Date(e.timestamp).getTime();
            return age >= 7 * 24 * 60 * 60 * 1000 && age < 14 * 24 * 60 * 60 * 1000;
        });

        const thisWeekAvg = thisWeek.length ? thisWeek.reduce((sum, e) => sum + e.level, 0) / thisWeek.length : 0;
        const lastWeekAvg = lastWeek.length ? lastWeek.reduce((sum, e) => sum + e.level, 0) / lastWeek.length : 0;

        return {
            overall: trend,
            weeklyComparison: {
                thisWeekAvg: Math.round(thisWeekAvg * 10) / 10,
                lastWeekAvg: Math.round(lastWeekAvg * 10) / 10,
                change: Math.round((thisWeekAvg - lastWeekAvg) * 10) / 10
            }
        };
    }

    _findPeakHours(hourlyEnergy) {
        const hours = Object.entries(hourlyEnergy)
            .filter(([, data]) => data.count > 0)
            .map(([hour, data]) => ({ hour: parseInt(hour), average: data.average }))
            .sort((a, b) => b.average - a.average);

        const top = hours.slice(0, 3).map(h => `${h.hour}:00`);
        const rising = hours.filter((h, i) => i > 0 && h.average > hours[i - 1].average).slice(0, 2).map(h => `${h.hour}:00`);

        return { top, rising };
    }

    _findLowHours(hourlyEnergy) {
        const hours = Object.entries(hourlyEnergy)
            .filter(([, data]) => data.count > 0)
            .map(([hour, data]) => ({ hour: parseInt(hour), average: data.average }))
            .sort((a, b) => a.average - b.average);

        return {
            bottom: hours.slice(0, 3).map(h => `${h.hour}:00`)
        };
    }

    _findMeetingHours(dailyPatterns) {
        // Find days with balanced energy (not too high, not too low)
        const balancedDays = Object.values(dailyPatterns)
            .filter(d => d.count > 0 && d.average >= 4 && d.average <= 6)
            .map(d => d.name);

        return balancedDays.length ? balancedDays : ['Tuesday', 'Wednesday', 'Thursday'];
    }

    _calculateMoodEnergyCorrelation(entries) {
        const combined = entries.filter(e => e.type === 'combined' || (e.energy && e.mood));
        if (combined.length < 5) return null;

        // Simple correlation calculation
        const moodScores = {
            [this.MOOD_CATEGORIES.FOCUSED]: 7,
            [this.MOOD_CATEGORIES.CREATIVE]: 7,
            [this.MOOD_CATEGORIES.ENERGETIC]: 9,
            [this.MOOD_CATEGORIES.CALM]: 5,
            [this.MOOD_CATEGORIES.STRESSED]: 3,
            [this.MOOD_CATEGORIES.TIRED]: 2,
            [this.MOOD_CATEGORIES.MOTIVATED]: 8,
            [this.MOOD_CATEGORIES.NEUTRAL]: 5
        };

        let sumProduct = 0, sumEnergy = 0, sumMood = 0, sumEnergySq = 0, sumMoodSq = 0;
        const n = combined.length;

        combined.forEach(e => {
            const energy = e.level || e.energy;
            const mood = moodScores[e.mood] || 5;
            sumProduct += energy * mood;
            sumEnergy += energy;
            sumMood += mood;
            sumEnergySq += energy * energy;
            sumMoodSq += mood * mood;
        });

        const numerator = n * sumProduct - sumEnergy * sumMood;
        const denominator = Math.sqrt((n * sumEnergySq - sumEnergy ** 2) * (n * sumMoodSq - sumMood ** 2));

        const correlation = denominator ? numerator / denominator : 0;

        return {
            value: Math.round(correlation * 100) / 100,
            interpretation: correlation > 0.5 ? 'strong positive' : correlation > 0.2 ? 'moderate positive' : 'weak'
        };
    }

    _generateInsights(hourly, daily, trends, moodDist) {
        const insights = [];

        // Peak energy insight
        const peakHour = Object.entries(hourly)
            .filter(([, data]) => data.count > 0)
            .sort((a, b) => b[1].average - a[1].average)[0];
        
        if (peakHour) {
            insights.push({
                type: 'peak_time',
                message: `Your peak energy is at ${peakHour[0]}:00 (avg: ${peakHour[1].average}/10)`,
                action: 'Schedule your most important tasks during this time'
            });
        }

        // Trend insight
        if (trends.overall === 'increasing') {
            insights.push({
                type: 'positive_trend',
                message: 'Your energy has been trending upward this week!',
                action: 'Great time to take on challenging tasks'
            });
        } else if (trends.overall === 'decreasing') {
            insights.push({
                type: 'warning',
                message: 'Your energy has been declining. Consider rest.',
                action: 'Focus on low-energy tasks and self-care'
            });
        }

        // Mood insight
        const dominantMood = Object.entries(moodDist)
            .sort((a, b) => b[1].count - a[1].count)[0];
        
        if (dominantMood && dominantMood[1].count > 0) {
            insights.push({
                type: 'mood_pattern',
                message: `Your most common mood is ${dominantMood[0]} (${dominantMood[1].percentage}% of logs)`,
                action: dominantMood[0] === 'stressed' || dominantMood[0] === 'tired' 
                    ? 'Consider workload adjustments'
                    : 'Keep doing what works!'
            });
        }

        return insights;
    }

    _generateId() {
        return 'em_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }
}

// Additional events
AppEvents.ENERGY_LOGGED = 'energy:logged';
AppEvents.MOOD_LOGGED = 'mood:logged';
AppEvents.ENERGY_MOOD_LOGGED = 'energy_mood:logged';
AppEvents.RECOMMENDATIONS_GENERATED = 'recommendations:generated';

export { EnergyMoodTracker };
