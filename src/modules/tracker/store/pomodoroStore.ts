import { create } from 'zustand'
import type { PomodoroPhase } from '../types'

interface PomodoroState {
    phase: PomodoroPhase
    running: boolean
    secondsLeft: number
    selectedActivityId: string
    completedSessions: number
    lastSavedId: string | null
    startAtMs: number
    setSelectedActivityId: (activityId: string) => void
    toggleRunning: (totalSeconds: number) => void
    setPhaseState: (phase: PomodoroPhase, secondsLeft: number) => void
    syncDuration: (secondsLeft: number) => void
    setSecondsLeft: (secondsLeft: number) => void
    markSessionSaved: (id: string) => void
    clearLastSavedId: () => void
    reset: (workSeconds: number) => void
}

export const usePomodoroStore = create<PomodoroState>((set) => ({
    phase: 'work',
    running: false,
    secondsLeft: 25 * 60,
    selectedActivityId: '',
    completedSessions: 0,
    lastSavedId: null,
    startAtMs: 0,
    setSelectedActivityId: selectedActivityId => set({ selectedActivityId }),
    toggleRunning: totalSeconds => set(state => ({
        running: !state.running,
        lastSavedId: null,
        startAtMs: state.running
            ? state.startAtMs
            : Date.now() - (totalSeconds - state.secondsLeft) * 1000,
    })),
    setPhaseState: (phase, secondsLeft) => set({
        phase,
        secondsLeft,
        running: false,
        startAtMs: 0,
    }),
    syncDuration: secondsLeft => set(state => (
        state.running ? state : { secondsLeft }
    )),
    setSecondsLeft: secondsLeft => set({ secondsLeft }),
    markSessionSaved: id => set(state => ({
        lastSavedId: id,
        completedSessions: state.completedSessions + 1,
    })),
    clearLastSavedId: () => set({ lastSavedId: null }),
    reset: workSeconds => set({
        phase: 'work',
        running: false,
        secondsLeft: workSeconds,
        lastSavedId: null,
        startAtMs: 0,
    }),
}))
