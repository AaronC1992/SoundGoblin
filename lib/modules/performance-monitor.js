// ===== PERFORMANCE MONITOR - Track metrics and generate reports =====

import { CONFIG } from '../config.js';

/**
 * Performance metrics collector
 */
export class PerformanceMonitor {
    constructor() {
        this.metrics = {
            audioLoad: [],
            aiResponse: [],
            speechRecognition: [],
            soundSearch: [],
            cacheHits: 0,
            cacheMisses: 0,
            errors: [],
            sessions: []
        };
        this.currentSession = null;
        this.reportInterval = null;
    }
    
    /**
     * Start a new session
     */
    startSession() {
        this.currentSession = {
            id: Date.now(),
            startTime: Date.now(),
            soundsPlayed: 0,
            analyzeCalls: 0,
            errors: 0,
            mode: null
        };
    }
    
    /**
     * End current session
     */
    endSession() {
        if (this.currentSession) {
            this.currentSession.endTime = Date.now();
            this.currentSession.durationMs = this.currentSession.endTime - this.currentSession.startTime;
            this.metrics.sessions.push(this.currentSession);
            this.currentSession = null;
        }
    }
    
    /**
     * Track audio load time
     * @param {string} url - Audio URL
     * @param {number} duration - Load duration in ms
     */
    trackAudioLoad(url, duration) {
        this.metrics.audioLoad.push({
            timestamp: Date.now(),
            url,
            duration
        });
        
        // Keep last 100 entries
        if (this.metrics.audioLoad.length > 100) {
            this.metrics.audioLoad.shift();
        }
    }
    
    /**
     * Track AI response time
     * @param {number} duration - Response duration in ms
     * @param {boolean} success - Whether request succeeded
     */
    trackAIResponse(duration, success = true) {
        this.metrics.aiResponse.push({
            timestamp: Date.now(),
            duration,
            success
        });
        
        if (this.currentSession) {
            this.currentSession.analyzeCalls++;
        }
        
        if (this.metrics.aiResponse.length > 100) {
            this.metrics.aiResponse.shift();
        }
    }
    
    /**
     * Track speech recognition event
     * @param {string} event - Event type (start, stop, result, error)
     * @param {Object} data - Event data
     */
    trackSpeechRecognition(event, data = {}) {
        this.metrics.speechRecognition.push({
            timestamp: Date.now(),
            event,
            data
        });
        
        if (this.metrics.speechRecognition.length > 50) {
            this.metrics.speechRecognition.shift();
        }
    }
    
    /**
     * Track sound search time
     * @param {string} query - Search query
     * @param {number} duration - Search duration in ms
     * @param {number} results - Number of results
     */
    trackSoundSearch(query, duration, results) {
        this.metrics.soundSearch.push({
            timestamp: Date.now(),
            query,
            duration,
            results
        });
        
        if (this.metrics.soundSearch.length > 100) {
            this.metrics.soundSearch.shift();
        }
    }
    
    /**
     * Track cache hit
     */
    trackCacheHit() {
        this.metrics.cacheHits++;
    }
    
    /**
     * Track cache miss
     */
    trackCacheMiss() {
        this.metrics.cacheMisses++;
    }
    
    /**
     * Track error
     * @param {Error} error - Error object
     * @param {string} context - Error context
     */
    trackError(error, context = 'unknown') {
        this.metrics.errors.push({
            timestamp: Date.now(),
            message: error.message,
            context,
            stack: error.stack
        });
        
        if (this.currentSession) {
            this.currentSession.errors++;
        }
        
        // Keep last 50 errors
        if (this.metrics.errors.length > 50) {
            this.metrics.errors.shift();
        }
    }
    
    /**
     * Track sound played
     * @param {string} soundId - Sound identifier
     * @param {string} type - 'music' or 'sfx'
     */
    trackSoundPlayed(soundId, type) {
        if (this.currentSession) {
            this.currentSession.soundsPlayed++;
        }
    }
    
    /**
     * Get average metric
     * @param {Array} arr - Metrics array
     * @param {string} field - Field to average
     * @returns {number}
     */
    getAverage(arr, field) {
        if (!arr.length) return 0;
        const sum = arr.reduce((acc, item) => acc + (item[field] || 0), 0);
        return Math.round(sum / arr.length);
    }
    
    /**
     * Get percentile
     * @param {Array} arr - Metrics array
     * @param {string} field - Field to calculate percentile for
     * @param {number} percentile - Percentile (0-100)
     * @returns {number}
     */
    getPercentile(arr, field, percentile) {
        if (!arr.length) return 0;
        const values = arr.map(item => item[field] || 0).sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * values.length) - 1;
        return values[Math.max(0, index)];
    }
    
    /**
     * Get cache hit rate
     * @returns {number} Percentage
     */
    getCacheHitRate() {
        const total = this.metrics.cacheHits + this.metrics.cacheMisses;
        if (total === 0) return 0;
        return Math.round((this.metrics.cacheHits / total) * 100);
    }
    
    /**
     * Generate performance report
     * @returns {Object}
     */
    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalSessions: this.metrics.sessions.length,
                activeSession: !!this.currentSession,
                cacheHitRate: this.getCacheHitRate(),
                totalErrors: this.metrics.errors.length
            },
            audioLoad: {
                count: this.metrics.audioLoad.length,
                avgMs: this.getAverage(this.metrics.audioLoad, 'duration'),
                p50Ms: this.getPercentile(this.metrics.audioLoad, 'duration', 50),
                p95Ms: this.getPercentile(this.metrics.audioLoad, 'duration', 95),
                p99Ms: this.getPercentile(this.metrics.audioLoad, 'duration', 99)
            },
            aiResponse: {
                count: this.metrics.aiResponse.length,
                avgMs: this.getAverage(this.metrics.aiResponse, 'duration'),
                p50Ms: this.getPercentile(this.metrics.aiResponse, 'duration', 50),
                p95Ms: this.getPercentile(this.metrics.aiResponse, 'duration', 95),
                successRate: this.metrics.aiResponse.length > 0 ?
                    Math.round((this.metrics.aiResponse.filter(r => r.success).length / this.metrics.aiResponse.length) * 100) : 0
            },
            soundSearch: {
                count: this.metrics.soundSearch.length,
                avgMs: this.getAverage(this.metrics.soundSearch, 'duration'),
                avgResults: this.getAverage(this.metrics.soundSearch, 'results')
            },
            cache: {
                hits: this.metrics.cacheHits,
                misses: this.metrics.cacheMisses,
                hitRate: this.getCacheHitRate()
            },
            errors: {
                total: this.metrics.errors.length,
                recent: this.metrics.errors.slice(-10).map(e => ({
                    message: e.message,
                    context: e.context,
                    time: new Date(e.timestamp).toLocaleTimeString()
                }))
            }
        };
        
        // Add memory stats if available
        if (performance.memory) {
            report.memory = {
                usedMB: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                totalMB: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                limitMB: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
            };
        }
        
        return report;
    }
    
    /**
     * Start automatic reporting
     */
    startReporting() {
        if (!CONFIG.PERFORMANCE.ENABLE_METRICS) return;
        
        this.reportInterval = setInterval(() => {
            const report = this.generateReport();
            console.table(report.summary);
            
            if (CONFIG.DEBUG_MODE) {
                console.log('[PerformanceMonitor] Full report:', report);
            }
        }, CONFIG.PERFORMANCE.METRICS_REPORT_INTERVAL);
    }
    
    /**
     * Stop automatic reporting
     */
    stopReporting() {
        if (this.reportInterval) {
            clearInterval(this.reportInterval);
            this.reportInterval = null;
        }
    }
    
    /**
     * Export metrics as JSON
     * @returns {string}
     */
    exportMetrics() {
        return JSON.stringify({
            metrics: this.metrics,
            report: this.generateReport()
        }, null, 2);
    }
    
    /**
     * Reset all metrics
     */
    reset() {
        this.metrics = {
            audioLoad: [],
            aiResponse: [],
            speechRecognition: [],
            soundSearch: [],
            cacheHits: 0,
            cacheMisses: 0,
            errors: [],
            sessions: []
        };
        console.log('[PerformanceMonitor] Metrics reset');
    }
}

export default PerformanceMonitor;
