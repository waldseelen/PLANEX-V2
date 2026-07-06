/**
 * suggestionEngine — Aktivite Öneri Motoru (Supabase-first)
 *
 * Son 2 haftanın her saatinde hangi aktivitenin yapıldığını analiz eder
 * ve "Bu saatte genelde: X yapıyorsun" önerileri üretir.
 */

import type { Activity } from '@/db/time-tracking/types'
import { getCurrentLocale, getTranslation } from '@/i18n'
import {
    trackerGetAllActivities,
    trackerGetSessionsByDateRange,
} from '@/lib/cloud/trackerRepo'
import type { ActivitySuggestion } from '../types'

// ============================================
// Analiz
// ============================================

/**
 * Son N gündeki session'ları analiz ederek her saat dilimi için
 * en sık yapılan aktiviteyi döner.
 */
export async function getHourlySuggestions(lookbackDays: number = 14): Promise<Map<number, ActivitySuggestion>> {
    const now = new Date()
    const start = new Date(now)
    start.setDate(now.getDate() - lookbackDays)
    const startISO = start.toISOString().slice(0, 10)
    const endISO = now.toISOString().slice(0, 10)

    const sessions = await trackerGetSessionsByDateRange(startISO, endISO)

    // Saat başına aktivite sayımı: hour → activityId → count
    const hourCounts = new Map<number, Map<string, number>>()

    for (const session of sessions) {
        const hour = new Date(session.startAt).getHours()
        if (!hourCounts.has(hour)) hourCounts.set(hour, new Map())
        const activityCounts = hourCounts.get(hour)!
        activityCounts.set(
            session.activityId,
            (activityCounts.get(session.activityId) ?? 0) + 1,
        )
    }

    // Her saat için en popüler aktiviteyi bul
    const activities = await trackerGetAllActivities()
    const activityMap = new Map<string, Activity>(activities.map(a => [a.id, a]))

    const suggestions = new Map<number, ActivitySuggestion>()

    for (const [hour, activityCounts] of hourCounts.entries()) {
        let topId = ''
        let topCount = 0
        let totalCount = 0

        for (const [activityId, count] of activityCounts.entries()) {
            totalCount += count
            if (count > topCount) {
                topCount = count
                topId = activityId
            }
        }

        if (topId && topCount >= 2) {
            const activity = activityMap.get(topId)
            const unknownLabel = getTranslation(getCurrentLocale(), 'tracker', 'suggestion.unknownActivity')
            suggestions.set(hour, {
                activityId: topId,
                activityName: activity?.name ?? unknownLabel,
                confidence: totalCount > 0 ? topCount / totalCount : 0,
                hourOfDay: hour,
                count: topCount,
            })
        }
    }

    return suggestions
}

/**
 * Şu anki saat için öneri döner.
 */
export async function getCurrentSuggestion(): Promise<ActivitySuggestion | null> {
    const suggestions = await getHourlySuggestions()
    const currentHour = new Date().getHours()
    return suggestions.get(currentHour) ?? null
}
