/**
 * ML-Based Task Prediction
 * =========================
 * Simple machine learning for task categorization and time estimation
 */

import { eventBus, EVENTS } from '../core/event-bus.js';

/**
 * Naive Bayes Classifier for text categorization
 */
export class NaiveBayesClassifier {
    constructor() {
        this.classes = new Map(); // class -> count
        this.features = new Map(); // class -> Map(feature -> count)
        this.totalDocuments = 0;
        this.smoothing = 1; // Laplace smoothing
    }

    /**
     * Train the classifier
     */
    train(text, category) {
        const tokens = this.tokenize(text);
        
        // Update class count
        this.classes.set(category, (this.classes.get(category) || 0) + 1);
        this.totalDocuments++;

        // Update feature counts
        if (!this.features.has(category)) {
            this.features.set(category, new Map());
        }
        
        const classFeatures = this.features.get(category);
        tokens.forEach(token => {
            classFeatures.set(token, (classFeatures.get(token) || 0) + 1);
        });
    }

    /**
     * Classify text
     */
    classify(text) {
        const tokens = this.tokenize(text);
        const scores = [];

        for (const [category, classCount] of this.classes.entries()) {
            // Prior probability
            const prior = classCount / this.totalDocuments;
            
            // Calculate feature probabilities
            let logProb = Math.log(prior);
            const classFeatures = this.features.get(category);
            const totalFeatures = Array.from(classFeatures.values()).reduce((a, b) => a + b, 0);

            tokens.forEach(token => {
                const featureCount = classFeatures.get(token) || 0;
                // Laplace smoothing
                const prob = (featureCount + this.smoothing) / (totalFeatures + this.smoothing * this.vocabularySize());
                logProb += Math.log(prob);
            });

            scores.push({ category, score: logProb });
        }

        // Sort by score and return
        scores.sort((a, b) => b.score - a.score);
        return {
            predicted: scores[0]?.category || null,
            scores: scores,
            confidence: scores.length > 1 ? this.softmax(scores[0].score, scores[1].score) : 1
        };
    }

    /**
     * Get vocabulary size
     */
    vocabularySize() {
        const allFeatures = new Set();
        this.features.forEach(features => {
            features.forEach((_, feature) => allFeatures.add(feature));
        });
        return allFeatures.size;
    }

    /**
     * Softmax for confidence
     */
    softmax(score1, score2) {
        const exp1 = Math.exp(score1 - score2);
        return exp1 / (1 + exp1);
    }

    /**
     * Tokenize text
     */
    tokenize(text) {
        return text
            .toLowerCase()
            .split(/\W+/)
            .filter(token => token.length > 2);
    }

    /**
     * Get class distribution
     */
    getDistribution() {
        const distribution = {};
        this.classes.forEach((count, category) => {
            distribution[category] = count / this.totalDocuments;
        });
        return distribution;
    }

    /**
     * Serialize model
     */
    toJSON() {
        return {
            classes: Array.from(this.classes.entries()),
            features: Array.from(this.features.entries()).map(([cat, features]) => [
                cat,
                Array.from(features.entries())
            ]),
            totalDocuments: this.totalDocuments
        };
    }

    /**
     * Deserialize model
     */
    static fromJSON(data) {
        const classifier = new NaiveBayesClassifier();
        classifier.classes = new Map(data.classes);
        classifier.features = new Map(
            data.features.map(([cat, features]) => [cat, new Map(features)])
        );
        classifier.totalDocuments = data.totalDocuments;
        return classifier;
    }
}

/**
 * Linear Regression for time estimation
 */
export class LinearRegression {
    constructor() {
        this.weights = null;
        this.bias = 0;
        this.learningRate = 0.01;
        this.iterations = 1000;
        this.trained = false;
    }

    /**
     * Train the model
     */
    train(X, y) {
        const n = X.length;
        const m = X[0].length;
        
        // Initialize weights
        this.weights = new Array(m).fill(0);
        this.bias = 0;

        // Gradient descent
        for (let iter = 0; iter < this.iterations; iter++) {
            // Calculate predictions
            const predictions = X.map(row => 
                this.dot(row, this.weights) + this.bias
            );

            // Calculate gradients
            const weightGradients = new Array(m).fill(0);
            let biasGradient = 0;

            for (let i = 0; i < n; i++) {
                const error = predictions[i] - y[i];
                biasGradient += error;
                for (let j = 0; j < m; j++) {
                    weightGradients[j] += error * X[i][j];
                }
            }

            // Update weights
            for (let j = 0; j < m; j++) {
                this.weights[j] -= (this.learningRate / n) * weightGradients[j];
            }
            this.bias -= (this.learningRate / n) * biasGradient;
        }

        this.trained = true;
    }

    /**
     * Predict
     */
    predict(X) {
        if (!this.trained) {
            throw new Error('Model not trained');
        }
        
        if (Array.isArray(X[0])) {
            return X.map(row => this.dot(row, this.weights) + this.bias);
        }
        return this.dot(X, this.weights) + this.bias;
    }

    /**
     * Dot product
     */
    dot(a, b) {
        return a.reduce((sum, val, i) => sum + val * b[i], 0);
    }

    /**
     * Serialize model
     */
    toJSON() {
        return {
            weights: this.weights,
            bias: this.bias,
            trained: this.trained
        };
    }

    /**
     * Deserialize model
     */
    static fromJSON(data) {
        const model = new LinearRegression();
        model.weights = data.weights;
        model.bias = data.bias;
        model.trained = data.trained;
        return model;
    }
}

/**
 * Task Pattern Analyzer
 */
export class TaskPatternAnalyzer {
    constructor() {
        this.categoryClassifier = new NaiveBayesClassifier();
        this.priorityClassifier = new NaiveBayesClassifier();
        this.timeEstimator = new LinearRegression();
        this.taskHistory = [];
        this.productivityData = [];
    }

    /**
     * Record completed task for learning
     */
    recordTask(task) {
        this.taskHistory.push({
            text: task.text,
            category: task.categories?.[0] || 'uncategorized',
            priority: task.priority,
            actualTime: task.actualTime || null,
            estimatedTime: task.estimatedTime || null,
            completedAt: task.completedAt,
            createdAt: task.createdAt
        });

        // Train classifiers
        if (task.categories?.length > 0) {
            this.categoryClassifier.train(task.text, task.categories[0]);
        }
        
        this.priorityClassifier.train(task.text, task.priority);

        // Train time estimator if we have data
        if (task.actualTime) {
            this.trainTimeEstimator();
        }
    }

    /**
     * Train time estimator from history
     */
    trainTimeEstimator() {
        const X = [];
        const y = [];

        this.taskHistory.forEach(task => {
            if (task.actualTime) {
                // Features: text length, word count, has due date, priority encoding
                const features = [
                    task.text.length / 100,
                    task.text.split(' ').length / 20,
                    task.dueDate ? 1 : 0,
                    task.priority === 'high' ? 1 : task.priority === 'medium' ? 0.5 : 0
                ];
                X.push(features);
                y.push(task.actualTime);
            }
        });

        if (X.length >= 5) {
            this.timeEstimator.train(X, y);
        }
    }

    /**
     * Predict category for new task
     */
    predictCategory(text) {
        return this.categoryClassifier.classify(text);
    }

    /**
     * Predict priority for new task
     */
    predictPriority(text) {
        return this.priorityClassifier.classify(text);
    }

    /**
     * Estimate time for task
     */
    estimateTime(text, priority = 'medium', hasDueDate = false) {
        const features = [
            text.length / 100,
            text.split(' ').length / 20,
            hasDueDate ? 1 : 0,
            priority === 'high' ? 1 : priority === 'medium' ? 0.5 : 0
        ];
        
        const estimatedMinutes = this.timeEstimator.predict(features);
        return Math.max(5, Math.round(estimatedMinutes)); // Minimum 5 minutes
    }

    /**
     * Get productivity insights
     */
    analyzeProductivity() {
        if (this.taskHistory.length < 5) {
            return { message: 'Not enough data for analysis' };
        }

        // Calculate average completion time by category
        const categoryTimes = {};
        const categoryCounts = {};

        this.taskHistory
            .filter(t => t.actualTime && t.category !== 'uncategorized')
            .forEach(task => {
                if (!categoryTimes[task.category]) {
                    categoryTimes[task.category] = 0;
                    categoryCounts[task.category] = 0;
                }
                categoryTimes[task.category] += task.actualTime;
                categoryCounts[task.category]++;
            });

        const avgTimes = {};
        Object.keys(categoryTimes).forEach(cat => {
            avgTimes[cat] = Math.round(categoryTimes[cat] / categoryCounts[cat]);
        });

        // Calculate best productivity hours
        const hourCompletions = {};
        this.taskHistory
            .filter(t => t.completedAt)
            .forEach(task => {
                const hour = new Date(task.completedAt).getHours();
                hourCompletions[hour] = (hourCompletions[hour] || 0) + 1;
            });

        const bestHour = Object.entries(hourCompletions)
            .sort((a, b) => b[1] - a[1])[0];

        // Calculate completion rate trend
        const recentCompleted = this.taskHistory
            .slice(-20)
            .filter(t => t.completedAt)
            .length;
        const olderCompleted = this.taskHistory
            .slice(-40, -20)
            .filter(t => t.completedAt)
            .length;

        return {
            avgTimeByCategory: avgTimes,
            bestProductivityHour: bestHour ? parseInt(bestHour[0]) : null,
            completionTrend: recentCompleted > olderCompleted ? 'improving' : 'stable',
            totalTasksAnalyzed: this.taskHistory.length
        };
    }

    /**
     * Get suggestions for task
     */
    getSuggestions(text) {
        const categoryPrediction = this.predictCategory(text);
        const priorityPrediction = this.predictPriority(text);
        const timeEstimate = this.estimateTime(text, priorityPrediction.predicted);

        const suggestions = [];

        if (categoryPrediction.confidence > 0.6) {
            suggestions.push({
                type: 'category',
                value: categoryPrediction.predicted,
                confidence: Math.round(categoryPrediction.confidence * 100)
            });
        }

        if (priorityPrediction.confidence > 0.6) {
            suggestions.push({
                type: 'priority',
                value: priorityPrediction.predicted,
                confidence: Math.round(priorityPrediction.confidence * 100)
            });
        }

        suggestions.push({
            type: 'timeEstimate',
            value: timeEstimate,
            unit: 'minutes'
        });

        return suggestions;
    }

    /**
     * Export model
     */
    exportModel() {
        return {
            categoryClassifier: this.categoryClassifier.toJSON(),
            priorityClassifier: this.priorityClassifier.toJSON(),
            timeEstimator: this.timeEstimator.toJSON(),
            taskHistory: this.taskHistory.slice(-100) // Last 100 tasks
        };
    }

    /**
     * Import model
     */
    importModel(data) {
        if (data.categoryClassifier) {
            this.categoryClassifier = NaiveBayesClassifier.fromJSON(data.categoryClassifier);
        }
        if (data.priorityClassifier) {
            this.priorityClassifier = NaiveBayesClassifier.fromJSON(data.priorityClassifier);
        }
        if (data.timeEstimator) {
            this.timeEstimator = LinearRegression.fromJSON(data.timeEstimator);
        }
        if (data.taskHistory) {
            this.taskHistory = data.taskHistory;
        }
    }
}

/**
 * Smart Task Suggestions
 */
export class SmartSuggestions {
    constructor(analyzer) {
        this.analyzer = analyzer;
    }

    /**
     * Get suggestions when creating task
     */
    onTaskCreate(text) {
        return this.analyzer.getSuggestions(text);
    }

    /**
     * Get batch suggestions for all active tasks
     */
    getBatchSuggestions(tasks) {
        return tasks
            .filter(t => !t.completed)
            .map(task => ({
                taskId: task.id,
                text: task.text,
                suggestions: this.analyzer.getSuggestions(task.text)
            }));
    }

    /**
     * Get productivity report
     */
    getProductivityReport() {
        return this.analyzer.analyzeProductivity();
    }
}

/**
 * Create ML system
 */
export function createMLSystem() {
    const analyzer = new TaskPatternAnalyzer();
    const suggestions = new SmartSuggestions(analyzer);
    
    // Load saved model
    const savedModel = localStorage.getItem('taskmaster-ml-model');
    if (savedModel) {
        try {
            analyzer.importModel(JSON.parse(savedModel));
        } catch (e) {
            console.warn('Failed to load ML model');
        }
    }

    // Auto-save model periodically
    setInterval(() => {
        localStorage.setItem('taskmaster-ml-model', JSON.stringify(analyzer.exportModel()));
    }, 60000); // Every minute

    return { analyzer, suggestions };
}
