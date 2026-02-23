/**
 * Neural Network for Advanced Task Prediction
 * =============================================
 * Multi-layer perceptron with backpropagation for deep learning
 */

/**
 * Activation Functions
 */
export const Activations = {
    sigmoid: {
        forward: (x) => 1 / (1 + Math.exp(-x)),
        derivative: (x) => x * (1 - x)
    },
    relu: {
        forward: (x) => Math.max(0, x),
        derivative: (x) => x > 0 ? 1 : 0
    },
    tanh: {
        forward: (x) => Math.tanh(x),
        derivative: (x) => 1 - x * x
    },
    softmax: {
        forward: (x) => {
            const exp = x.map(v => Math.exp(v));
            const sum = exp.reduce((a, b) => a + b, 0);
            return exp.map(v => v / sum);
        },
        derivative: (x) => x.map(v => v * (1 - v))
    }
};

/**
 * Neural Network Layer
 */
export class Layer {
    constructor(inputSize, outputSize, activation = 'sigmoid') {
        this.inputSize = inputSize;
        this.outputSize = outputSize;
        this.activation = Activations[activation] || Activations.sigmoid;
        
        // Xavier initialization
        const limit = Math.sqrt(6 / (inputSize + outputSize));
        this.weights = [];
        for (let i = 0; i < inputSize; i++) {
            this.weights[i] = [];
            for (let j = 0; j < outputSize; j++) {
                this.weights[i][j] = (Math.random() * 2 - 1) * limit;
            }
        }
        
        this.biases = new Array(outputSize).fill(0);
        
        // For backpropagation
        this.inputs = null;
        this.outputs = null;
        this.weightGradients = null;
        this.biasGradients = null;
    }

    /**
     * Forward pass
     */
    forward(inputs) {
        this.inputs = inputs;
        this.outputs = new Array(this.outputSize).fill(0);
        
        for (let j = 0; j < this.outputSize; j++) {
            let sum = this.biases[j];
            for (let i = 0; i < this.inputSize; i++) {
                sum += inputs[i] * this.weights[i][j];
            }
            this.outputs[j] = this.activation.forward(sum);
        }
        
        return this.outputs;
    }

    /**
     * Backward pass
     */
    backward(outputGradients, learningRate) {
        this.weightGradients = [];
        this.biasGradients = new Array(this.outputSize).fill(0);
        const inputGradients = new Array(this.inputSize).fill(0);
        
        for (let j = 0; j < this.outputSize; j++) {
            const delta = outputGradients[j] * this.activation.derivative(this.outputs[j]);
            this.biasGradients[j] = delta;
            
            for (let i = 0; i < this.inputSize; i++) {
                if (!this.weightGradients[i]) {
                    this.weightGradients[i] = new Array(this.outputSize).fill(0);
                }
                this.weightGradients[i][j] = delta * this.inputs[i];
                inputGradients[i] += delta * this.weights[i][j];
            }
        }
        
        // Update weights and biases
        for (let i = 0; i < this.inputSize; i++) {
            for (let j = 0; j < this.outputSize; j++) {
                this.weights[i][j] -= learningRate * this.weightGradients[i][j];
            }
        }
        
        for (let j = 0; j < this.outputSize; j++) {
            this.biases[j] -= learningRate * this.biasGradients[j];
        }
        
        return inputGradients;
    }

    /**
     * Serialize layer
     */
    toJSON() {
        return {
            inputSize: this.inputSize,
            outputSize: this.outputSize,
            weights: this.weights,
            biases: this.biases,
            activation: Object.keys(Activations).find(
                key => Activations[key] === this.activation
            )
        };
    }

    /**
     * Deserialize layer
     */
    static fromJSON(json) {
        const layer = new Layer(json.inputSize, json.outputSize, json.activation);
        layer.weights = json.weights;
        layer.biases = json.biases;
        return layer;
    }
}

/**
 * Multi-Layer Perceptron
 */
export class MLP {
    constructor(layerSizes, activation = 'sigmoid') {
        this.layers = [];
        this.learningRate = 0.01;
        this.trainingHistory = [];
        
        // Create layers
        for (let i = 0; i < layerSizes.length - 1; i++) {
            const act = i === layerSizes.length - 2 ? 'softmax' : activation;
            this.layers.push(new Layer(layerSizes[i], layerSizes[i + 1], act));
        }
    }

    /**
     * Forward pass through all layers
     */
    forward(inputs) {
        let current = inputs;
        for (const layer of this.layers) {
            current = layer.forward(current);
        }
        return current;
    }

    /**
     * Backward pass through all layers
     */
    backward(outputGradients) {
        let gradients = outputGradients;
        for (let i = this.layers.length - 1; i >= 0; i--) {
            gradients = this.layers[i].backward(gradients, this.learningRate);
        }
    }

    /**
     * Train on single sample
     */
    train(inputs, targets) {
        // Forward pass
        const outputs = this.forward(inputs);
        
        // Calculate output gradients
        const outputGradients = outputs.map((output, i) => output - targets[i]);
        
        // Backward pass
        this.backward(outputGradients);
        
        // Calculate loss (MSE)
        const loss = outputs.reduce((sum, output, i) => 
            sum + Math.pow(output - targets[i], 2), 0
        ) / outputs.length;
        
        return loss;
    }

    /**
     * Train on dataset
     */
    trainDataset(dataset, epochs = 100, onEpoch) {
        for (let epoch = 0; epoch < epochs; epoch++) {
            let totalLoss = 0;
            
            for (const sample of dataset) {
                const loss = this.train(sample.inputs, sample.targets);
                totalLoss += loss;
            }
            
            const avgLoss = totalLoss / dataset.length;
            this.trainingHistory.push({ epoch, loss: avgLoss });
            
            if (onEpoch) {
                onEpoch({ epoch, loss: avgLoss });
            }
        }
        
        return this.trainingHistory;
    }

    /**
     * Predict
     */
    predict(inputs) {
        return this.forward(inputs);
    }

    /**
     * Predict class (for classification)
     */
    predictClass(inputs) {
        const outputs = this.predict(inputs);
        return outputs.indexOf(Math.max(...outputs));
    }

    /**
     * Serialize network
     */
    toJSON() {
        return {
            layerSizes: this.layers.map((l, i) => 
                i === 0 ? l.inputSize : null
            ).concat([this.layers[this.layers.length - 1].outputSize]).filter(x => x !== null),
            layers: this.layers.map(l => l.toJSON()),
            learningRate: this.learningRate,
            trainingHistory: this.trainingHistory
        };
    }

    /**
     * Deserialize network
     */
    static fromJSON(json) {
        const network = new MLP(json.layerSizes);
        network.layers = json.layers.map(l => Layer.fromJSON(l));
        network.learningRate = json.learningRate;
        network.trainingHistory = json.trainingHistory || [];
        return network;
    }
}

/**
 * Task Prediction Neural Network
 */
export class TaskPredictionNN {
    constructor() {
        // Input: text features (10) + priority (3) + category (5) + time features (4) = 22
        // Hidden: 32, 16
        // Output: completion probability + time estimate + priority prediction = 5
        this.network = new MLP([22, 32, 16, 5], 'relu');
        this.trainingData = [];
        this.featureExtractor = new FeatureExtractor();
    }

    /**
     * Extract features from task
     */
    extractFeatures(task) {
        return this.featureExtractor.extract(task);
    }

    /**
     * Train on task data
     */
    async train(tasks, epochs = 50) {
        const dataset = tasks.map(task => {
            const inputs = this.extractFeatures(task);
            const targets = [
                task.completed ? 1 : 0,  // Completion probability
                task.actualTime ? task.actualTime / 60 : 0.5,  // Time estimate (normalized)
                task.priority === 'high' ? 1 : task.priority === 'medium' ? 0.5 : 0,  // Priority
                task.categories?.length || 0,  // Category count
                task.subtasks?.filter(s => s.completed).length / (task.subtasks?.length || 1)  // Subtask completion
            ];
            
            return { inputs, targets };
        });

        this.trainingData = dataset;
        
        return new Promise((resolve) => {
            this.network.trainDataset(dataset, epochs, (progress) => {
                if (progress.epoch % 10 === 0) {
                    console.log(`Training progress: Epoch ${progress.epoch}, Loss: ${progress.loss.toFixed(4)}`);
                }
            });
            
            resolve(this.network.trainingHistory);
        });
    }

    /**
     * Predict task outcomes
     */
    predict(task) {
        const features = this.extractFeatures(task);
        const outputs = this.network.predict(features);
        
        return {
            completionProbability: outputs[0],
            estimatedTimeMinutes: outputs[1] * 60,
            predictedPriority: outputs[2] > 0.66 ? 'high' : outputs[2] > 0.33 ? 'medium' : 'low',
            suggestedCategoryCount: Math.round(outputs[3]),
            subtaskCompletionRate: outputs[4]
        };
    }

    /**
     * Get feature importance
     */
    getFeatureImportance() {
        const importance = {};
        const featureNames = this.featureExtractor.getFeatureNames();
        
        // Analyze first layer weights
        this.network.layers[0].weights.forEach((weights, i) => {
            const avgWeight = weights.reduce((a, b) => a + Math.abs(b), 0) / weights.length;
            importance[featureNames[i]] = avgWeight;
        });
        
        // Sort by importance
        return Object.entries(importance)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
    }

    /**
     * Export model
     */
    export() {
        return {
            network: this.network.toJSON(),
            featureExtractor: this.featureExtractor.toJSON(),
            trainingDataSize: this.trainingData.length
        };
    }

    /**
     * Import model
     */
    import(data) {
        this.network = MLP.fromJSON(data.network);
        this.featureExtractor = FeatureExtractor.fromJSON(data.featureExtractor);
        this.trainingData = new Array(data.trainingDataSize);
    }
}

/**
 * Feature Extractor for Tasks
 */
export class FeatureExtractor {
    constructor() {
        this.textLength = 100;
        this.maxWords = 20;
        this.vocabSize = 1000;
        this.wordIndex = new Map();
    }

    /**
     * Extract features from task
     */
    extract(task) {
        const features = [];
        
        // Text features (10)
        const textFeatures = this.extractTextFeatures(task.text);
        features.push(...textFeatures);
        
        // Priority features (3) - one-hot
        features.push(
            task.priority === 'high' ? 1 : 0,
            task.priority === 'medium' ? 1 : 0,
            task.priority === 'low' ? 1 : 0
        );
        
        // Category features (5)
        const categoryFeatures = this.extractCategoryFeatures(task.categories || []);
        features.push(...categoryFeatures);
        
        // Time features (4)
        const timeFeatures = this.extractTimeFeatures(task);
        features.push(...timeFeatures);
        
        return features;
    }

    /**
     * Extract text features
     */
    extractTextFeatures(text) {
        const features = [];
        
        // Normalized length
        features.push(Math.min(text.length / this.textLength, 1));
        
        // Word count
        const words = text.split(/\s+/);
        features.push(Math.min(words.length / this.maxWords, 1));
        
        // Average word length
        const avgWordLength = words.reduce((a, b) => a + b.length, 0) / words.length;
        features.push(avgWordLength / 10);
        
        // Has numbers
        features.push(/\d/.test(text) ? 1 : 0);
        
        // Has urgency words
        const urgencyWords = ['urgent', 'asap', 'now', 'today', 'deadline', 'important'];
        features.push(urgencyWords.some(w => text.toLowerCase().includes(w)) ? 1 : 0);
        
        // Has action verbs
        const actionVerbs = ['complete', 'finish', 'send', 'call', 'write', 'create'];
        features.push(actionVerbs.some(w => text.toLowerCase().includes(w)) ? 1 : 0);
        
        // Question mark
        features.push(text.includes('?') ? 1 : 0);
        
        // Exclamation mark
        features.push(text.includes('!') ? 1 : 0);
        
        // Uppercase ratio
        const uppercase = text.replace(/[^A-Z]/g, '').length;
        features.push(uppercase / (text.length || 1));
        
        // Unique character ratio
        const uniqueChars = new Set(text.toLowerCase()).size;
        features.push(uniqueChars / 26);
        
        return features;
    }

    /**
     * Extract category features
     */
    extractCategoryFeatures(categories) {
        const features = new Array(5).fill(0);
        
        const commonCategories = ['work', 'personal', 'shopping', 'health', 'other'];
        categories.forEach(cat => {
            const index = commonCategories.indexOf(cat.toLowerCase());
            if (index >= 0) {
                features[index] = 1;
            }
        });
        
        return features;
    }

    /**
     * Extract time features
     */
    extractTimeFeatures(task) {
        const features = [];
        
        // Has due date
        features.push(task.dueDate ? 1 : 0);
        
        // Days until due
        if (task.dueDate) {
            const dueDate = new Date(task.dueDate);
            const now = new Date();
            const daysUntil = (dueDate - now) / (1000 * 60 * 60 * 24);
            features.push(Math.max(0, Math.min(daysUntil / 30, 1)));
        } else {
            features.push(0);
        }
        
        // Is overdue
        features.push(task.dueDate && new Date(task.dueDate) < new Date() ? 1 : 0);
        
        // Is due today
        features.push(task.dueDate && 
            new Date(task.dueDate).toDateString() === new Date().toDateString() ? 1 : 0);
        
        return features;
    }

    /**
     * Get feature names
     */
    getFeatureNames() {
        return [
            'textLength', 'wordCount', 'avgWordLength', 'hasNumbers', 'hasUrgency',
            'hasActionVerbs', 'isQuestion', 'isExclamation', 'uppercaseRatio', 'uniqueCharRatio',
            'priorityHigh', 'priorityMedium', 'priorityLow',
            'catWork', 'catPersonal', 'catShopping', 'catHealth', 'catOther',
            'hasDueDate', 'daysUntilDue', 'isOverdue', 'isDueToday'
        ];
    }

    /**
     * Serialize
     */
    toJSON() {
        return {
            textLength: this.textLength,
            maxWords: this.maxWords,
            vocabSize: this.vocabSize,
            wordIndex: Array.from(this.wordIndex.entries())
        };
    }

    /**
     * Deserialize
     */
    static fromJSON(json) {
        const extractor = new FeatureExtractor();
        extractor.textLength = json.textLength;
        extractor.maxWords = json.maxWords;
        extractor.vocabSize = json.vocabSize;
        extractor.wordIndex = new Map(json.wordIndex);
        return extractor;
    }
}

/**
 * Create task prediction neural network
 */
export function createTaskPredictionNN() {
    return new TaskPredictionNN();
}
