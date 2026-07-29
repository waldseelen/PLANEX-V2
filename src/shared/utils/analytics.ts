/**
 * Plan.Ex - Web Vitals & Analytics
 *
 * Performans metrikleri ve kullanıcı analitiği.
 * Core Web Vitals takibi ve custom metrikler.
 */

// ============================================
// Types
// ============================================

export interface WebVitalsMetric {
    name: 'CLS' | 'FID' | 'FCP' | 'LCP' | 'TTFB' | 'INP'
    value: number
    rating: 'good' | 'needs-improvement' | 'poor'
    delta: number
    id: string
    navigationType: 'navigate' | 'reload' | 'back_forward' | 'prerender'
}

export interface CustomMetric {
    name: string
    value: number
    unit: 'ms' | 'count' | 'bytes' | 'percent'
    timestamp: number
    metadata?: Record<string, unknown>
}

export interface AnalyticsEvent {
    name: string
    properties?: Record<string, unknown>
    timestamp: number
}

// ============================================
// Web Vitals Thresholds
// ============================================

const THRESHOLDS = {
    CLS: { good: 0.1, poor: 0.25 },
    FID: { good: 100, poor: 300 },
    FCP: { good: 1800, poor: 3000 },
    LCP: { good: 2500, poor: 4000 },
    TTFB: { good: 800, poor: 1800 },
    INP: { good: 200, poor: 500 },
} as const

function getRating(name: keyof typeof THRESHOLDS, value: number): 'good' | 'needs-improvement' | 'poor' {
    const threshold = THRESHOLDS[name]
    if (value <= threshold.good) return 'good'
    if (value <= threshold.poor) return 'needs-improvement'
    return 'poor'
}

// ============================================
// Metrics Storage
// ============================================

const METRICS_STORAGE_KEY = 'lifeflow_metrics'
const MAX_STORED_METRICS = 100

interface StoredMetrics {
    webVitals: WebVitalsMetric[]
    custom: CustomMetric[]
    events: AnalyticsEvent[]
}

function getStoredMetrics(): StoredMetrics {
    try {
        const stored = localStorage.getItem(METRICS_STORAGE_KEY)
        return stored ? JSON.parse(stored) : { webVitals: [], custom: [], events: [] }
    } catch {
        return { webVitals: [], custom: [], events: [] }
    }
}

function saveMetrics(metrics: StoredMetrics): void {
    try {
        // Limit stored items
        metrics.webVitals = metrics.webVitals.slice(-MAX_STORED_METRICS)
        metrics.custom = metrics.custom.slice(-MAX_STORED_METRICS)
        metrics.events = metrics.events.slice(-MAX_STORED_METRICS)

        localStorage.setItem(METRICS_STORAGE_KEY, JSON.stringify(metrics))
    } catch {
        console.warn('[Analytics] Failed to save metrics')
    }
}

// ============================================
// Web Vitals Tracking
// ============================================

/**
 * Web Vitals metriğini kaydet
 */
export function trackWebVital(metric: WebVitalsMetric): void {
    const metrics = getStoredMetrics()
    metrics.webVitals.push(metric)
    saveMetrics(metrics)

    if (import.meta.env.DEV) {
        const emoji = metric.rating === 'good' ? '✅' : metric.rating === 'needs-improvement' ? '⚠️' : '❌'
        console.log(`[WebVitals] ${emoji} ${metric.name}: ${metric.value.toFixed(2)} (${metric.rating})`)
    }

    // Gelecekte: Analytics servisine gönder
    // gtag('event', metric.name, {
    //     value: Math.round(metric.value),
    //     metric_rating: metric.rating,
    // })
}

/**
 * Web Vitals observer'ları başlat
 */
export function initWebVitals(): void {
    if (typeof window === 'undefined') return

    // CLS - Cumulative Layout Shift
    observeCLS()

    // LCP - Largest Contentful Paint
    observeLCP()

    // FID - First Input Delay
    observeFID()

    // FCP - First Contentful Paint
    observeFCP()

    // TTFB - Time to First Byte
    observeTTFB()
}

function observeCLS(): void {
    let clsValue = 0
    const clsEntries: PerformanceEntry[] = []

    const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
            // Only count entries that are not within 500ms of user input
            if (!(entry as PerformanceEntry & { hadRecentInput?: boolean }).hadRecentInput) {
                clsValue += (entry as PerformanceEntry & { value: number }).value
                clsEntries.push(entry)
            }
        }
    })

    try {
        observer.observe({ type: 'layout-shift', buffered: true })

        // Report on page hide
        window.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden' && clsValue > 0) {
                trackWebVital({
                    name: 'CLS',
                    value: clsValue,
                    rating: getRating('CLS', clsValue),
                    delta: clsValue,
                    id: `cls-${Date.now()}`,
                    navigationType: getNavigationType(),
                })
            }
        }, { once: true })
    } catch {
        // PerformanceObserver not supported
    }
}

function observeLCP(): void {
    const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1] as PerformanceEntry & { startTime: number }

        trackWebVital({
            name: 'LCP',
            value: lastEntry.startTime,
            rating: getRating('LCP', lastEntry.startTime),
            delta: lastEntry.startTime,
            id: `lcp-${Date.now()}`,
            navigationType: getNavigationType(),
        })
    })

    try {
        observer.observe({ type: 'largest-contentful-paint', buffered: true })
    } catch {
        // PerformanceObserver not supported
    }
}

function observeFID(): void {
    const observer = new PerformanceObserver((list) => {
        const entry = list.getEntries()[0] as PerformanceEntry & { processingStart: number; startTime: number }
        const value = entry.processingStart - entry.startTime

        trackWebVital({
            name: 'FID',
            value,
            rating: getRating('FID', value),
            delta: value,
            id: `fid-${Date.now()}`,
            navigationType: getNavigationType(),
        })
    })

    try {
        observer.observe({ type: 'first-input', buffered: true })
    } catch {
        // PerformanceObserver not supported
    }
}

function observeFCP(): void {
    const observer = new PerformanceObserver((list) => {
        const entry = list.getEntries().find(e => e.name === 'first-contentful-paint')
        if (entry) {
            const value = entry.startTime

            trackWebVital({
                name: 'FCP',
                value,
                rating: getRating('FCP', value),
                delta: value,
                id: `fcp-${Date.now()}`,
                navigationType: getNavigationType(),
            })
        }
    })

    try {
        observer.observe({ type: 'paint', buffered: true })
    } catch {
        // PerformanceObserver not supported
    }
}

function observeTTFB(): void {
    const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    if (navEntry) {
        const value = navEntry.responseStart

        trackWebVital({
            name: 'TTFB',
            value,
            rating: getRating('TTFB', value),
            delta: value,
            id: `ttfb-${Date.now()}`,
            navigationType: getNavigationType(),
        })
    }
}

function getNavigationType(): WebVitalsMetric['navigationType'] {
    const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    if (!navEntry) return 'navigate'

    switch (navEntry.type) {
        case 'reload': return 'reload'
        case 'back_forward': return 'back_forward'
        case 'prerender' as any: return 'prerender'
        default: return 'navigate'
    }
}

// ============================================
// Custom Metrics
// ============================================

/**
 * Custom metrik kaydet
 *
 * @example
 * trackCustomMetric('db_query_time', 45, 'ms', { table: 'activities' })
 */
export function trackCustomMetric(
    name: string,
    value: number,
    unit: CustomMetric['unit'] = 'ms',
    metadata?: Record<string, unknown>
): void {
    const metric: CustomMetric = {
        name,
        value,
        unit,
        timestamp: Date.now(),
    }
    if (metadata) {
        metric.metadata = metadata
    }

    const metrics = getStoredMetrics()
    metrics.custom.push(metric)
    saveMetrics(metrics)

    if (import.meta.env.DEV) {
        console.log(`[Metric] ${name}: ${value}${unit}`, metadata || '')
    }
}

// ============================================
// Analytics Events
// ============================================

/**
 * Analytics eventi kaydet
 *
 * @example
 * trackEvent('timer_started', { activityId: 'act_123', mode: 'pomodoro' })
 */
export function trackEvent(
    name: string,
    properties?: Record<string, unknown>
): void {
    const event: AnalyticsEvent = {
        name,
        timestamp: Date.now(),
    }
    if (properties) {
        event.properties = properties
    }

    const metrics = getStoredMetrics()
    metrics.events.push(event)
    saveMetrics(metrics)

    if (import.meta.env.DEV) {
        console.log(`[Event] ${name}`, properties || '')
    }

    // Gelecekte: Analytics servisine gönder
    // gtag('event', name, properties)
    // posthog.capture(name, properties)
}

// ============================================
// Performance Helpers
// ============================================

/**
 * Database query performansını ölç
 */
export async function measureDbQuery<T>(
    queryName: string,
    queryFn: () => Promise<T>
): Promise<T> {
    const start = performance.now()

    try {
        const result = await queryFn()
        const duration = performance.now() - start

        trackCustomMetric(`db_${queryName}`, duration, 'ms')

        return result
    } catch (error) {
        const duration = performance.now() - start
        trackCustomMetric(`db_${queryName}_error`, duration, 'ms')
        throw error
    }
}

/**
 * Render performansını ölç (hook içinde kullan)
 */
export function useRenderMetric(componentName: string): void {
    if (import.meta.env.DEV) {
        const start = performance.now()

        // useEffect'te çağrılacak
        setTimeout(() => {
            const duration = performance.now() - start
            if (duration > 16.67) { // 60fps threshold
                console.warn(`[Render] ${componentName}: ${duration.toFixed(2)}ms (slow render)`)
            }
        }, 0)
    }
}

// ============================================
// Memory Monitoring
// ============================================

/**
 * Memory kullanımını kontrol et
 */
export function checkMemoryUsage(): { usedMB: number; totalMB: number; percent: number } | null {
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory

    if (!memory) return null

    const usedMB = memory.usedJSHeapSize / 1024 / 1024
    const totalMB = memory.totalJSHeapSize / 1024 / 1024
    const percent = (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100

    return { usedMB, totalMB, percent }
}

/**
 * Memory leak tespit et (development)
 */
export function startMemoryMonitoring(intervalMs = 30000): () => void {
    if (!import.meta.env.DEV) return () => { }

    let previousUsage = 0
    let increasingCount = 0

    const interval = setInterval(() => {
        const usage = checkMemoryUsage()
        if (!usage) return

        if (usage.usedMB > previousUsage) {
            increasingCount++
        } else {
            increasingCount = 0
        }

        // 5 kez üst üste arttıysa uyar
        if (increasingCount >= 5) {
            console.warn('[Memory] Potential memory leak detected!', {
                current: `${usage.usedMB.toFixed(2)}MB`,
                previous: `${previousUsage.toFixed(2)}MB`,
            })
        }

        previousUsage = usage.usedMB
    }, intervalMs)

    return () => clearInterval(interval)
}

// ============================================
// Export Stored Metrics
// ============================================

/**
 * Tüm metrikleri al (debugging için)
 */
export function getAllMetrics(): StoredMetrics {
    return getStoredMetrics()
}

/**
 * Metrikleri temizle
 */
export function clearAllMetrics(): void {
    localStorage.removeItem(METRICS_STORAGE_KEY)
}

/**
 * Ortalama Web Vitals hesapla
 */
export function getAverageWebVitals(): Record<string, { avg: number; rating: string }> {
    const metrics = getStoredMetrics()
    const groups: Record<string, number[]> = {}

    for (const metric of metrics.webVitals) {
        if (!groups[metric.name]) groups[metric.name] = []
        groups[metric.name]!.push(metric.value)
    }

    const result: Record<string, { avg: number; rating: string }> = {}

    for (const [name, values] of Object.entries(groups)) {
        const avg = values.reduce((a, b) => a + b, 0) / values.length
        result[name] = {
            avg,
            rating: getRating(name as keyof typeof THRESHOLDS, avg),
        }
    }

    return result
}
