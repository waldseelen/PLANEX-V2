/**
 * Planner App Store - Zustand
 *
 * Planner-specific persisted settings and the backup-reminder flag.
 * User-facing toasts are handled by the shared Context toast
 * (`@/shared/components/Toast`); theme is owned by ThemeProvider.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { AppSettings, DEFAULT_APP_SETTINGS } from '../types'

// ================== TYPES ==================

interface PlannerAppState {
    // Settings (planner-specific)
    settings: AppSettings

    // Backup
    backupWarning: boolean
}

interface PlannerAppActions {
    // Settings
    updateSettings: (updates: Partial<AppSettings>) => void

    // Backup
    setBackupWarning: (warning: boolean) => void
    checkBackupWarning: () => void
}

type PlannerAppStore = PlannerAppState & PlannerAppActions

const initialState: PlannerAppState = {
    settings: DEFAULT_APP_SETTINGS,
    backupWarning: false,
}

export const usePlannerAppStore = create<PlannerAppStore>()(
    persist(
        (set, get) => ({
            ...initialState,

            updateSettings: (updates) => {
                set(state => ({
                    settings: { ...state.settings, ...updates },
                }))
            },

            setBackupWarning: (warning) => {
                set({ backupWarning: warning })
            },

            checkBackupWarning: () => {
                const { settings } = get()
                const now = Date.now()
                const lastWarningTime = settings.lastBackupWarningISO
                    ? new Date(settings.lastBackupWarningISO).getTime()
                    : 0
                const isWarningCooldownOver = !lastWarningTime ||
                    Number.isNaN(lastWarningTime) ||
                    (now - lastWarningTime) >= (1000 * 60 * 60 * 24)
                let needsBackupWarning = false
                if (settings.lastBackupISO) {
                    const lastBackup = new Date(settings.lastBackupISO)
                    const daysSinceBackup = Math.floor(
                        (Date.now() - lastBackup.getTime()) / (1000 * 60 * 60 * 24)
                    )
                    needsBackupWarning = daysSinceBackup >= 7
                } else {
                    needsBackupWarning = true
                }
                set({ backupWarning: needsBackupWarning && isWarningCooldownOver })
            },
        }),
        {
            name: 'lifeflow-planner-app',
            version: 1,
            partialize: (state) => ({
                settings: state.settings,
            }),
        }
    )
)
