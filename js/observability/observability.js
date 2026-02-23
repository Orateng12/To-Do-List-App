/**
 * Advanced Observability & Distributed Tracing
 * ==============================================
 * Complete system visibility with metrics, logs, and traces
 */

import { eventBus, EVENTS } from '../core/event-bus.js';

/**
 * Distributed Tracing System
 */
export class DistributedTracer {
    constructor() {
        this.traces = new Map();
        this.spans = new Map();
        this.activeSpans = new Map();
        this.traceIdCounter = 0;
        this.spanIdCounter = 0;
        this.samplers = [];
        this.exporters = [];
    }

    /**
     * Start a new trace
     */
    startTrace(name, context = {}) {
        const traceId = this.generateTraceId();
        const trace = {
            traceId,
            name,
            startTime: Date.now(),
            context,
            spans: [],
            tags: {},
            baggage: {}
        };

        this.traces.set(traceId, trace);
        
        return {
            traceId,
            trace,
            startSpan: (spanName, options) => this.startSpan(traceId, spanName, options)
        };
    }

    /**
     * Start a new span within a trace
     */
    startSpan(traceId, spanName, options = {}) {
        const spanId = this.generateSpanId();
        const parentSpanId = options.parentSpanId || null;
        
        const span = {
            spanId,
            traceId,
            parentSpanId,
            name: spanName,
            startTime: Date.now(),
            endTime: null,
            duration: null,
            status: 'active',
            tags: { ...options.tags },
            logs: [],
            baggage: { ...options.baggage }
        };

        this.spans.set(spanId, span);
        this.activeSpans.set(spanId, span);

        // Add to trace
        const trace = this.traces.get(traceId);
        if (trace) {
            trace.spans.push(span);
        }

        return {
            spanId,
            span,
            setTag: (key, value) => this.setTag(spanId, key, value),
            log: (message, data) => this.logSpan(spanId, message, data),
            end: () => this.endSpan(spanId)
        };
    }

    /**
     * Set tag on span
     */
    setTag(spanId, key, value) {
        const span = this.spans.get(spanId);
        if (span) {
            span.tags[key] = value;
        }
    }

    /**
     * Log to span
     */
    logSpan(spanId, message, data = {}) {
        const span = this.spans.get(spanId);
        if (span) {
            span.logs.push({
                timestamp: Date.now(),
                message,
                data
            });
        }
    }

    /**
     * End span
     */
    endSpan(spanId) {
        const span = this.spans.get(spanId);
        if (!span) return null;

        span.endTime = Date.now();
        span.duration = span.endTime - span.startTime;
        span.status = 'completed';
        
        this.activeSpans.delete(spanId);

        // Auto-end trace if this was the last span
        const trace = this.traces.get(span.traceId);
        if (trace && trace.spans.every(s => s.status === 'completed')) {
            this.endTrace(span.traceId);
        }

        return span;
    }

    /**
     * End trace
     */
    endTrace(traceId) {
        const trace = this.traces.get(traceId);
        if (!trace) return;

        trace.endTime = Date.now();
        trace.duration = trace.endTime - trace.startTime;
        trace.status = 'completed';

        // Sample and export
        if (this.shouldSample(trace)) {
            this.exportTrace(trace);
        }
    }

    /**
     * Check if trace should be sampled
     */
    shouldSample(trace) {
        for (const sampler of this.samplers) {
            if (!sampler.shouldSample(trace)) return false;
        }
        return true;
    }

    /**
     * Export trace
     */
    exportTrace(trace) {
        for (const exporter of this.exporters) {
            exporter.export(trace);
        }
    }

    /**
     * Add sampler
     */
    addSampler(sampler) {
        this.samplers.push(sampler);
    }

    /**
     * Add exporter
     */
    addExporter(exporter) {
        this.exporters.push(exporter);
    }

    /**
     * Generate trace ID
     */
    generateTraceId() {
        return `trace_${++this.traceIdCounter}_${Date.now().toString(36)}`;
    }

    /**
     * Generate span ID
     */
    generateSpanId() {
        return `span_${++this.spanIdCounter}_${Date.now().toString(36)}`;
    }

    /**
     * Get trace by ID
     */
    getTrace(traceId) {
        return this.traces.get(traceId);
    }

    /**
     * Get all traces
     */
    getAllTraces() {
        return Array.from(this.traces.values());
    }

    /**
     * Get trace statistics
     */
    getTraceStats() {
        const traces = this.getAllTraces();
        const completedTraces = traces.filter(t => t.status === 'completed');
        
        return {
            totalTraces: traces.length,
            completedTraces: completedTraces.length,
            activeTraces: this.traces.size - completedTraces.length,
            totalSpans: this.spans.size,
            activeSpans: this.activeSpans.size,
            avgTraceDuration: completedTraces.length > 0
                ? completedTraces.reduce((sum, t) => sum + t.duration, 0) / completedTraces.length
                : 0
        };
    }
}

/**
 * Metrics Collection System
 */
export class MetricsCollector {
    constructor() {
        this.counters = new Map();
        this.gauges = new Map();
        this.histograms = new Map();
        this.summaries = new Map();
        this.collectInterval = null;
    }

    /**
     * Increment counter
     */
    incrementCounter(name, value = 1, labels = {}) {
        const key = this.makeKey(name, labels);
        
        if (!this.counters.has(key)) {
            this.counters.set(key, {
                name,
                labels,
                value: 0,
                createdAt: Date.now()
            });
        }

        this.counters.get(key).value += value;
    }

    /**
     * Set gauge value
     */
    setGauge(name, value, labels = {}) {
        const key = this.makeKey(name, labels);
        
        this.gauges.set(key, {
            name,
            labels,
            value,
            timestamp: Date.now()
        });
    }

    /**
     * Record histogram value
     */
    recordHistogram(name, value, labels = {}) {
        const key = this.makeKey(name, labels);
        
        if (!this.histograms.has(key)) {
            this.histograms.set(key, {
                name,
                labels,
                values: [],
                buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
                bucketCounts: {}
            });
        }

        const histogram = this.histograms.get(key);
        histogram.values.push(value);

        // Update bucket counts
        histogram.buckets.forEach(bucket => {
            if (value <= bucket) {
                histogram.bucketCounts[bucket] = (histogram.bucketCounts[bucket] || 0) + 1;
            }
        });
    }

    /**
     * Make metric key
     */
    makeKey(name, labels) {
        const labelStr = Object.entries(labels)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join(',');
        return `${name}{${labelStr}}`;
    }

    /**
     * Get all metrics
     */
    getAllMetrics() {
        return {
            counters: Array.from(this.counters.values()),
            gauges: Array.from(this.gauges.values()),
            histograms: Array.from(this.histograms.values()).map(h => ({
                ...h,
                count: h.values.length,
                sum: h.values.reduce((a, b) => a + b, 0),
                avg: h.values.length > 0 ? h.values.reduce((a, b) => a + b, 0) / h.values.length : 0,
                p50: this.percentile(h.values, 50),
                p95: this.percentile(h.values, 95),
                p99: this.percentile(h.values, 99)
            }))
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
     * Start auto-collection
     */
    startAutoCollection(intervalMs = 10000) {
        this.collectInterval = setInterval(() => {
            eventBus.emit(EVENTS.METRICS_COLLECTED, this.getAllMetrics());
        }, intervalMs);
    }

    /**
     * Stop auto-collection
     */
    stopAutoCollection() {
        if (this.collectInterval) {
            clearInterval(this.collectInterval);
            this.collectInterval = null;
        }
    }

    /**
     * Clear all metrics
     */
    clear() {
        this.counters.clear();
        this.gauges.clear();
        this.histograms.clear();
        this.summaries.clear();
    }
}

/**
 * Structured Logging System
 */
export class StructuredLogger {
    constructor() {
        this.logs = [];
        this.maxLogs = 10000;
        this.logLevel = 'info';
        this.logLevels = { debug: 0, info: 1, warn: 2, error: 3, fatal: 4 };
        this.context = {};
    }

    /**
     * Set log level
     */
    setLevel(level) {
        this.logLevel = level;
    }

    /**
     * Set context for all logs
     */
    setContext(context) {
        this.context = { ...this.context, ...context };
    }

    /**
     * Log message
     */
    log(level, message, data = {}) {
        if (this.logLevels[level] < this.logLevels[this.logLevel]) {
            return;
        }

        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            data: { ...this.context, ...data },
            id: this.generateLogId()
        };

        this.logs.push(logEntry);

        // Trim if needed
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }

        // Console output
        this.outputToConsole(logEntry);

        // Emit event
        eventBus.emit(EVENTS.LOG_ENTRY, logEntry);
    }

    /**
     * Output to console
     */
    outputToConsole(logEntry) {
        const prefix = `[${logEntry.timestamp}] [${logEntry.level.toUpperCase()}]`;
        
        switch (logEntry.level) {
            case 'debug':
                console.debug(prefix, logEntry.message, logEntry.data);
                break;
            case 'info':
                console.info(prefix, logEntry.message, logEntry.data);
                break;
            case 'warn':
                console.warn(prefix, logEntry.message, logEntry.data);
                break;
            case 'error':
            case 'fatal':
                console.error(prefix, logEntry.message, logEntry.data);
                break;
        }
    }

    /**
     * Convenience methods
     */
    debug(message, data) { this.log('debug', message, data); }
    info(message, data) { this.log('info', message, data); }
    warn(message, data) { this.log('warn', message, data); }
    error(message, data) { this.log('error', message, data); }
    fatal(message, data) { this.log('fatal', message, data); }

    /**
     * Generate log ID
     */
    generateLogId() {
        return `log_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
    }

    /**
     * Get logs
     */
    getLogs(options = {}) {
        let filtered = [...this.logs];

        if (options.level) {
            filtered = filtered.filter(l => l.level === options.level);
        }

        if (options.since) {
            filtered = filtered.filter(l => new Date(l.timestamp) > options.since);
        }

        if (options.search) {
            const search = options.search.toLowerCase();
            filtered = filtered.filter(l => 
                l.message.toLowerCase().includes(search) ||
                JSON.stringify(l.data).toLowerCase().includes(search)
            );
        }

        if (options.limit) {
            filtered = filtered.slice(-options.limit);
        }

        return filtered;
    }

    /**
     * Export logs
     */
    exportLogs(format = 'json') {
        if (format === 'json') {
            return JSON.stringify(this.logs, null, 2);
        }
        
        if (format === 'csv') {
            const headers = ['timestamp', 'level', 'message', 'data'];
            const rows = this.logs.map(l => [
                l.timestamp,
                l.level,
                `"${l.message.replace(/"/g, '""')}"`,
                `"${JSON.stringify(l.data).replace(/"/g, '""')}"`
            ]);
            return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        }

        return this.logs;
    }

    /**
     * Clear logs
     */
    clear() {
        this.logs = [];
    }
}

/**
 * System Health Monitor
 */
export class HealthMonitor {
    constructor() {
        this.checks = new Map();
        this.lastCheck = null;
        this.healthStatus = 'unknown';
    }

    /**
     * Register health check
     */
    registerCheck(name, checkFn, options = {}) {
        this.checks.set(name, {
            fn: checkFn,
            timeout: options.timeout || 5000,
            critical: options.critical ?? true,
            lastResult: null
        });
    }

    /**
     * Run all health checks
     */
    async runChecks() {
        const results = {};
        let allHealthy = true;
        let anyCriticalFailed = false;

        for (const [name, check] of this.checks.entries()) {
            try {
                const result = await this.runSingleCheck(name, check);
                results[name] = result;
                
                if (!result.healthy) {
                    allHealthy = false;
                    if (check.critical) {
                        anyCriticalFailed = true;
                    }
                }
            } catch (error) {
                results[name] = {
                    healthy: false,
                    error: error.message,
                    timestamp: Date.now()
                };
                allHealthy = false;
                if (check.critical) {
                    anyCriticalFailed = true;
                }
            }
        }

        this.lastCheck = {
            timestamp: Date.now(),
            results,
            healthy: allHealthy,
            status: anyCriticalFailed ? 'critical' : allHealthy ? 'healthy' : 'degraded'
        };

        this.healthStatus = this.lastCheck.status;
        
        eventBus.emit(EVENTS.HEALTH_CHECK_COMPLETED, this.lastCheck);

        return this.lastCheck;
    }

    /**
     * Run single health check
     */
    async runSingleCheck(name, check) {
        const startTime = Date.now();
        
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout')), check.timeout);
        });

        const checkPromise = Promise.resolve(check.fn());
        
        const result = await Promise.race([checkPromise, timeoutPromise]);
        const duration = Date.now() - startTime;

        return {
            healthy: result.healthy ?? true,
            duration,
            details: result.details || {},
            timestamp: Date.now()
        };
    }

    /**
     * Get health status
     */
    getStatus() {
        return this.lastCheck || {
            status: 'unknown',
            message: 'No health checks run yet'
        };
    }

    /**
     * Get detailed health report
     */
    getReport() {
        return {
            status: this.healthStatus,
            lastCheck: this.lastCheck,
            registeredChecks: Array.from(this.checks.keys()),
            checkCount: this.checks.size
        };
    }
}

/**
 * Create observability system
 */
export function createObservability() {
    const tracer = new DistributedTracer();
    const metrics = new MetricsCollector();
    const logger = new StructuredLogger();
    const health = new HealthMonitor();

    // Auto-instrument common events
    eventBus.on('*', (event, data) => {
        metrics.incrementCounter('event_total', 1, { event });
    });

    return {
        tracer,
        metrics,
        logger,
        health,
        trace: (name, fn) => {
            const trace = tracer.startTrace(name);
            try {
                const result = fn(trace);
                trace.trace.status = 'success';
                return result;
            } catch (error) {
                trace.trace.status = 'error';
                trace.trace.error = error;
                throw error;
            } finally {
                tracer.endTrace(trace.traceId);
            }
        },
        async traceAsync: async (name, fn) => {
            const trace = tracer.startTrace(name);
            try {
                const result = await fn(trace);
                trace.trace.status = 'success';
                return result;
            } catch (error) {
                trace.trace.status = 'error';
                trace.trace.error = error;
                throw error;
            } finally {
                tracer.endTrace(trace.traceId);
            }
        }
    };
}
