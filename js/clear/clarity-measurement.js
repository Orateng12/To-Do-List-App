/**
 * Clarity Measurement System - Clear Life OS
 * ===========================================
 * Tracks and measures user clarity outcomes
 * over time.
 * 
 * Features:
 * - Daily clarity scoring
 * - Clarity shift tracking
 * - Correlation with retention
 * - Milestone detection
 */

import { eventBus, AppEvents } from '../core/event-bus.js';

class ClarityMeasurementSystem {
    constructor() {
        // Clarity dimensions
        this.clarityDimensions = {
            identity: {
                name: 'Identity Clarity',
                questions: [
                    'I know who I want to become',
                    'My actions align with my identity',
                    'I feel confident in my direction'
                ]
            },
            priorities: {
                name: 'Priority Clarity',
                questions: [
                    'I know what\'s most important today',
                    'I can distinguish urgent from important',
                    'My priorities feel manageable'
                ]
            },
            systems: {
                name: 'System Clarity',
                questions: [
                    'My systems support my goals',
                    'I know what to do when I miss a day',
                    'My habits feel sustainable'
                ]
            },
            progress: {
                name: 'Progress Clarity',
                questions: [
                    'I can see my progress clearly',
                    'I know if I\'m on track',
                    'My progress feels meaningful'
                ]
            }
        };
        
        // Storage
        this.storageKey = 'clear_clarity_data';
        this.data = this._loadData();
    }

    /**
     * Record daily clarity score
     * @param {Object} scores - Scores by dimension (1-10)
     * @returns {Object} Recorded clarity data
     */
    recordDailyClarity(scores) {
        const today = new Date().toISOString().split('T')[0];
        
        const clarityRecord = {
            date: today,
            timestamp: new Date().toISOString(),
            overall: this._calculateOverallScore(scores),
            dimensions: scores,
            shift: this._calculateShift(scores),
            milestones: this._checkMilestones(scores)
        };
        
        this.data.dailyScores.push(clarityRecord);
        this._saveData();
        
        eventBus.emit(AppEvents.CLARITY_SCORED, clarityRecord);
        
        return clarityRecord;
    }

    /**
     * Calculate overall clarity score
     * @private
     */
    _calculateOverallScore(dimensionScores) {
        const values = Object.values(dimensionScores);
        const sum = values.reduce((a, b) => a + b, 0);
        return Math.round((sum / values.length) * 10) / 10;
    }

    /**
     * Calculate shift from previous score
     * @private
     */
    _calculateShift(currentScores) {
        const previous = this.data.dailyScores[this.data.dailyScores.length - 1];
        if (!previous) return { absolute: 0, percentage: 0, direction: 'baseline' };
        
        const shift = currentScores.overall - previous.overall;
        const percentage = previous.overall > 0 ? (shift / previous.overall) * 100 : 0;
        const direction = shift > 0.5 ? 'up' : shift < -0.5 ? 'down' : 'stable';
        
        return {
            absolute: Math.round(shift * 10) / 10,
            percentage: Math.round(percentage * 10) / 10,
            direction
        };
    }

    /**
     * Check for clarity milestones
     * @private
     */
    _checkMilestones(currentScores) {
        const milestones = [];
        const overall = currentScores.overall;
        
        // Score milestones
        if (overall >= 9) milestones.push('clarity_master');
        else if (overall >= 8) milestones.push('high_clarity');
        else if (overall >= 7) milestones.push('solid_clarity');
        else if (overall >= 6) milestones.push('growing_clarity');
        
        // Improvement milestones
        const last7Days = this.data.dailyScores.slice(-7);
        if (last7Days.length >= 7) {
            const firstWeekAvg = last7Days[0].overall;
            const lastWeekAvg = last7Days[6].overall;
            if (lastWeekAvg - firstWeekAvg >= 2) {
                milestones.push('week_improvement');
            }
        }
        
        // Streak milestones
        const positiveStreak = this._calculatePositiveStreak();
        if (positiveStreak >= 30) milestones.push('30_day_clarity_streak');
        else if (positiveStreak >= 14) milestones.push('14_day_clarity_streak');
        else if (positiveStreak >= 7) milestones.push('7_day_clarity_streak');
        
        return milestones;
    }

    /**
     * Calculate positive clarity streak
     * @private
     */
    _calculatePositiveStreak() {
        let streak = 0;
        const scores = this.data.dailyScores.slice().reverse();
        
        for (const record of scores) {
            if (record.shift.direction === 'up' || record.shift.direction === 'stable') {
                streak++;
            } else {
                break;
            }
        }
        
        return streak;
    }

    /**
     * Get clarity statistics
     * @returns {Object} Clarity statistics
     */
    getClarityStats() {
        const scores = this.data.dailyScores;
        if (scores.length === 0) {
            return {
                average: 0,
                trend: 'insufficient_data',
                volatility: 0,
                bestDay: null,
                worstDay: null
            };
        }
        
        const overallScores = scores.map(s => s.overall);
        const average = overallScores.reduce((a, b) => a + b, 0) / overallScores.length;
        
        // Calculate trend (last 7 days vs previous 7)
        const last7 = scores.slice(-7).map(s => s.overall);
        const previous7 = scores.slice(-14, -7).map(s => s.overall);
        const last7Avg = last7.reduce((a, b) => a + b, 0) / Math.max(1, last7.length);
        const previous7Avg = previous7.length > 0 ? previous7.reduce((a, b) => a + b, 0) / previous7.length : last7Avg;
        
        let trend = 'stable';
        if (last7Avg - previous7Avg >= 0.5) trend = 'improving';
        else if (previous7Avg - last7Avg >= 0.5) trend = 'declining';
        
        // Calculate volatility
        const mean = average;
        const variance = overallScores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / overallScores.length;
        const volatility = Math.sqrt(variance);
        
        // Best and worst days
        const sorted = [...scores].sort((a, b) => b.overall - a.overall);
        const bestDay = sorted[0];
        const worstDay = sorted[sorted.length - 1];
        
        return {
            average: Math.round(average * 10) / 10,
            trend,
            volatility: Math.round(volatility * 10) / 10,
            bestDay: {
                date: bestDay?.date,
                score: bestDay?.overall
            },
            worstDay: {
                date: worstDay?.date,
                score: worstDay?.overall
            },
            totalDays: scores.length,
            currentStreak: this._calculatePositiveStreak()
        };
    }

    /**
     * Get clarity-retention correlation
     * @param {Array} retentionData - Retention data points
     * @returns {Object} Correlation analysis
     */
    getClarityRetentionCorrelation(retentionData) {
        if (retentionData.length < 7) {
            return { correlation: 0, significance: 'insufficient_data' };
        }
        
        // Simple correlation calculation
        const clarityScores = this.data.dailyScores.slice(-retentionData.length);
        
        if (clarityScores.length !== retentionData.length) {
            return { correlation: 0, significance: 'data_mismatch' };
        }
        
        const clarityVals = clarityScores.map(s => s.overall);
        const retentionVals = retentionData.map(r => r.retained ? 1 : 0);
        
        const correlation = this._calculateCorrelation(clarityVals, retentionVals);
        
        return {
            correlation: Math.round(correlation * 100) / 100,
            significance: Math.abs(correlation) > 0.5 ? 'strong' : Math.abs(correlation) > 0.3 ? 'moderate' : 'weak',
            dataPoints: clarityScores.length
        };
    }

    /**
     * Calculate Pearson correlation
     * @private
     */
    _calculateCorrelation(x, y) {
        const n = x.length;
        if (n === 0) return 0;
        
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
        const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
        
        const numerator = (n * sumXY) - (sumX * sumY);
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        
        return denominator === 0 ? 0 : numerator / denominator;
    }

    /**
     * Get clarity data by date range
     * @param {string} startDate - Start date
     * @param {string} endDate - End date
     * @returns {Array} Clarity records
     */
    getClarityByDateRange(startDate, endDate) {
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime();
        
        return this.data.dailyScores.filter(record => {
            const recordDate = new Date(record.timestamp).getTime();
            return recordDate >= start && recordDate <= end;
        });
    }

    /**
     * Get dimension breakdown
     * @returns {Object} Average scores by dimension
     */
    getDimensionBreakdown() {
        const scores = this.data.dailyScores;
        if (scores.length === 0) return {};
        
        const dimensions = {};
        
        Object.keys(this.clarityDimensions).forEach(dim => {
            const dimScores = scores.map(s => s.dimensions[dim]).filter(s => s !== undefined);
            if (dimScores.length > 0) {
                dimensions[dim] = {
                    average: Math.round(dimScores.reduce((a, b) => a + b, 0) / dimScores.length * 10) / 10,
                    trend: this._getDimensionTrend(dimScores)
                };
            }
        });
        
        return dimensions;
    }

    /**
     * Get dimension trend
     * @private
     */
    _getDimensionTrend(scores) {
        if (scores.length < 7) return 'insufficient_data';
        
        const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
        const secondHalf = scores.slice(Math.floor(scores.length / 2));
        
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        
        if (secondAvg - firstAvg >= 0.5) return 'improving';
        if (firstAvg - secondAvg >= 0.5) return 'declining';
        return 'stable';
    }

    /**
     * Load data from storage
     * @private
     */
    _loadData() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : { dailyScores: [] };
        } catch (error) {
            console.error('[ClarityMeasurement] Load error:', error);
            return { dailyScores: [] };
        }
    }

    /**
     * Save data to storage
     * @private
     */
    _saveData() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.data));
        } catch (error) {
            console.error('[ClarityMeasurement] Save error:', error);
        }
    }

    /**
     * Reset clarity data
     */
    reset() {
        this.data = { dailyScores: [] };
        this._saveData();
        eventBus.emit(AppEvents.CLARITY_DATA_RESET);
    }
}

export { ClarityMeasurementSystem };
