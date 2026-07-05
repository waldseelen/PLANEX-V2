/**
 * exportService — CSV/JSON Export (Supabase-first)
 *
 * TimeSession verilerini CSV ve JSON formatında dışa aktarır.
 */

import type { BackupData, ExportMetadata } from '@/db/time-tracking/types'
import { listOwnedRows } from '@/lib/cloud/supabaseRepo'
import {
    trackerGetAllActivities,
    trackerGetAllGoals,
    trackerGetAllTags,
    trackerGetCategories,
    trackerGetEnabledRules,
    trackerGetAllReminders,
    trackerGetRunningTimers,
    trackerGetSessionsByDateRange,
} from '@/lib/cloud/trackerRepo'

// ============================================
// CSV Export
// ============================================

/**
 * Session'ları CSV formatında dışa aktarır.
 * Kolonlar: activityName, categoryName, tags, startTime, endTime, durationSec, note, date
 */
export async function exportCSV(
    startISO?: string,
    endISO?: string,
): Promise<string> {
    // Session'ları al
    const effectiveStart = startISO ?? '2000-01-01'
    const effectiveEnd = endISO ?? '2099-12-31'
    const sessions = await trackerGetSessionsByDateRange(effectiveStart, effectiveEnd)

    // Aktivite ve kategori map
    const activities = await trackerGetAllActivities()
    const categories = await trackerGetCategories()
    const tags = await trackerGetAllTags()

    const activityMap = new Map(activities.map(a => [a.id, a]))
    const categoryMap = new Map(categories.map(c => [c.id, c]))
    const tagMap = new Map(tags.map(t => [t.id, t]))

    // CSV header
    const header = 'activityName,categoryName,tags,startTime,endTime,durationSec,note,date'

    // CSV satırları
    const rows = sessions.map(session => {
        const activity = activityMap.get(session.activityId)
        const category = activity ? categoryMap.get(activity.categoryId) : undefined
        const sessionTags = activity?.tagIds
            .map(id => tagMap.get(id)?.name)
            .filter(Boolean)
            .join('; ') ?? ''

        const startTime = new Date(session.startAt).toISOString()
        const endTime = new Date(session.endAt).toISOString()
        const note = csvEscape(session.note)

        return [
            csvEscape(activity?.name ?? 'Unknown'),
            csvEscape(category?.name ?? 'Unknown'),
            csvEscape(sessionTags),
            startTime,
            endTime,
            session.durationSec,
            note,
            session.dateKey,
        ].join(',')
    })

    return [header, ...rows].join('\n')
}

function csvEscape(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`
    }
    return value
}

// ============================================
// JSON Export (Full Backup)
// ============================================

/**
 * Tracker verilerini BackupData formatında Supabase'den dışa aktarır.
 */
export async function exportJSON(): Promise<BackupData> {
    const [
        categoriesData,
        tagsData,
        activitiesData,
        timeSessionsData,
        runningTimersData,
        goalsData,
        rulesData,
        remindersData,
        pomodoroConfigsRaw,
        settingsRaw,
    ] = await Promise.all([
        trackerGetCategories(),
        trackerGetAllTags(),
        trackerGetAllActivities(),
        trackerGetSessionsByDateRange('2000-01-01', '2099-12-31'),
        trackerGetRunningTimers(),
        trackerGetAllGoals(),
        trackerGetEnabledRules(),
        trackerGetAllReminders(),
        listOwnedRows('pomodoro_configs'),
        listOwnedRows('settings'),
    ])

    const metadata: ExportMetadata = {
        version: '1.0.0',
        schemaVersion: 1,
        exportedAt: Date.now(),
    }

    return {
        metadata,
        categories: categoriesData,
        tags: tagsData,
        activities: activitiesData,
        timeSessions: timeSessionsData,
        runningTimers: runningTimersData,
        pomodoroConfigs: pomodoroConfigsRaw as unknown as import('@/db/time-tracking/types').PomodoroConfig[],
        habits: [],
        habitLogs: [],
        goals: goalsData,
        rules: rulesData,
        reminders: remindersData,
        settings: settingsRaw as unknown as import('@/db/time-tracking/types').Setting[],
    }
}

// ============================================
// Download Helpers
// ============================================

/** Bir string'i dosya olarak indirir */
export function downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

/** CSV olarak indir */
export async function downloadCSV(startISO?: string, endISO?: string): Promise<void> {
    const csv = await exportCSV(startISO, endISO)
    const date = new Date().toISOString().slice(0, 10)
    downloadFile(csv, `planex-records-${date}.csv`, 'text/csv;charset=utf-8')
}

/** JSON olarak indir */
export async function downloadJSON(): Promise<void> {
    const data = await exportJSON()
    const json = JSON.stringify(data, null, 2)
    const date = new Date().toISOString().slice(0, 10)
    downloadFile(json, `planex-backup-${date}.json`, 'application/json')
}
