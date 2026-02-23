/**
 * Advanced AI/ML Pipeline for Task Management
 * =============================================
 * 
 * Machine learning models for intelligent task management:
 * - Task duration prediction
 * - Smart categorization
 * - Priority recommendation
 * - Completion probability
 * - Optimal scheduling suggestions
 * - Pattern recognition
 * - Behavioral analytics
 */

import { eventBus, AppEvents } from '../core/event-bus.js';

// ============================================
// FEATURE EXTRACTOR - Convert tasks to ML features
// ============================================
class FeatureExtractor {
    constructor() {
        this.categoryKeywords = {
            work: ['meeting', 'report', 'presentation', 'deadline', 'client', 'project', 'email', 'review', 'submit', 'quarterly'],
            personal: ['home', 'family', 'friend', 'personal', 'self', 'hobby', 'leisure'],
            health: ['exercise', 'workout', 'gym', 'run', 'yoga', 'meditation', 'doctor', 'health', 'diet', 'sleep'],
            education: ['study', 'learn', 'course', 'class', 'exam', 'homework', 'read', 'research', 'tutorial'],
            finance: ['budget', 'payment', 'bill', 'tax', 'invoice', 'bank', 'money', 'expense', 'investment'],
            shopping: ['buy', 'purchase', 'order', 'grocery', 'store', 'mall', 'amazon', 'shop'],
            errands: ['post office', 'bank', 'dry cleaner', 'car', 'repair', 'appointment'],
            creative: ['write', 'design', 'create', 'art', 'music', 'draw', 'paint', 'compose']
        };

        this.priorityKeywords = {
            high: ['urgent', 'asap', 'emergency', 'critical', 'important', 'deadline', 'today', 'immediately', 'priority'],
            low: ['sometime', 'maybe', 'optional', 'when possible', 'low priority', 'eventually']
        };
    }

    /**
     * Extract features from a task for ML models
     */
    extractFeatures(task, historicalData = []) {
        const text = (task.text || '').toLowerCase();
        const words = text.split(/\s+/);

        return {
            // Text features
            textLength: text.length,
            wordCount: words.length,
            avgWordLength: words.reduce((s, w) => s + w.length, 0) / (words.length || 1),
            hasNumbers: /\d/.test(text) ? 1 : 0,
            hasDate: /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|yesterday|next|this|in \d+ days?)\b/i.test(text) ? 1 : 0,
            hasTime: /\b(\d{1,2}:\d{2}|[ap]m|morning|afternoon|evening|noon|midnight)\b/i.test(text) ? 1 : 0,

            // Category indicators
            categoryScores: this._calculateCategoryScores(text),

            // Priority indicators
            priorityScores: this._calculatePriorityScores(text),

            // Task structure
            hasSubtasks: task.subtasks?.length > 0 ? 1 : 0,
            subtaskCount: task.subtasks?.length || 0,
            hasDueDate: task.dueDate ? 1 : 0,
            daysUntilDue: task.dueDate ? 
                Math.max(0, (new Date(task.dueDate) - Date.now()) / (1000 * 60 * 60 * 24)) : -1,
            hasNotes: task.notes?.length > 0 ? 1 : 0,
            notesLength: task.notes?.length || 0,

            // Historical patterns (if available)
            historicalAvgDuration: this._getHistoricalAvgDuration(task, historicalData),
            completionRate: this._getCategoryCompletionRate(task, historicalData),

            // Context
            hourOfDay: new Date().getHours(),
            dayOfWeek: new Date().getDay(),
            isWeekend: new Date().getDay() >= 5 ? 1 : 0
        };
    }

    _calculateCategoryScores(text) {
        const scores = {};
        for (const [category, keywords] of Object.entries(this.categoryKeywords)) {
            scores[category] = keywords.reduce((score, keyword) => {
                return score + (text.includes(keyword) ? 1 : 0);
            }, 0);
        }
        return scores;
    }

    _calculatePriorityScores(text) {
        const scores = { high: 0, medium: 0, low: 0 };
        for (const [priority, keywords] of Object.entries(this.priorityKeywords)) {
            scores[priority] = keywords.reduce((score, keyword) => {
                return score + (text.includes(keyword) ? 2 : 0);
            }, 0);
        }
        // Default medium if no indicators
        if (scores.high === 0 && scores.low === 0) {
            scores.medium = 1;
        }
        return scores;
    }

    _getHistoricalAvgDuration(task, historicalData) {
        if (historicalData.length === 0) return 30; // Default 30 min
        
        const category = this.predictCategory(task);
        const similar = historicalData.filter(t => {
            const tCategory = this._getTextCategory(t.text);
            return tCategory === category && t.actualDuration;
        });

        if (similar.length === 0) return 30;
        return similar.reduce((sum, t) => sum + t.actualDuration, 0) / similar.length;
    }

    _getCategoryCompletionRate(task, historicalData) {
        if (historicalData.length === 0) return 0.8; // Default 80%
        
        const category = this.predictCategory(task);
        const similar = historicalData.filter(t => {
            const tCategory = this._getTextCategory(t.text);
            return tCategory === category;
        });

        if (similar.length === 0) return 0.8;
        const completed = similar.filter(t => t.completed).length;
        return completed / similar.length;
    }

    _getTextCategory(text) {
        const scores = this._calculateCategoryScores(text.toLowerCase());
        const maxCategory = Object.entries(scores)
            .sort((a, b) => b[1] - a[1])[0];
        return maxCategory[1] > 0 ? maxCategory[0] : 'personal';
    }

    /**
     * Predict category
     */
    predictCategory(task) {
        const features = this.extractFeatures(task);
        const maxCategory = Object.entries(features.categoryScores)
            .sort((a, b) => b[1] - a[1])[0];
        return maxCategory[1] > 0 ? maxCategory[0] : 'personal';
    }
}

// ============================================
// DURATION PREDICTOR - Neural Network Lite
// ============================================
class DurationPredictor {
    constructor() {
        this.weights = null;
        this.bias = 0;
        this.learningRate = 0.01;
        this.trained = false;
    }

    /**
     * Initialize weights
     */
    initialize(inputSize) {
        this.weights = new Array(inputSize).fill(0).map(() => Math.random() * 0.1);
        this.bias = Math.random() * 0.1;
    }

    /**
     * Predict duration in minutes
     */
    predict(features) {
        if (!this.weights) {
            // Return heuristic prediction if not trained
            return this._heuristicPrediction(features);
        }

        const featureVector = this._toVector(features);
        let sum = this.bias;
        
        for (let i = 0; i < this.weights.length; i++) {
            sum += featureVector[i] * this.weights[i];
        }

        // ReLU activation (duration can't be negative)
        return Math.max(5, Math.round(sum));
    }

    /**
     * Train on historical data
     */
    train(trainingData, epochs = 100) {
        if (trainingData.length < 10) {
            console.warn('Not enough training data');
            return;
        }

        const inputSize = this._getFeatureVectorSize();
        this.initialize(inputSize);

        for (let epoch = 0; epoch < epochs; epoch++) {
            let totalLoss = 0;

            for (const sample of trainingData) {
                const featureVector = this._toVector(sample.features);
                const prediction = this._forward(featureVector);
                const error = sample.duration - prediction;

                totalLoss += error * error;

                // Gradient descent
                for (let i = 0; i < this.weights.length; i++) {
                    this.weights[i] += this.learningRate * error * featureVector[i];
                }
                this.bias += this.learningRate * error;
            }

            if (epoch % 20 === 0) {
                console.log(`Epoch ${epoch}, Loss: ${(totalLoss / trainingData.length).toFixed(2)}`);
            }
        }

        this.trained = true;
        eventBus.emit('ai:duration-model-trained', { epochs, finalLoss: totalLoss / trainingData.length });
    }

    /**
     * Get confidence interval
     */
    predictWithConfidence(features) {
        const basePrediction = this.predict(features);
        
        // Estimate uncertainty based on feature similarity to training data
        const uncertainty = this._estimateUncertainty(features);
        
        return {
            duration: basePrediction,
            confidence: Math.max(0.3, 1 - uncertainty),
            minDuration: Math.round(basePrediction * (1 - uncertainty)),
            maxDuration: Math.round(basePrediction * (1 + uncertainty))
        };
    }

    _forward(featureVector) {
        let sum = this.bias;
        for (let i = 0; i < this.weights.length; i++) {
            sum += featureVector[i] * this.weights[i];
        }
        return Math.max(0, sum);
    }

    _toVector(features) {
        return [
            features.textLength / 100,
            features.wordCount / 20,
            features.hasNumbers,
            features.hasDate,
            features.hasTime,
            features.hasSubtasks,
            features.subtaskCount / 10,
            features.hasDueDate,
            features.daysUntilDue / 30,
            features.hasNotes,
            features.notesLength / 100,
            features.historicalAvgDuration / 60,
            features.completionRate,
            features.hourOfDay / 24,
            features.dayOfWeek / 7,
            features.isWeekend,
            ...Object.values(features.categoryScores).map(v => v / 5),
            ...Object.values(features.priorityScores).map(v => v / 5)
        ];
    }

    _getFeatureVectorSize() {
        return 16 + Object.keys(new FeatureExtractor().categoryKeywords).length 
                 + Object.keys(new FeatureExtractor().priorityKeywords).length;
    }

    _heuristicPrediction(features) {
        let duration = 30; // Base duration

        // Adjust based on features
        duration += features.wordCount * 2;
        duration += features.subtaskCount * 15;
        duration += features.notesLength > 100 ? 20 : 0;
        
        if (features.hasDueDate && features.daysUntilDue < 1) {
            duration *= 0.7; // Urgent tasks tend to be quicker
        }

        return Math.round(duration);
    }

    _estimateUncertainty(features) {
        // Simple uncertainty based on how "normal" the features are
        let uncertainty = 0.3;

        if (features.historicalAvgDuration > 0) {
            uncertainty -= 0.1; // Have historical data
        }
        if (features.wordCount > 50) {
            uncertainty += 0.1; // Unusually long description
        }
        if (features.subtaskCount > 10) {
            uncertainty += 0.15; // Many subtasks
        }

        return Math.max(0.1, Math.min(0.8, uncertainty));
    }
}

// ============================================
// SMART CATEGORIZER - Multi-label Classification
// ============================================
class SmartCategorizer {
    constructor() {
        this.featureExtractor = new FeatureExtractor();
        this.categoryHistory = new Map();
    }

    /**
     * Predict categories for a task
     */
    predict(task, topN = 3) {
        const features = this.featureExtractor.extractFeatures(task);
        const scores = features.categoryScores;

        // Apply user history boost
        this._applyHistoryBoost(scores);

        // Get top categories
        const sorted = Object.entries(scores)
            .filter(([, score]) => score > 0)
            .sort((a, b) => b[1] - a[1]);

        const predictions = sorted.slice(0, topN).map(([category, score]) => ({
            category,
            confidence: Math.min(1, score / 3),
            score
        }));

        // Default if no predictions
        if (predictions.length === 0) {
            predictions.push({ category: 'personal', confidence: 0.5, score: 1 });
        }

        return predictions;
    }

    /**
     * Get single best category
     */
    categorize(task) {
        const predictions = this.predict(task, 1);
        return predictions[0].category;
    }

    /**
     * Suggest related categories
     */
    suggestRelated(categories, exclude = []) {
        const categoryRelations = {
            work: ['finance', 'education'],
            health: ['personal', 'creative'],
            education: ['work', 'creative'],
            finance: ['work', 'shopping'],
            shopping: ['personal', 'errands'],
            errands: ['personal', 'shopping'],
            creative: ['personal', 'education'],
            personal: ['health', 'creative']
        };

        const suggestions = [];
        for (const category of categories) {
            const related = categoryRelations[category] || [];
            for (const r of related) {
                if (!exclude.includes(r) && !categories.includes(r)) {
                    suggestions.push(r);
                }
            }
        }

        return [...new Set(suggestions)];
    }

    /**
     * Learn from user corrections
     */
    learn(taskId, actualCategories) {
        for (const category of actualCategories) {
            if (!this.categoryHistory.has(category)) {
                this.categoryHistory.set(category, []);
            }
            this.categoryHistory.get(category).push({
                taskId,
                timestamp: Date.now()
            });

            // Keep only recent history
            const history = this.categoryHistory.get(category);
            if (history.length > 100) {
                history.shift();
            }
        }
    }

    _applyHistoryBoost(scores) {
        for (const [category, history] of this.categoryHistory.entries()) {
            if (scores[category] !== undefined && history.length > 0) {
                // Boost score based on user's history with this category
                const boost = Math.min(2, history.length / 10);
                scores[category] += boost;
            }
        }
    }
}

// ============================================
// PRIORITY RECOMMENDER - Rule-based + ML
// ============================================
class PriorityRecommender {
    constructor() {
        this.featureExtractor = new FeatureExtractor();
    }

    /**
     * Recommend priority for a task
     */
    recommend(task, context = {}) {
        const features = this.featureExtractor.extractFeatures(task);
        
        let score = 50; // Base score

        // Priority keywords
        score += (features.priorityScores.high - features.priorityScores.low) * 15;

        // Due date urgency
        if (features.hasDueDate) {
            if (features.daysUntilDue < 1) score += 30;
            else if (features.daysUntilDue < 3) score += 20;
            else if (features.daysUntilDue < 7) score += 10;
        }

        // Time indicators
        if (features.hasTime) score += 10;

        // Task complexity (inverse - complex tasks might need more planning)
        if (features.wordCount > 30) score -= 5;
        if (features.subtaskCount > 5) score += 10;

        // Context adjustments
        if (context.currentHour >= 18) score -= 10; // Evening - lower priority
        if (context.isWeekend) score -= 15; // Weekend - lower work priority

        // Normalize to priority
        if (score >= 70) return { priority: 'high', confidence: 0.9, score };
        if (score >= 40) return { priority: 'medium', confidence: 0.7, score };
        return { priority: 'low', confidence: 0.8, score };
    }

    /**
     * Batch reprioritize tasks
     */
    reprioritizeAll(tasks, context = {}) {
        return tasks.map(task => ({
            ...task,
            recommendedPriority: this.recommend(task, context)
        })).sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            const aRec = a.recommendedPriority?.score || 0;
            const bRec = b.recommendedPriority?.score || 0;
            return bRec - aRec;
        });
    }
}

// ============================================
// COMPLETION PREDICTOR - Success Probability
// ============================================
class CompletionPredictor {
    constructor() {
        this.featureExtractor = new FeatureExtractor();
    }

    /**
     * Predict probability of task completion
     */
    predictProbability(task, userHistory = {}) {
        const features = this.featureExtractor.extractFeatures(task);
        
        let probability = 0.7; // Base probability

        // Historical completion rate for category
        probability = features.completionRate;

        // Priority effect
        if (task.priority === 'high') probability += 0.1;
        if (task.priority === 'low') probability -= 0.1;

        // Due date effect
        if (features.hasDueDate) {
            if (features.daysUntilDue < 1) probability += 0.15;
            else if (features.daysUntilDue > 14) probability -= 0.2;
        }

        // Task complexity effect
        if (features.subtaskCount > 0) {
            probability += Math.min(0.1, features.subtaskCount * 0.02);
        }

        // Time of week effect
        if (features.isWeekend) probability -= 0.1;

        // User's current streak (if available)
        if (userHistory.currentStreak > 7) probability += 0.1;

        return {
            probability: Math.max(0.1, Math.min(0.95, probability)),
            factors: this._explainFactors(features, task, userHistory)
        };
    }

    /**
     * Get tasks most likely to be completed today
     */
    getMostLikelyToComplete(tasks, userHistory = {}, limit = 5) {
        const scored = tasks
            .filter(t => !t.completed)
            .map(task => ({
                task,
                prediction: this.predictProbability(task, userHistory)
            }))
            .sort((a, b) => b.prediction.probability - a.prediction.probability);

        return scored.slice(0, limit);
    }

    _explainFactors(features, task, userHistory) {
        const factors = [];

        if (features.completionRate > 0.8) {
            factors.push({ factor: 'category_history', impact: 'positive', description: 'You usually complete tasks in this category' });
        }

        if (task.priority === 'high') {
            factors.push({ factor: 'priority', impact: 'positive', description: 'High priority increases completion chance' });
        }

        if (features.daysUntilDue < 1) {
            factors.push({ factor: 'urgency', impact: 'positive', description: 'Due soon - urgency helps' });
        } else if (features.daysUntilDue > 14) {
            factors.push({ factor: 'deadline', impact: 'negative', description: 'Far deadline - might procrastinate' });
        }

        if (userHistory.currentStreak > 7) {
            factors.push({ factor: 'streak', impact: 'positive', description: 'On a roll! Keep it going' });
        }

        return factors;
    }
}

// ============================================
// PATTERN RECOGNIZER - Behavioral Analytics
// ============================================
class PatternRecognizer {
    constructor() {
        this.patterns = new Map();
    }

    /**
     * Analyze user behavior patterns
     */
    analyzePatterns(taskHistory, energyLogs = []) {
        const patterns = {
            productivity: this._analyzeProductivityPatterns(taskHistory),
            timing: this._analyzeTimingPatterns(taskHistory),
            categories: this._analyzeCategoryPatterns(taskHistory),
            energy: this._analyzeEnergyPatterns(energyLogs),
            streaks: this._analyzeStreaks(taskHistory)
        };

        this.patterns = patterns;
        return patterns;
    }

    /**
     * Get personalized insights
     */
    getInsights() {
        const insights = [];
        
        if (this.patterns.productivity) {
            const { peakHours, worstHours } = this.patterns.productivity;
            if (peakHours.length > 0) {
                insights.push({
                    type: 'productivity',
                    title: 'Peak Performance Time',
                    description: `You're most productive between ${peakHours[0]}:00 and ${peakHours[peakHours.length - 1]}:00`,
                    action: 'Schedule important tasks during this time'
                });
            }
        }

        if (this.patterns.streaks) {
            const { bestDay } = this.patterns.streaks;
            if (bestDay) {
                insights.push({
                    type: 'streak',
                    title: 'Best Day',
                    description: `${bestDay} is your most productive day`,
                    action: 'Plan challenging tasks for this day'
                });
            }
        }

        return insights;
    }

    _analyzeProductivityPatterns(taskHistory) {
        const hourlyCompletion = new Array(24).fill(0).map(() => ({ completed: 0, total: 0 }));

        for (const task of taskHistory) {
            if (task.completedAt) {
                const hour = new Date(task.completedAt).getHours();
                hourlyCompletion[hour].completed++;
                hourlyCompletion[hour].total++;
            }
        }

        const rates = hourlyCompletion.map((h, i) => ({
            hour: i,
            rate: h.total > 0 ? h.completed / h.total : 0
        }));

        const sorted = [...rates].sort((a, b) => b.rate - a.rate);
        
        return {
            peakHours: sorted.slice(0, 3).map(h => h.hour),
            worstHours: sorted.slice(-3).map(h => h.hour),
            hourlyRates: rates
        };
    }

    _analyzeTimingPatterns(taskHistory) {
        const dayCompletion = new Array(7).fill(0).map(() => ({ completed: 0, total: 0 }));

        for (const task of taskHistory) {
            const day = new Date(task.createdAt).getDay();
            dayCompletion[day].total++;
            if (task.completed) {
                dayCompletion[day].completed++;
            }
        }

        return {
            byDay: dayCompletion.map((d, i) => ({
                day: i,
                completionRate: d.total > 0 ? d.completed / d.total : 0,
                totalTasks: d.total
            }))
        };
    }

    _analyzeCategoryPatterns(taskHistory) {
        const categoryStats = new Map();

        for (const task of taskHistory) {
            const categories = task.categories || ['personal'];
            for (const cat of categories) {
                if (!categoryStats.has(cat)) {
                    categoryStats.set(cat, { completed: 0, total: 0, avgDuration: 0 });
                }
                const stats = categoryStats.get(cat);
                stats.total++;
                if (task.completed) stats.completed++;
            }
        }

        return Array.from(categoryStats.entries()).map(([cat, stats]) => ({
            category: cat,
            completionRate: stats.total > 0 ? stats.completed / stats.total : 0,
            taskCount: stats.total
        }));
    }

    _analyzeEnergyPatterns(energyLogs) {
        if (energyLogs.length === 0) return null;

        const hourlyEnergy = new Array(24).fill(0).map(() => []);
        
        for (const log of energyLogs) {
            if (log.hour !== undefined) {
                hourlyEnergy[log.hour].push(log.level);
            }
        }

        const averages = hourlyEnergy.map((levels, hour) => ({
            hour,
            average: levels.length > 0 ? levels.reduce((a, b) => a + b, 0) / levels.length : 5
        }));

        return {
            hourlyEnergy: averages,
            peakEnergyHours: [...averages].sort((a, b) => b.average - a.average).slice(0, 3).map(h => h.hour)
        };
    }

    _analyzeStreaks(taskHistory) {
        const sorted = [...taskHistory].sort((a, b) => 
            new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt)
        );

        let currentStreak = 0;
        let bestStreak = 0;
        const dayCounts = new Map();

        for (const task of sorted) {
            if (!task.completed) continue;
            
            const date = new Date(task.completedAt).toDateString();
            const day = new Date(task.completedAt).getDay();
            
            if (!dayCounts.has(date)) {
                dayCounts.set(date, 0);
            }
            dayCounts.set(date, dayCounts.get(date) + 1);
        }

        // Calculate streaks
        const dates = Array.from(dayCounts.keys()).sort((a, b) => new Date(b) - new Date(a));
        let streak = 0;
        let prevDate = null;

        for (const date of dates) {
            const currentDate = new Date(date);
            if (prevDate) {
                const diff = (prevDate - currentDate) / (1000 * 60 * 60 * 24);
                if (diff > 1.5) {
                    bestStreak = Math.max(bestStreak, streak);
                    streak = 0;
                }
            }
            streak++;
            prevDate = currentDate;
        }

        currentStreak = streak;
        bestStreak = Math.max(bestStreak, streak);

        // Find best day
        const dayTotals = new Array(7).fill(0);
        for (const [date, count] of dayCounts) {
            const day = new Date(date).getDay();
            dayTotals[day] += count;
        }
        const bestDay = dayTotals.indexOf(Math.max(...dayTotals));

        return {
            currentStreak,
            bestStreak,
            bestDay: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][bestDay]
        };
    }
}

// ============================================
// AI MANAGER - Main Entry Point
// ============================================
class AIManager {
    constructor(taskRepository, storage) {
        this.taskRepository = taskRepository;
        this.storage = storage;
        
        this.featureExtractor = new FeatureExtractor();
        this.durationPredictor = new DurationPredictor();
        this.categorizer = new SmartCategorizer();
        this.priorityRecommender = new PriorityRecommender();
        this.completionPredictor = new CompletionPredictor();
        this.patternRecognizer = new PatternRecognizer();
        
        this.initialized = false;
    }

    /**
     * Initialize AI pipeline
     */
    async initialize() {
        // Load historical data for training
        const tasks = await this.taskRepository.getAll();
        const historicalData = tasks.filter(t => t.completed && t.actualDuration);

        // Train duration predictor
        if (historicalData.length >= 10) {
            const trainingData = historicalData.map(t => ({
                features: this.featureExtractor.extractFeatures(t),
                duration: t.actualDuration
            }));
            this.durationPredictor.train(trainingData);
        }

        this.initialized = true;
        eventBus.emit('ai:initialized');
        
        console.log('[AI] Pipeline initialized');
    }

    /**
     * Get comprehensive task analysis
     */
    async analyzeTask(task) {
        const tasks = await this.taskRepository.getAll();
        const historicalData = tasks.filter(t => t.completed);

        return {
            category: this.categorizer.predict(task),
            priority: this.priorityRecommender.recommend(task),
            duration: this.durationPredictor.predictWithConfidence(
                this.featureExtractor.extractFeatures(task, historicalData)
            ),
            completionProbability: this.completionPredictor.predictProbability(task),
            suggestedTimeBlocks: this._suggestTimeBlocks(task)
        };
    }

    /**
     * Get smart suggestions for all tasks
     */
    async getSmartSuggestions() {
        const tasks = await this.taskRepository.getAll();
        const activeTasks = tasks.filter(t => !t.completed);

        const suggestions = [];
        for (const task of activeTasks) {
            const analysis = await this.analyzeTask(task);
            suggestions.push({
                taskId: task.id,
                text: task.text,
                ...analysis
            });
        }

        return suggestions;
    }

    /**
     * Get behavioral insights
     */
    async getInsights() {
        const tasks = await this.taskRepository.getAll();
        const patterns = this.patternRecognizer.analyzePatterns(tasks);
        const insights = this.patternRecognizer.getInsights();

        return { patterns, insights };
    }

    /**
     * Auto-categorize uncategorized tasks
     */
    async autoCategorize() {
        const tasks = await this.taskRepository.getAll();
        const uncategorized = tasks.filter(t => !t.categories || t.categories.length === 0);

        const updates = [];
        for (const task of uncategorized) {
            const categories = this.categorizer.predict(task, 2);
            updates.push({
                taskId: task.id,
                categories: categories.map(c => c.category)
            });
        }

        return updates;
    }

    _suggestTimeBlocks(task) {
        // Simple time block suggestions
        const duration = this.durationPredictor.predict(
            this.featureExtractor.extractFeatures(task)
        );
        
        return {
            estimatedDuration: duration,
            suggestedSlots: [
                { time: '09:00', energy: 'high' },
                { time: '14:00', energy: 'medium' },
                { time: '16:00', energy: 'medium' }
            ]
        };
    }
}

// Export
export {
    AIManager,
    FeatureExtractor,
    DurationPredictor,
    SmartCategorizer,
    PriorityRecommender,
    CompletionPredictor,
    PatternRecognizer
};
