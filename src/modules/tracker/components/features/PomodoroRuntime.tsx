import { useSettingsStore } from '@/modules/settings/store/settingsStore'
import { useToast } from '@/shared/components/Toast'
import { useCallback, useEffect } from 'react'
import { savePomodoroSession } from '../../lib/timerService'
import { usePomodoroStore } from '../../store/pomodoroStore'
import type { PomodoroPhase } from '../../types'

function playBeep(enabled: boolean) {
    if (!enabled || typeof AudioContext === 'undefined') {
        return
    }

    try {
        const context = new AudioContext()
        const oscillator = context.createOscillator()
        const gain = context.createGain()

        oscillator.connect(gain)
        gain.connect(context.destination)
        oscillator.frequency.value = 880
        gain.gain.setValueAtTime(0.3, context.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.5)
        oscillator.start(context.currentTime)
        oscillator.stop(context.currentTime + 0.5)
    } catch {
        // ignore audio failures
    }
}

function resolveTotalSeconds(phase: PomodoroPhase, workSeconds: number, breakSeconds: number) {
    return phase === 'work' ? workSeconds : breakSeconds
}

export function PomodoroRuntime() {
    const {
        phase,
        running,
        selectedActivityId,
        startAtMs,
        markSessionSaved,
        setPhaseState,
        setSecondsLeft,
        syncDuration,
    } = usePomodoroStore()
    const {
        pomodoroWorkDuration,
        pomodoroBreakDuration,
        pomodoroSoundEnabled,
    } = useSettingsStore()
    const { showToast } = useToast()

    const workSeconds = pomodoroWorkDuration * 60
    const breakSeconds = pomodoroBreakDuration * 60

    const handlePhaseComplete = useCallback(async (
        completedPhase: PomodoroPhase,
        completedStartAtMs: number,
        activityId: string,
    ) => {
        playBeep(pomodoroSoundEnabled)

        if (completedPhase === 'work' && activityId) {
            try {
                const sessionId = await savePomodoroSession(activityId, workSeconds, completedStartAtMs)
                markSessionSaved(sessionId)
            } catch (error) {
                console.error('Pomodoro session could not be saved:', error)
                showToast(error instanceof Error ? error.message : 'Pomodoro session save failed', { variant: 'error' })
            }
        }

        const nextPhase: PomodoroPhase = completedPhase === 'work' ? 'break' : 'work'
        setPhaseState(nextPhase, resolveTotalSeconds(nextPhase, workSeconds, breakSeconds))
    }, [breakSeconds, markSessionSaved, pomodoroSoundEnabled, setPhaseState, showToast, workSeconds])

    useEffect(() => {
        syncDuration(resolveTotalSeconds(phase, workSeconds, breakSeconds))
    }, [breakSeconds, phase, syncDuration, workSeconds])

    useEffect(() => {
        if (!running) {
            return
        }

        const intervalId = window.setInterval(() => {
            const state = usePomodoroStore.getState()
            if (state.secondsLeft <= 1) {
                window.clearInterval(intervalId)
                void handlePhaseComplete(state.phase, state.startAtMs, state.selectedActivityId)
                return
            }

            state.setSecondsLeft(state.secondsLeft - 1)
        }, 1000)

        return () => {
            window.clearInterval(intervalId)
        }
    }, [handlePhaseComplete, running, selectedActivityId, startAtMs, setSecondsLeft])

    return null
}
