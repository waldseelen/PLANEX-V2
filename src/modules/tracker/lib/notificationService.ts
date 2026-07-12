/**
 * notificationService — Bildirim Servisi (Aşama 7)
 *
 * - document.title'da timer süresini gösterir
 * - Web Notification API ile bildirim gönderir
 * - Goal yaklaşma uyarısı
 */

import { computeElapsedSec, formatDuration } from '@/db/time-tracking/queries/timerQueries'
import type { RunningTimer } from '@/db/time-tracking/types'
import { getCurrentLocale, getTranslation } from '@/i18n'

/** Aktif locale'den tracker namespace çevirisi al */
function t(key: string, params?: Record<string, string | number>): string {
    return getTranslation(getCurrentLocale(), 'tracker', key, params)
}

// ============================================
// Document Title — Timer Süre Gösterimi
// ============================================

let originalTitle: string | null = null
let titleIntervalId: ReturnType<typeof setInterval> | null = null

/**
 * Çalışan timer varken sayfa başlığında süreyi gösterir.
 * Örnek: "05:32 — Matematik | Plan.Ex"
 */
export function startTitleTimer(timer: RunningTimer, activityName: string): void {
    stopTitleTimer()
    originalTitle = document.title

    function update() {
        const elapsed = computeElapsedSec(timer)
        document.title = `${formatDuration(elapsed)} — ${activityName} | Plan.Ex`
    }

    update()
    titleIntervalId = setInterval(update, 1000)
}

export function stopTitleTimer(): void {
    if (titleIntervalId) {
        clearInterval(titleIntervalId)
        titleIntervalId = null
    }
    if (originalTitle) {
        document.title = originalTitle
        originalTitle = null
    }
}

// ============================================
// Web Notification API
// ============================================

/**
 * Bildirim izni ister. Zaten verilmişse true döner.
 */
export async function requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false
    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'denied') return false

    const result = await Notification.requestPermission()
    return result === 'granted'
}

/**
 * Web bildirimi gönderir.
 */
export function sendNotification(title: string, body?: string, icon?: string): void {
    if (!('Notification' in window) || Notification.permission !== 'granted') return

    new Notification(title, {
        body,
        icon: icon ?? '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: 'planex-tracker',
    })
}

// ============================================
// Goal Uyarıları
// ============================================

/**
 * Goal hedefe yaklaştığında bildirim gönderir.
 * %90'a ulaşıldığında tetiklenir.
 */
export function notifyGoalNearing(goalName: string, percent: number): void {
    if (percent >= 90 && percent < 100) {
        sendNotification(
            t('notification.goalNearingTitle', { goalName }),
            t('notification.goalNearingBody', { percent }),
        )
    }
}

/**
 * Goal tamamlandığında bildirim gönderir.
 */
export function notifyGoalCompleted(goalName: string): void {
    sendNotification(
        t('notification.goalCompletedTitle', { goalName }),
        t('notification.goalCompletedBody'),
    )
}

// ============================================
// Hatırlatıcı
// ============================================

/**
 * Belirli süre sonra hatırlatıcı bildirim gönderir.
 */
export function scheduleReminder(title: string, message: string, delayMs: number): number {
    return window.setTimeout(() => {
        sendNotification(title, message)
    }, delayMs)
}
