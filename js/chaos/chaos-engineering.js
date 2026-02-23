/**
 * Chaos Engineering for System Resilience
 * =========================================
 * Intentionally inject failures to test system robustness
 */

import { eventBus, EVENTS } from '../core/event-bus.js';

/**
 * Chaos Monkey - Random failure injection
 */
export class ChaosMonkey {
    constructor() {
        this.enabled = false;
        this.chaosLevel = 0.1; // 10% failure rate
        this.failureLog = [];
        this.excludedOperations = new Set();
        this.activeAttacks = [];
    }

    /**
     * Enable chaos mode
     */
    enable(level = 0.1) {
        this.enabled = true;
        this.chaosLevel = Math.max(0, Math.min(1, level));
        
        eventBus.emit(EVENTS.CHAOS_ENABLED, { level: this.chaosLevel });
        
        console.warn('🐵 CHAOS MONKEY ENABLED - Failures will be injected');
    }

    /**
     * Disable chaos mode
     */
    disable() {
        this.enabled = false;
        eventBus.emit(EVENTS.CHAOS_DISABLED);
        console.log('🐵 CHAOS MONKEY DISABLED');
    }

    /**
     * Check if operation should fail
     */
    shouldFail(operationName) {
        if (!this.enabled) return false;
        if (this.excludedOperations.has(operationName)) return false;
        
        return Math.random() < this.chaosLevel;
    }

    /**
     * Inject failure
     */
    injectFailure(operationName, context = {}) {
        const failure = {
            id: this.generateFailureId(),
            operation: operationName,
            timestamp: Date.now(),
            type: this.getRandomFailureType(),
            context,
            resolved: false
        };

        this.failureLog.push(failure);
        this.activeAttacks.push(failure);

        eventBus.emit(EVENTS.CHAOS_FAILURE_INJECTED, failure);

        return this.getFailureEffect(failure.type);
    }

    /**
     * Get random failure type
     */
    getRandomFailureType() {
        const types = [
            'latency',
            'error',
            'timeout',
            'partial_response',
            'corrupted_data',
            'rate_limit',
            'service_unavailable'
        ];
        return types[Math.floor(Math.random() * types.length)];
    }

    /**
     * Get failure effect
     */
    getFailureEffect(type) {
        switch (type) {
            case 'latency':
                return {
                    type: 'latency',
                    delay: Math.random() * 5000 + 1000, // 1-6 seconds
                    message: 'Simulated network latency'
                };
            case 'error':
                return {
                    type: 'error',
                    error: new Error('Simulated chaos error'),
                    message: 'Simulated operation error'
                };
            case 'timeout':
                return {
                    type: 'timeout',
                    timeout: Math.random() * 3000 + 500,
                    message: 'Simulated timeout'
                };
            case 'partial_response':
                return {
                    type: 'partial_response',
                    completeness: Math.random() * 0.5 + 0.3, // 30-80% complete
                    message: 'Simulated partial response'
                };
            case 'corrupted_data':
                return {
                    type: 'corrupted_data',
                    corruption: 'random_bits',
                    message: 'Simulated data corruption'
                };
            case 'rate_limit':
                return {
                    type: 'rate_limit',
                    retryAfter: Math.random() * 10 + 5,
                    message: 'Simulated rate limiting'
                };
            case 'service_unavailable':
                return {
                    type: 'service_unavailable',
                    retryAfter: Math.random() * 30 + 10,
                    message: 'Simulated service outage'
                };
            default:
                return { type: 'error', error: new Error('Unknown chaos failure') };
        }
    }

    /**
     * Wrap operation with chaos
     */
    async withChaos(operationName, operation, context = {}) {
        if (this.shouldFail(operationName)) {
            const failure = this.injectFailure(operationName, context);
            
            // Apply failure effect
            if (failure.type === 'latency' || failure.type === 'timeout') {
                await this.delay(failure.delay || failure.timeout);
            }
            
            if (failure.type === 'error' || failure.type === 'service_unavailable') {
                throw failure.error || new Error(failure.message);
            }
            
            if (failure.type === 'rate_limit') {
                throw new Error(`Rate limited. Retry after ${failure.retryAfter}s`);
            }
            
            if (failure.type === 'partial_response') {
                // Return partial result
                const result = await operation();
                return this.corruptPartialResult(result, failure.completeness);
            }
            
            if (failure.type === 'corrupted_data') {
                const result = await operation();
                return this.corruptData(result);
            }
        }
        
        return await operation();
    }

    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Corrupt partial result
     */
    corruptPartialResult(result, completeness) {
        if (Array.isArray(result)) {
            const keepCount = Math.floor(result.length * completeness);
            return result.slice(0, keepCount);
        }
        if (typeof result === 'object' && result !== null) {
            const keys = Object.keys(result);
            const keepCount = Math.floor(keys.length * completeness);
            const keptKeys = keys.slice(0, keepCount);
            return keptKeys.reduce((acc, key) => {
                acc[key] = result[key];
                return acc;
            }, {});
        }
        return result;
    }

    /**
     * Corrupt data
     */
    corruptData(result) {
        // Add random noise to numeric values
        if (typeof result === 'number') {
            return result * (1 + (Math.random() - 0.5) * 0.2); // ±10% noise
        }
        if (typeof result === 'string') {
            // Corrupt some characters
            const chars = result.split('');
            const corruptCount = Math.floor(chars.length * 0.1);
            for (let i = 0; i < corruptCount; i++) {
                const idx = Math.floor(Math.random() * chars.length);
                chars[idx] = String.fromCharCode(chars[idx].charCodeAt(0) + 1);
            }
            return chars.join('');
        }
        return result;
    }

    /**
     * Exclude operation from chaos
     */
    excludeOperation(operationName) {
        this.excludedOperations.add(operationName);
    }

    /**
     * Get failure statistics
     */
    getStatistics() {
        const now = Date.now();
        const recentFailures = this.failureLog.filter(
            f => now - f.timestamp < 60000 // Last minute
        );

        return {
            enabled: this.enabled,
            chaosLevel: this.chaosLevel,
            totalFailures: this.failureLog.length,
            recentFailures: recentFailures.length,
            activeAttacks: this.activeAttacks.length,
            excludedOperations: Array.from(this.excludedOperations),
            failureTypes: this.getFailureTypeDistribution()
        };
    }

    /**
     * Get failure type distribution
     */
    getFailureTypeDistribution() {
        const distribution = {};
        this.failureLog.forEach(f => {
            distribution[f.type] = (distribution[f.type] || 0) + 1;
        });
        return distribution;
    }

    /**
     * Resolve active attack
     */
    resolveAttack(failureId) {
        const attack = this.activeAttacks.find(a => a.id === failureId);
        if (attack) {
            attack.resolved = true;
            attack.resolvedAt = Date.now();
            this.activeAttacks = this.activeAttacks.filter(a => a.id !== failureId);
            
            eventBus.emit(EVENTS.CHAOS_FAILURE_RESOLVED, attack);
        }
    }

    /**
     * Generate failure ID
     */
    generateFailureId() {
        return `chaos_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
    }

    /**
     * Get failure log
     */
    getFailureLog(limit = 100) {
        return this.failureLog.slice(-limit);
    }

    /**
     * Clear failure log
     */
    clearLog() {
        this.failureLog = [];
        this.activeAttacks = [];
    }
}

/**
 * Resilience Tester - Systematic chaos testing
 */
export class ResilienceTester {
    constructor(chaosMonkey) {
        this.chaos = chaosMonkey;
        this.testResults = [];
        this.currentTest = null;
    }

    /**
     * Run resilience test
     */
    async runTest(testConfig) {
        const {
            name,
            duration,
            operations,
            chaosLevels,
            successCriteria
        } = testConfig;

        this.currentTest = {
            name,
            startTime: Date.now(),
            status: 'running',
            results: []
        };

        console.log(`🧪 Starting resilience test: ${name}`);

        // Run test at different chaos levels
        for (const level of chaosLevels) {
            this.chaos.enable(level);
            
            const levelResult = await this.testAtLevel(operations, duration / chaosLevels.length);
            
            this.currentTest.results.push({
                chaosLevel: level,
                ...levelResult
            });
        }

        this.chaos.disable();
        
        this.currentTest.status = 'completed';
        this.currentTest.endTime = Date.now();
        
        const summary = this.summarizeTest(this.currentTest);
        this.testResults.push(summary);

        eventBus.emit(EVENTS.CHAOS_TEST_COMPLETED, summary);

        return summary;
    }

    /**
     * Test at specific chaos level
     */
    async testAtLevel(operations, duration) {
        const startTime = Date.now();
        let successCount = 0;
        let failureCount = 0;
        let latencies = [];

        while (Date.now() - startTime < duration) {
            for (const op of operations) {
                const opStart = Date.now();
                
                try {
                    await op();
                    successCount++;
                } catch (error) {
                    failureCount++;
                }
                
                latencies.push(Date.now() - opStart);
            }
        }

        const totalRequests = successCount + failureCount;
        
        return {
            totalRequests,
            successCount,
            failureCount,
            successRate: totalRequests > 0 ? (successCount / totalRequests) * 100 : 0,
            avgLatency: latencies.length > 0 
                ? latencies.reduce((a, b) => a + b, 0) / latencies.length 
                : 0,
            p95Latency: this.percentile(latencies, 95),
            p99Latency: this.percentile(latencies, 99)
        };
    }

    /**
     * Calculate percentile
     */
    percentile(values, p) {
        if (values.length === 0) return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const index = Math.ceil((p / 100) * sorted.length) - 1;
        return sorted[Math.max(0, index)];
    }

    /**
     * Summarize test results
     */
    summarizeTest(test) {
        const passed = test.results.every(r => 
            r.successRate >= (test.successCriteria?.minSuccessRate || 90)
        );

        return {
            name: test.name,
            duration: test.endTime - test.startTime,
            status: passed ? 'PASSED' : 'FAILED',
            chaosLevels: test.results.map(r => ({
                level: r.chaosLevel,
                successRate: r.successRate.toFixed(2) + '%',
                avgLatency: Math.round(r.avgLatency) + 'ms'
            })),
            overall: {
                passed,
                totalScenarios: test.results.length,
                passedScenarios: test.results.filter(r => 
                    r.successRate >= (test.successCriteria?.minSuccessRate || 90)
                ).length
            }
        };
    }

    /**
     * Get all test results
     */
    getTestResults() {
        return this.testResults;
    }

    /**
     * Generate resilience report
     */
    generateReport() {
        return {
            totalTests: this.testResults.length,
            passedTests: this.testResults.filter(t => t.status === 'PASSED').length,
            failedTests: this.testResults.filter(t => t.status === 'FAILED').length,
            tests: this.testResults,
            recommendations: this.generateRecommendations()
        };
    }

    /**
     * Generate recommendations based on test results
     */
    generateRecommendations() {
        const recommendations = [];

        for (const test of this.testResults) {
            for (const result of test.results) {
                if (result.successRate < 99) {
                    recommendations.push({
                        severity: 'high',
                        issue: `Success rate ${result.successRate.toFixed(2)}% at chaos level ${result.chaosLevel}`,
                        recommendation: 'Implement retry logic with exponential backoff'
                    });
                }
                if (result.p95Latency > 1000) {
                    recommendations.push({
                        severity: 'medium',
                        issue: `P95 latency ${Math.round(result.p95Latency)}ms`,
                        recommendation: 'Add circuit breaker pattern'
                    });
                }
            }
        }

        return recommendations;
    }
}

/**
 * Create chaos engineering system
 */
export function createChaosEngineering() {
    const chaosMonkey = new ChaosMonkey();
    const resilienceTester = new ResilienceTester(chaosMonkey);
    
    return {
        chaosMonkey,
        resilienceTester,
        enable: (level) => chaosMonkey.enable(level),
        disable: () => chaosMonkey.disable(),
        runTest: (config) => resilienceTester.runTest(config),
        getReport: () => resilienceTester.generateReport()
    };
}
