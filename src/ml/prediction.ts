/**
 * AI/ML Pipeline for Smart Task Management
 * =========================================
 * Machine learning for task prediction, categorization, and suggestions
 */

import type { Task, Priority, TaskId } from '../types';

// ============================================
// FEATURE EXTRACTION
// ============================================

interface TaskFeatures {
  textLength: number;
  wordCount: number;
  hasDueDate: number;
  daysUntilDue: number;
  hasTags: number;
  tagCount: number;
  hasSubtasks: number;
  subtaskCount: number;
  priorityScore: number;
  containsUrgentWords: number;
  containsTimeWords: number;
  complexity: number;
}

interface UserPattern {
  avgCompletionTime: number;
  peakProductivityHour: number;
  preferredPriorities: Record<Priority, number>;
  categoryPreferences: Map<string, number>;
  completionRateByDay: number[];
  completionRate: number;
}

// ============================================
// NAIVE BAYES CLASSIFIER
// ============================================

class NaiveBayesClassifier {
  private wordProbabilities: Map<string, Map<string, number>> = new Map();
  private classProbabilities: Map<string, number> = new Map();
  private totalDocuments: number = 0;

  /**
   * Train classifier with labeled data
   */
  train(data: Array<{ text: string; label: string }>): void {
    const wordCounts: Map<string, Map<string, number>> = new Map();
    const classCounts: Map<string, number> = new Map();

    // Count words per class
    for (const { text, label } of data) {
      const words = this.tokenize(text);
      classCounts.set(label, (classCounts.get(label) || 0) + 1);

      if (!wordCounts.has(label)) {
        wordCounts.set(label, new Map());
      }

      for (const word of words) {
        const wordMap = wordCounts.get(label)!;
        wordMap.set(word, (wordMap.get(word) || 0) + 1);
      }
    }

    this.totalDocuments = data.length;

    // Calculate probabilities with Laplace smoothing
    for (const [label, count] of classCounts.entries()) {
      this.classProbabilities.set(label, count / this.totalDocuments);

      const vocabSize = new Set([...wordCounts.get(label)!.keys()]).size;
      const totalWords = Array.from(wordCounts.get(label)!.values()).reduce((a, b) => a + b, 0);

      const wordProbs = new Map<string, number>();
      for (const [word, wordCount] of wordCounts.get(label)!.entries()) {
        // Laplace smoothing
        const prob = (wordCount + 1) / (totalWords + vocabSize);
        wordProbs.set(word, prob);
      }
      this.wordProbabilities.set(label, wordProbs);
    }
  }

  /**
   * Predict class for new text
   */
  predict(text: string): { label: string; confidence: number } {
    const words = this.tokenize(text);
    let bestLabel = '';
    let bestScore = -Infinity;

    for (const [label, prior] of this.classProbabilities.entries()) {
      let logProb = Math.log(prior);
      const wordProbs = this.wordProbabilities.get(label) || new Map();

      for (const word of words) {
        const prob = wordProbs.get(word) || 1e-10; // Small value for unknown words
        logProb += Math.log(prob);
      }

      if (logProb > bestScore) {
        bestScore = logProb;
        bestLabel = label;
      }
    }

    // Convert log probability to confidence
    const confidence = Math.exp(bestScore);

    return { label: bestLabel, confidence: Math.min(confidence * 100, 99.9) };
  }

  /**
   * Tokenize text into words
   */
  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2);
  }
}

// ============================================
// LINEAR REGRESSION FOR TIME ESTIMATION
// ============================================

class LinearRegression {
  private weights: number[] = [];
  private bias: number = 0;
  private learningRate: number = 0.01;
  private iterations: number = 1000;

  /**
   * Train model with gradient descent
   */
  train(X: number[][], y: number[]): void {
    const n = X.length;
    const m = X[0].length;

    // Initialize weights
    this.weights = new Array(m).fill(0);
    this.bias = 0;

    // Gradient descent
    for (let iter = 0; iter < this.iterations; iter++) {
      const predictions = X.map(row => this.predictRow(row));
      const errors = predictions.map((pred, i) => pred - y[i]);

      // Update weights
      for (let j = 0; j < m; j++) {
        let gradient = 0;
        for (let i = 0; i < n; i++) {
          gradient += errors[i] * X[i][j];
        }
        this.weights[j] -= this.learningRate * (gradient / n);
      }

      // Update bias
      const biasGradient = errors.reduce((a, b) => a + b, 0) / n;
      this.bias -= this.learningRate * biasGradient;
    }
  }

  /**
   * Predict for single row
   */
  private predictRow(row: number[]): number {
    let sum = this.bias;
    for (let i = 0; i < row.length; i++) {
      sum += this.weights[i] * row[i];
    }
    return sum;
  }

  /**
   * Predict for new input
   */
  predict(features: number[]): number {
    return this.predictRow(features);
  }

  /**
   * Get model parameters
   */
  getParameters(): { weights: number[]; bias: number } {
    return { weights: [...this.weights], bias: this.bias };
  }
}

// ============================================
// NEURAL NETWORK (SIMPLE)
// ============================================

class SimpleNeuralNetwork {
  private layers: number[];
  private weights: number[][][];
  private biases: number[][];
  private learningRate: number = 0.1;

  constructor(layerSizes: number[]) {
    this.layers = layerSizes;
    this.weights = [];
    this.biases = [];
    this.initializeWeights();
  }

  /**
   * Initialize weights with random values
   */
  private initializeWeights(): void {
    for (let i = 0; i < this.layers.length - 1; i++) {
      const layerWeights: number[][] = [];
      const layerBiases: number[] = [];

      for (let j = 0; j < this.layers[i + 1]; j++) {
        const neuronWeights: number[] = [];
        for (let k = 0; k < this.layers[i]; k++) {
          neuronWeights.push(Math.random() * 2 - 1);
        }
        layerWeights.push(neuronWeights);
        layerBiases.push(Math.random() * 2 - 1);
      }

      this.weights.push(layerWeights);
      this.biases.push(layerBiases);
    }
  }

  /**
   * Activation function (ReLU)
   */
  private relu(x: number): number {
    return Math.max(0, x);
  }

  /**
   * Derivative of ReLU
   */
  private reluDerivative(x: number): number {
    return x > 0 ? 1 : 0;
  }

  /**
   * Forward propagation
   */
  forward(input: number[]): number[] {
    let activations = input;

    for (let i = 0; i < this.weights.length; i++) {
      const newActivations: number[] = [];
      const layerWeights = this.weights[i];
      const layerBiases = this.biases[i];

      for (let j = 0; j < layerWeights.length; j++) {
        let sum = layerBiases[j];
        for (let k = 0; k < activations.length; k++) {
          sum += activations[k] * layerWeights[j][k];
        }
        newActivations.push(this.relu(sum));
      }

      activations = newActivations;
    }

    return activations;
  }

  /**
   * Train network (simplified backpropagation)
   */
  train(inputs: number[][], targets: number[][], epochs: number = 100): void {
    for (let epoch = 0; epoch < epochs; epoch++) {
      let totalError = 0;

      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        const target = targets[i];

        // Forward pass
        const output = this.forward(input);

        // Calculate error
        let error = 0;
        for (let j = 0; j < output.length; j++) {
          error += Math.pow(output[j] - target[j], 2);
        }
        totalError += error;

        // Backward pass (simplified weight update)
        for (let l = this.weights.length - 1; l >= 0; l--) {
          for (let j = 0; j < this.weights[l].length; j++) {
            for (let k = 0; k < this.weights[l][j].length; k++) {
              const gradient = (output[j] - target[j]) * input[k];
              this.weights[l][j][k] -= this.learningRate * gradient;
            }
            this.biases[l][j] -= this.learningRate * (output[j] - target[j]);
          }
        }
      }

      if (epoch % 10 === 0) {
        console.log(`Epoch ${epoch}, Error: ${totalError / inputs.length}`);
      }
    }
  }
}

// ============================================
// TASK PREDICTION ENGINE
// ============================================

export class TaskPredictionEngine {
  private priorityClassifier: NaiveBayesClassifier;
  private timeEstimator: LinearRegression;
  private completionPredictor: SimpleNeuralNetwork;
  private userPatterns: Map<string, UserPattern> = new Map();
  private trainingData: Array<{ task: Task; actualTime: number; completed: boolean }> = [];

  constructor() {
    this.priorityClassifier = new NaiveBayesClassifier();
    this.timeEstimator = new LinearRegression();
    this.completionPredictor = new SimpleNeuralNetwork([10, 8, 4, 1]);
    this.initializeDefaultModels();
  }

  /**
   * Initialize with default training data
   */
  private initializeDefaultModels(): void {
    // Priority classification training data
    const priorityData = [
      { text: 'urgent meeting tomorrow critical emergency', label: 'critical' },
      { text: 'important deadline high priority asap', label: 'high' },
      { text: 'regular task normal routine', label: 'medium' },
      { text: 'optional whenever low priority nice to have', label: 'low' },
      { text: 'buy groceries call mom walk dog', label: 'low' },
      { text: 'submit report finish project client presentation', label: 'high' },
      { text: 'server down production issue critical bug', label: 'critical' },
    ];
    this.priorityClassifier.train(priorityData);

    // Time estimation training data
    const timeData = [
      [50, 1, 0, 0, 0],  // text length, has due date, etc.
      [100, 1, 1, 3, 0],
      [30, 0, 0, 0, 1],
      [200, 1, 1, 7, 1],
    ];
    const timeTargets = [15, 45, 10, 120];
    this.timeEstimator.train(timeData, timeTargets);
  }

  /**
   * Predict task priority from text
   */
  predictPriority(text: string): { priority: Priority; confidence: number } {
    const result = this.priorityClassifier.predict(text);
    return {
      priority: result.label as Priority,
      confidence: result.confidence
    };
  }

  /**
   * Estimate task completion time
   */
  estimateTime(task: Task): number {
    const features = this.extractFeatures(task);
    const estimatedMinutes = this.timeEstimator.predict([
      features.textLength,
      features.hasDueDate,
      features.daysUntilDue,
      features.hasSubtasks,
      features.complexity
    ]);

    return Math.max(5, Math.round(estimatedMinutes));
  }

  /**
   * Predict task completion probability
   */
  predictCompletion(task: Task, userId: string): number {
    const features = this.extractFeatures(task);
    const pattern = this.userPatterns.get(userId);

    const input = [
      features.textLength / 500,
      features.priorityScore / 4,
      features.hasDueDate,
      features.daysUntilDue / 30,
      pattern ? pattern.completionRate : 0.5,
      pattern ? pattern.avgCompletionTime / 60 : 0.5,
      features.complexity / 10,
      features.hasTags,
      features.hasSubtasks,
      1 // bias
    ];

    const output = this.completionPredictor.forward(input);
    return output[0];
  }

  /**
   * Extract numerical features from task
   */
  private extractFeatures(task: Task): TaskFeatures {
    const urgentWords = ['urgent', 'critical', 'emergency', 'asap', 'deadline'];
    const timeWords = ['tomorrow', 'today', 'meeting', 'call', 'schedule'];

    const textLower = task.text.toLowerCase();

    return {
      textLength: task.text.length,
      wordCount: task.text.split(/\s+/).length,
      hasDueDate: task.dueDate ? 1 : 0,
      daysUntilDue: task.dueDate
        ? Math.max(0, (new Date(task.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : 0,
      hasTags: task.tags?.length ? 1 : 0,
      tagCount: task.tags?.length || 0,
      hasSubtasks: task.subtasks?.length ? 1 : 0,
      subtaskCount: task.subtasks?.length || 0,
      priorityScore: { low: 1, medium: 2, high: 3, critical: 4 }[task.priority],
      containsUrgentWords: urgentWords.some(w => textLower.includes(w)) ? 1 : 0,
      containsTimeWords: timeWords.some(w => textLower.includes(w)) ? 1 : 0,
      complexity: this.calculateComplexity(task)
    };
  }

  /**
   * Calculate task complexity score
   */
  private calculateComplexity(task: Task): number {
    let complexity = 0;

    // Longer text = more complex
    complexity += Math.min(task.text.length / 100, 3);

    // More subtasks = more complex
    complexity += (task.subtasks?.length || 0) * 0.5;

    // Higher priority often means more complex
    complexity += { low: 0, medium: 1, high: 2, critical: 3 }[task.priority];

    // Due date pressure
    if (task.dueDate) {
      const daysUntil = (new Date(task.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysUntil < 1) complexity += 2;
      else if (daysUntil < 3) complexity += 1;
    }

    return Math.min(complexity, 10);
  }

  /**
   * Record task outcome for learning
   */
  recordOutcome(task: Task, actualTimeMinutes: number, completed: boolean): void {
    this.trainingData.push({ task, actualTime: actualTimeMinutes, completed });

    // Retrain periodically
    if (this.trainingData.length % 10 === 0) {
      this.retrainModels();
    }
  }

  /**
   * Retrain models with new data
   */
  private retrainModels(): void {
    if (this.trainingData.length < 5) return;

    // Prepare time estimation training data
    const X: number[][] = [];
    const y: number[] = [];

    for (const { task, actualTime } of this.trainingData) {
      const features = this.extractFeatures(task);
      X.push([
        features.textLength,
        features.hasDueDate,
        features.daysUntilDue,
        features.hasSubtasks,
        features.complexity
      ]);
      y.push(actualTime);
    }

    this.timeEstimator.train(X, y);
  }

  /**
   * Update user pattern
   */
  updateUserPattern(userId: string, tasks: Task[]): void {
    const completedTasks = tasks.filter(t => t.status === 'completed' && t.completedAt);

    // Calculate average completion time
    const completionTimes = completedTasks.map(t => {
      const created = new Date(t.createdAt).getTime();
      const completed = new Date(t.completedAt!).getTime();
      return (completed - created) / (1000 * 60 * 60); // hours
    });

    const avgCompletionTime = completionTimes.length > 0
      ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
      : 24;

    // Calculate completion rate by day of week
    const completionRateByDay = new Array(7).fill(0);
    const dayCounts = new Array(7).fill(0);

    for (const task of tasks) {
      const dayOfWeek = new Date(task.createdAt).getDay();
      dayCounts[dayOfWeek]++;
      if (task.status === 'completed') {
        completionRateByDay[dayOfWeek]++;
      }
    }

    for (let i = 0; i < 7; i++) {
      completionRateByDay[i] = dayCounts[i] > 0
        ? completionRateByDay[i] / dayCounts[i]
        : 0;
    }

    // Find peak productivity hour (simplified)
    const peakProductivityHour = 10; // Default to 10 AM

    // Count priority preferences
    const preferredPriorities: Record<Priority, number> = {
      low: tasks.filter(t => t.priority === 'low').length,
      medium: tasks.filter(t => t.priority === 'medium').length,
      high: tasks.filter(t => t.priority === 'high').length,
      critical: tasks.filter(t => t.priority === 'critical').length
    };

    // Count category preferences
    const categoryPreferences = new Map<string, number>();
    for (const task of tasks) {
      for (const cat of task.categories || []) {
        categoryPreferences.set(cat, (categoryPreferences.get(cat) || 0) + 1);
      }
    }

    // Calculate overall completion rate
    const completionRate = tasks.length > 0
      ? completedTasks.length / tasks.length
      : 0;

    this.userPatterns.set(userId, {
      avgCompletionTime,
      peakProductivityHour,
      preferredPriorities,
      categoryPreferences,
      completionRateByDay,
      completionRate
    });
  }

  /**
   * Get smart suggestions for user
   */
  getSuggestions(userId: string, tasks: Task[]): Array<{
    type: string;
    message: string;
    priority: 'low' | 'medium' | 'high';
  }> {
    const suggestions: Array<{
      type: string;
      message: string;
      priority: 'low' | 'medium' | 'high';
    }> = [];

    const pattern = this.userPatterns.get(userId);

    // Suggest based on patterns
    if (pattern) {
      // Low completion rate suggestion
      const overallRate = tasks.filter(t => t.status === 'completed').length / tasks.length;
      if (overallRate < 0.5 && tasks.length > 5) {
        suggestions.push({
          type: 'productivity',
          message: 'Your completion rate is below 50%. Consider breaking tasks into smaller subtasks.',
          priority: 'high'
        });
      }

      // Overdue tasks suggestion
      const overdueTasks = tasks.filter(t =>
        t.dueDate &&
        new Date(t.dueDate) < new Date() &&
        t.status !== 'completed'
      );

      if (overdueTasks.length > 3) {
        suggestions.push({
          type: 'deadline',
          message: `You have ${overdueTasks.length} overdue tasks. Focus on completing these first.`,
          priority: 'high'
        });
      }
    }

    // Priority imbalance suggestion
    const criticalCount = tasks.filter(t => t.priority === 'critical').length;
    if (criticalCount > 5) {
      suggestions.push({
        type: 'priority',
        message: 'You have many critical tasks. Consider reprioritizing to focus on what truly matters.',
        priority: 'medium'
      });
    }

    return suggestions;
  }

  /**
   * Get user pattern
   */
  getUserPattern(userId: string): UserPattern | null {
    return this.userPatterns.get(userId) || null;
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const taskPredictionEngine = new TaskPredictionEngine();
