import { DEFAULT_POMODORO_CONFIG } from '@/config/defaults'
import { db } from '@/db/time-tracking'
import type { PomodoroConfig, Setting, SettingKey } from '@/db/time-tracking/types'
import { eventBus } from '@/events'
import { ensureRemoteUserDefaults } from '@/lib/cloud/remoteDefaults'
import { listOwnedRows, upsertOwnedRow } from '@/lib/cloud/supabaseRepo'
import { getCurrentLocale, type Locale } from '@/i18n'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { create } from 'zustand'

const resolveDefaultLanguage = (): Locale => {
    if (typeof window === 'undefined') {
        return 'tr'
    }

    return getCurrentLocale()
}

const POMODORO_CONFIG_KEYS = new Set([
    'pomodoroWorkDuration',
    'pomodoroBreakDuration',
    'pomodoroLongBreakDuration',
    'pomodoroSessionsBeforeLongBreak',
] as const)

type PomodoroStateKey = (typeof POMODORO_CONFIG_KEYS extends Set<infer T> ? T : never) & string

function getDefaultPomodoroConfig(): PomodoroConfig {
    return {
        ...DEFAULT_POMODORO_CONFIG,
    }
}

function mapPomodoroRowToLocalConfig(row: {
    id: string
    name: string
    work_duration: number
    short_break_duration: number
    long_break_duration: number
    sessions_before_long_break: number
    is_default: boolean
}): PomodoroConfig {
    return {
        id: row.id,
        name: row.name,
        workDuration: row.work_duration,
        shortBreakDuration: row.short_break_duration,
        longBreakDuration: row.long_break_duration,
        sessionsBeforeLongBreak: row.sessions_before_long_break,
        isDefault: row.is_default,
    }
}

function mapSettingRows(settings: Setting[]) {
    const settingsMap = new Map<string, Setting['value']>()
    settings.forEach(setting => {
        settingsMap.set(setting.key, setting.value)
    })
    return settingsMap
}

async function syncLocalSettingsCache(settings: Setting[]) {
    // offline storage is handled via Firestore onSnapshot
}

async function syncLocalPomodoroCache(config: PomodoroConfig) {
    // offline storage is handled via Firestore onSnapshot
}

interface SettingsState {
    rolloverHour: number
    weekStart: 1 | 7
    theme: 'light' | 'dark' | 'system'
    language: Locale
    multitaskingEnabled: boolean
    mergeThresholdMinutes: number
    defaultPomodoroConfigId: string | null

    pomodoroWorkDuration: number
    pomodoroBreakDuration: number
    pomodoroLongBreakDuration: number
    pomodoroSessionsBeforeLongBreak: number
    pomodoroAutoStartBreak: boolean
    pomodoroAutoStartWork: boolean
    pomodoroSoundEnabled: boolean

    commandBarPrefixEnabled: boolean

    isLoading: boolean
    isInitialized: boolean

    initialize: () => Promise<void>
    updateSetting: <K extends SettingKey>(key: K, value: Setting['value']) => Promise<void>
    getSetting: <K extends SettingKey>(key: K) => Setting['value'] | undefined
    setRolloverHour: (hour: number) => Promise<void>
    setWeekStart: (day: 1 | 7) => Promise<void>
    setPomodoroSetting: (key: string, value: number | boolean) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
    rolloverHour: 4,
    weekStart: 1,
    theme: 'system',
    language: resolveDefaultLanguage(),
    multitaskingEnabled: false,
    mergeThresholdMinutes: 5,
    defaultPomodoroConfigId: DEFAULT_POMODORO_CONFIG.id,

    pomodoroWorkDuration: DEFAULT_POMODORO_CONFIG.workDuration / 60,
    pomodoroBreakDuration: DEFAULT_POMODORO_CONFIG.shortBreakDuration / 60,
    pomodoroLongBreakDuration: DEFAULT_POMODORO_CONFIG.longBreakDuration / 60,
    pomodoroSessionsBeforeLongBreak: DEFAULT_POMODORO_CONFIG.sessionsBeforeLongBreak,
    pomodoroAutoStartBreak: false,
    pomodoroAutoStartWork: false,
    pomodoroSoundEnabled: true,
    commandBarPrefixEnabled: false,

    isLoading: true,
    isInitialized: false,

    initialize: async () => {
        set({ isLoading: true })

        try {
            const authState = useAuthStore.getState()
            const canUseRemote = authState.isAuthenticated

            if (canUseRemote) {
                await ensureRemoteUserDefaults()

                const [remoteSettings, remotePomodoroConfigs] = await Promise.all([
                    listOwnedRows('settings'),
                    listOwnedRows('pomodoro_configs'),
                ])

                const settings = remoteSettings.map((setting: any) => ({
                    key: setting.key as SettingKey,
                    value: setting.value as Setting['value'],
                }))
                const settingsMap = mapSettingRows(settings)
                const selectedPomodoroId = (settingsMap.get('defaultPomodoroConfigId') as string | null) ?? DEFAULT_POMODORO_CONFIG.id
                const defaultRemoteConfig = remotePomodoroConfigs.find((config: any) => config.id === selectedPomodoroId)
                    ?? remotePomodoroConfigs.find((config: any) => config.is_default)
                const pomodoroConfig = defaultRemoteConfig
                    ? mapPomodoroRowToLocalConfig(defaultRemoteConfig)
                    : getDefaultPomodoroConfig()

                await Promise.all([
                    syncLocalSettingsCache(settings),
                    syncLocalPomodoroCache(pomodoroConfig),
                ])

                set({
                    rolloverHour: (settingsMap.get('rolloverHour') as number) ?? 4,
                    weekStart: (settingsMap.get('weekStart') as 1 | 7) ?? 1,
                    theme: (settingsMap.get('theme') as 'light' | 'dark' | 'system') ?? 'system',
                    language: (settingsMap.get('language') as Locale) ?? resolveDefaultLanguage(),
                    multitaskingEnabled: (settingsMap.get('multitaskingEnabled') as boolean) ?? false,
                    mergeThresholdMinutes: (settingsMap.get('mergeThresholdMinutes') as number) ?? 5,
                    defaultPomodoroConfigId: selectedPomodoroId,
                    commandBarPrefixEnabled: (settingsMap.get('commandBarPrefixEnabled') as boolean) ?? false,
                    pomodoroWorkDuration: pomodoroConfig.workDuration / 60,
                    pomodoroBreakDuration: pomodoroConfig.shortBreakDuration / 60,
                    pomodoroLongBreakDuration: pomodoroConfig.longBreakDuration / 60,
                    pomodoroSessionsBeforeLongBreak: pomodoroConfig.sessionsBeforeLongBreak,
                    pomodoroAutoStartBreak: (settingsMap.get('pomodoroAutoStartBreak') as boolean) ?? false,
                    pomodoroAutoStartWork: (settingsMap.get('pomodoroAutoStartWork') as boolean) ?? false,
                    pomodoroSoundEnabled: (settingsMap.get('pomodoroSoundEnabled') as boolean) ?? true,
                    isLoading: false,
                    isInitialized: true,
                })
                return
            }

            const settings: Setting[] = []
            const defaultPomodoroConfig = undefined
            const settingsMap = mapSettingRows(settings)
            const pomodoroConfig = defaultPomodoroConfig ?? getDefaultPomodoroConfig()

            set({
                rolloverHour: (settingsMap.get('rolloverHour') as number) ?? 4,
                weekStart: (settingsMap.get('weekStart') as 1 | 7) ?? 1,
                theme: (settingsMap.get('theme') as 'light' | 'dark' | 'system') ?? 'system',
                language: (settingsMap.get('language') as Locale) ?? resolveDefaultLanguage(),
                multitaskingEnabled: (settingsMap.get('multitaskingEnabled') as boolean) ?? false,
                mergeThresholdMinutes: (settingsMap.get('mergeThresholdMinutes') as number) ?? 5,
                defaultPomodoroConfigId: (settingsMap.get('defaultPomodoroConfigId') as string) ?? DEFAULT_POMODORO_CONFIG.id,
                commandBarPrefixEnabled: (settingsMap.get('commandBarPrefixEnabled') as boolean) ?? false,
                pomodoroWorkDuration: pomodoroConfig.workDuration / 60,
                pomodoroBreakDuration: pomodoroConfig.shortBreakDuration / 60,
                pomodoroLongBreakDuration: pomodoroConfig.longBreakDuration / 60,
                pomodoroSessionsBeforeLongBreak: pomodoroConfig.sessionsBeforeLongBreak,
                pomodoroAutoStartBreak: (settingsMap.get('pomodoroAutoStartBreak') as boolean) ?? false,
                pomodoroAutoStartWork: (settingsMap.get('pomodoroAutoStartWork') as boolean) ?? false,
                pomodoroSoundEnabled: (settingsMap.get('pomodoroSoundEnabled') as boolean) ?? true,
                isLoading: false,
                isInitialized: true,
            })
        } catch (error) {
            console.error('Failed to initialize settings:', error)
            set({ isLoading: false })
        }
    },

    updateSetting: async (key, value) => {
        const oldValue = get()[key as keyof SettingsState]

        try {
            if (useAuthStore.getState().isAuthenticated) {
                await upsertOwnedRow(
                    'settings',
                    {
                        key,
                        value: value as import('@/types/supabase').Json,
                    },
                    { onConflict: 'user_id,key' },
                )
            }


            set({ [key]: value } as Partial<SettingsState>)

            await eventBus.publish('SETTING_CHANGED', {
                key,
                oldValue,
                newValue: value,
            })
        } catch (error) {
            console.error(`Failed to update setting ${key}:`, error)
            throw error
        }
    },

    getSetting: (key) => {
        return get()[key as keyof SettingsState] as Setting['value'] | undefined
    },

    setRolloverHour: async (hour) => {
        await get().updateSetting('rolloverHour', hour)
    },

    setWeekStart: async (day) => {
        await get().updateSetting('weekStart', day)
    },

    setPomodoroSetting: async (key, value) => {
        set({ [key]: value } as Partial<SettingsState>)

        if (!POMODORO_CONFIG_KEYS.has(key as PomodoroStateKey)) {
            const settingKey = key as SettingKey
            await get().updateSetting(settingKey, value)
            return
        }

        const state = get()
        const configId = state.defaultPomodoroConfigId ?? DEFAULT_POMODORO_CONFIG.id
        const pomodoroConfig: PomodoroConfig = {
            id: configId,
            name: DEFAULT_POMODORO_CONFIG.name,
            workDuration: (key === 'pomodoroWorkDuration' ? value : state.pomodoroWorkDuration) as number * 60,
            shortBreakDuration: (key === 'pomodoroBreakDuration' ? value : state.pomodoroBreakDuration) as number * 60,
            longBreakDuration: (key === 'pomodoroLongBreakDuration' ? value : state.pomodoroLongBreakDuration) as number * 60,
            sessionsBeforeLongBreak: (key === 'pomodoroSessionsBeforeLongBreak'
                ? value
                : state.pomodoroSessionsBeforeLongBreak) as number,
            isDefault: true,
        }

        if (useAuthStore.getState().isAuthenticated) {
            await upsertOwnedRow(
                'pomodoro_configs',
                {
                    id: pomodoroConfig.id,
                    name: pomodoroConfig.name,
                    work_duration: pomodoroConfig.workDuration,
                    short_break_duration: pomodoroConfig.shortBreakDuration,
                    long_break_duration: pomodoroConfig.longBreakDuration,
                    sessions_before_long_break: pomodoroConfig.sessionsBeforeLongBreak,
                    is_default: true,
                },
                { onConflict: 'user_id,id' },
            )
        }

        await syncLocalPomodoroCache(pomodoroConfig)
    },
}))
