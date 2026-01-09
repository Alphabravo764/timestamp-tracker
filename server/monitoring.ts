/**
 * System Monitoring Utility
 * Tracks memory, upload rates, and active shifts for Railway deployment
 */

interface MonitoringStats {
    timestamp: string;
    memoryUsageMB: number;
    memoryPercentage: number;
    uploadsLastMinute: number;
    activeShifts: number;
    requestsLastMinute: number;
}

interface MonitoringAlerts {
    highMemory: boolean;
    highUploadRate: boolean;
    manyActiveShifts: boolean;
}

class SystemMonitor {
    private uploadCounts: number[] = [];
    private requestCounts: number[] = [];
    private activeShiftCount: number = 0;

    // Thresholds
    private readonly MEMORY_WARNING_PERCENT = 70;
    private readonly UPLOAD_RATE_WARNING = 50; // uploads per minute
    private readonly ACTIVE_SHIFT_WARNING = 25;

    constructor() {
        // Clean up old counts every minute
        setInterval(() => {
            const oneMinuteAgo = Date.now() - 60000;
            this.uploadCounts = this.uploadCounts.filter(t => t > oneMinuteAgo);
            this.requestCounts = this.requestCounts.filter(t => t > oneMinuteAgo);
        }, 60000);
    }

    /**
     * Record a photo upload
     */
    recordUpload(): void {
        this.uploadCounts.push(Date.now());
    }

    /**
     * Record an API request
     */
    recordRequest(): void {
        this.requestCounts.push(Date.now());
    }

    /**
     * Update active shift count
     */
    setActiveShifts(count: number): void {
        this.activeShiftCount = count;
    }

    /**
     * Get current system stats
     */
    getStats(): MonitoringStats {
        const memUsage = process.memoryUsage();
        const memoryUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        const totalMemoryMB = Math.round(memUsage.heapTotal / 1024 / 1024);
        const memoryPercentage = Math.round((memoryUsageMB / totalMemoryMB) * 100);

        return {
            timestamp: new Date().toISOString(),
            memoryUsageMB,
            memoryPercentage,
            uploadsLastMinute: this.uploadCounts.length,
            activeShifts: this.activeShiftCount,
            requestsLastMinute: this.requestCounts.length,
        };
    }

    /**
     * Check for alert conditions
     */
    checkAlerts(): MonitoringAlerts {
        const stats = this.getStats();

        return {
            highMemory: stats.memoryPercentage > this.MEMORY_WARNING_PERCENT,
            highUploadRate: stats.uploadsLastMinute > this.UPLOAD_RATE_WARNING,
            manyActiveShifts: stats.activeShifts > this.ACTIVE_SHIFT_WARNING,
        };
    }

    /**
     * Log current stats to console
     */
    logStats(): void {
        const stats = this.getStats();
        const alerts = this.checkAlerts();

        console.log('[Monitor]', JSON.stringify({
            ...stats,
            alerts: Object.entries(alerts)
                .filter(([_, value]) => value)
                .map(([key]) => key),
        }));

        // Log warnings
        if (alerts.highMemory) {
            console.warn(`⚠️  High memory usage: ${stats.memoryUsageMB}MB (${stats.memoryPercentage}%)`);
        }
        if (alerts.highUploadRate) {
            console.warn(`⚠️  High upload rate: ${stats.uploadsLastMinute} uploads/min`);
        }
        if (alerts.manyActiveShifts) {
            console.warn(`⚠️  Many active shifts: ${stats.activeShifts}`);
        }
    }

    /**
     * Start periodic logging (every 5 minutes)
     */
    startPeriodicLogging(intervalMs: number = 300000): void {
        setInterval(() => {
            this.logStats();
        }, intervalMs);

        console.log('[Monitor] Periodic logging started (every 5 minutes)');
    }
}

// Singleton instance
export const monitor = new SystemMonitor();

// Middleware for Express
export function monitoringMiddleware(req: any, res: any, next: any) {
    monitor.recordRequest();
    next();
}
