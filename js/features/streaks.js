/**
 * Streaks Manager
 * ================
 * Tracks user productivity streaks and milestones
 * 
 * Features:
 * - Daily completion streaks
 * - Weekly streak tracking
 * - Milestone achievements
 * - Streak freeze protection
 */

import { eventBus, AppEvents } from './core/event-bus.js';

class StreaksManager {
    constructor(taskRepository) {
        this.taskRepository = taskRepository;
        this.STREAK_SETTINGS_KEY = 'streaks_settings';
        this.STREAK_DATA_KEY = 'streaks_data';
    }

    /**
     * Initialize streaks tracking
     */
    async init() {
        const settings = await this._getSettings();
        if (!settings) {
            await this._saveSettings({
                streakFreezes: 0, // Number of freeze protections
                maxFreezes: 3,    // Maximum freezes allowed
                freezeDuration: 24 // Hours a freeze lasts
            });
        }

        const data = await this._getData();
        if (!data) {
            await this._saveData({
                currentStreak: 0,
                longestStreak: 0,
                totalStreakDays: 0,
                lastCompletionDate: null,
                streakStart: null,
                freezesUsed: 0,
                lastFreezeDate: null,
                weeklyStreaks: 0,
                milestones: []
            });
        }
    }

    /**
     * Record task completion for streak tracking
     * @param {Object} task - Completed task
     */
    async recordCompletion(task) {
        const today = this._getTodayString();
        const data = await this._getData();
        const settings = await this._getSettings();

        // Check if already completed today (don't double count)
        if (data.lastCompletionDate === today) {
            return data;
        }

        const yesterday = this._getDateString(new Date(Date.now() - 86400000));
        let newStreak = data.currentStreak;

        // Check if streak continues or resets
        if (data.lastCompletionDate === yesterday) {
            // Continue streak
            newStreak++;
        } else if (data.lastCompletionDate && data.lastCompletionDate !== yesterday) {
            // Streak broken - check for freeze
            const daysSinceLastCompletion = this._daysBetween(
                new Date(data.lastCompletionDate),
                new Date()
            );

            if (daysSinceLastCompletion === 1 && settings.streakFreezes > 0) {
                // Use freeze protection
                await this._useFreeze();
                newStreak++; // Streak continues
            } else {
                // Streak resets
                newStreak = 1;
                data.streakStart = today;
            }
        } else {
            // First streak or returning after long break
            newStreak = 1;
            data.streakStart = today;
        }

        // Update streak data
        data.currentStreak = newStreak;
        data.lastCompletionDate = today;
        data.totalStreakDays++;

        // Update longest streak
        if (newStreak > data.longestStreak) {
            data.longestStreak = newStreak;
        }

        // Check for milestones
        const milestones = await this._checkMilestones(newStreak);
        if (milestones.length > 0) {
            data.milestones = [...new Set([...data.milestones, ...milestones])];
            eventBus.emit(AppEvents.STREAK_MILESTONE, { 
                streak: newStreak, 
                milestones 
            });
        }

        // Update weekly streaks
        if (newStreak % 7 === 0) {
            data.weeklyStreaks++;
        }

        await this._saveData(data);
        
        eventBus.emit(AppEvents.STREAK_UPDATED, {
            currentStreak: newStreak,
            longestStreak: data.longestStreak,
            totalStreakDays: data.totalStreakDays
        });

        return data;
    }

    /**
     * Check for milestone achievements
     * @private
     */
    async _checkMilestones(streak) {
        const data = await this._getData();
        const newMilestones = [];

        const milestoneThresholds = [1, 3, 7, 14, 21, 30, 60, 90, 100, 365];
        
        for (const threshold of milestoneThresholds) {
            if (streak === threshold && !data.milestones.includes(threshold)) {
                newMilestones.push(threshold);
            }
        }

        return newMilestones;
    }

    /**
     * Use a streak freeze
     * @private
     */
    async _useFreeze() {
        const settings = await this._getSettings();
        const data = await this._getData();

        if (settings.streakFreezes > 0) {
            settings.streakFreezes--;
            data.streakFreezeUsed = true;
            data.lastFreezeDate = this._getTodayString();
            
            await this._saveSettings(settings);
            await this._saveData(data);
            
            eventBus.emit(AppEvents.STREAK_FREEZE_USED);
        }
    }

    /**
     * Earn a streak freeze (can be awarded for milestones)
     * @param {number} count - Number of freezes to add
     */
    async earnFreeze(count = 1) {
        const settings = await this._getSettings();
        settings.streakFreezes = Math.min(settings.streakFreezes + count, settings.maxFreezes);
        await this._saveSettings(settings);
        
        eventBus.emit(AppEvents.STREAK_FREEZE_EARNED, { count });
    }

    /**
     * Get current streak info
     * @returns {Promise<Object>} Streak data
     */
    async getStreakInfo() {
        const data = await this._getData();
        const settings = await this._getSettings();
        const today = this._getTodayString();

        // Check if streak is at risk
        let streakStatus = 'safe';
        if (data.lastCompletionDate) {
            const daysSinceCompletion = this._daysBetween(
                new Date(data.lastCompletionDate),
                new Date()
            );
            
            if (daysSinceCompletion >= 1) {
                streakStatus = settings.streakFreezes > 0 ? 'at_risk' : 'broken';
            }
        }

        return {
            currentStreak: data.currentStreak,
            longestStreak: data.longestStreak,
            totalStreakDays: data.totalStreakDays,
            weeklyStreaks: data.weeklyStreaks,
            streakStart: data.streakStart,
            lastCompletionDate: data.lastCompletionDate,
            streakStatus,
            freezesAvailable: settings.streakFreezes,
            milestones: data.milestones,
            nextMilestone: this._getNextMilestone(data.currentStreak)
        };
    }

    /**
     * Get next milestone target
     * @private
     */
    _getNextMilestone(currentStreak) {
        const milestones = [1, 3, 7, 14, 21, 30, 60, 90, 100, 365];
        for (const milestone of milestones) {
            if (milestone > currentStreak) {
                return milestone;
            }
        }
        return null;
    }

    /**
     * Get streak widget data for UI
     * @returns {Promise<Object>} Widget data
     */
    async getWidgetData() {
        const info = await this.getStreakInfo();
        
        return {
            currentStreak: info.currentStreak,
            streakStatus: info.streakStatus,
            nextMilestone: info.nextMilestone,
            progressToNext: info.nextMilestone 
                ? Math.round((info.currentStreak / info.nextMilestone) * 100)
                : 100,
            freezesAvailable: info.freezesAvailable
        };
    }

    /**
     * Reset all streak data
     */
    async reset() {
        await this._saveData({
            currentStreak: 0,
            longestStreak: 0,
            totalStreakDays: 0,
            lastCompletionDate: null,
            streakStart: null,
            freezesUsed: 0,
            lastFreezeDate: null,
            weeklyStreaks: 0,
            milestones: []
        });
        
        eventBus.emit(AppEvents.STREAKS_RESET);
    }

    /**
     * Get settings from storage
     * @private
     */
    async _getSettings() {
        const stored = localStorage.getItem(this.STREAK_SETTINGS_KEY);
        return stored ? JSON.parse(stored) : null;
    }

    /**
     * Save settings to storage
     * @private
     */
    async _saveSettings(settings) {
        localStorage.setItem(this.STREAK_SETTINGS_KEY, JSON.stringify(settings));
    }

    /**
     * Get data from storage
     * @private
     */
    async _getData() {
        const stored = localStorage.getItem(this.STREAK_DATA_KEY);
        return stored ? JSON.parse(stored) : null;
    }

    /**
     * Save data to storage
     * @private
     */
    async _saveData(data) {
        localStorage.setItem(this.STREAK_DATA_KEY, JSON.stringify(data));
    }

    /**
     * Get today's date as string
     * @private
     */
    _getTodayString() {
        return this._getDateString(new Date());
    }

    /**
     * Format date as string
     * @private
     */
    _getDateString(date) {
        return date.toISOString().split('T')[0];
    }

    /**
     * Calculate days between two dates
     * @private
     */
    _daysBetween(date1, date2) {
        const oneDay = 24 * 60 * 60 * 1000;
        return Math.round(Math.abs((date1 - date2) / oneDay));
    }
}

export { StreaksManager };
