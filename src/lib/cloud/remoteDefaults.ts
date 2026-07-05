import {
    DEFAULT_CATEGORIES,
    DEFAULT_POMODORO_CONFIG,
    DEFAULT_SETTINGS_DATA,
} from '@/config/defaults'
import { listOwnedRows, upsertOwnedRows } from './supabaseRepo'

export async function ensureRemoteUserDefaults(): Promise<{
    seededCategories: boolean
    seededPomodoro: boolean
    seededSettings: boolean
}> {
    const [categories, pomodoroConfigs, settings] = await Promise.all([
        listOwnedRows('categories'),
        listOwnedRows('pomodoro_configs'),
        listOwnedRows('settings'),
    ])

    const now = Date.now()
    let seededCategories = false
    let seededPomodoro = false
    let seededSettings = false

    if (categories.length === 0) {
        await upsertOwnedRows(
            'categories',
            DEFAULT_CATEGORIES.map(category => ({
                id: category.id,
                name: category.name,
                color: category.color,
                icon: category.icon,
                archived: category.archived,
                created_at: now,
                updated_at: now,
            })),
            { onConflict: 'id' },
        )
        seededCategories = true
    }

    if (pomodoroConfigs.length === 0) {
        await upsertOwnedRows(
            'pomodoro_configs',
            [{
                id: DEFAULT_POMODORO_CONFIG.id,
                name: DEFAULT_POMODORO_CONFIG.name,
                work_duration: DEFAULT_POMODORO_CONFIG.workDuration,
                short_break_duration: DEFAULT_POMODORO_CONFIG.shortBreakDuration,
                long_break_duration: DEFAULT_POMODORO_CONFIG.longBreakDuration,
                sessions_before_long_break: DEFAULT_POMODORO_CONFIG.sessionsBeforeLongBreak,
                is_default: DEFAULT_POMODORO_CONFIG.isDefault,
            }],
            { onConflict: 'user_id,id' },
        )
        seededPomodoro = true
    }

    if (settings.length === 0) {
        await upsertOwnedRows(
            'settings',
            DEFAULT_SETTINGS_DATA.map((setting, index) => ({
                id: `settings-${index}`, // Unique ID for Firestore document
                key: setting.key,
                value: setting.value as any,
            })),
            { onConflict: 'user_id,key' },
        )
        seededSettings = true
    }

    return {
        seededCategories,
        seededPomodoro,
        seededSettings,
    }
}
