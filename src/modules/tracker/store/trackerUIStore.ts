/**
 * trackerUIStore — Zustand UI State
 *
 * Transient tracker UI state that isn't domain data.
 * DB state → useLiveQuery (Dexie); UI state → this store.
 *
 * Modal open/close is handled by local component state in each page;
 * this store only holds the activity-grid category filter.
 */

import { create } from 'zustand'

export interface TrackerUIState {
    // Aktivite grid filtresi
    selectedCategoryId: string | null

    // Actions
    setSelectedCategoryId: (id: string | null) => void
}

export const useTrackerUIStore = create<TrackerUIState>((set) => ({
    selectedCategoryId: null,

    setSelectedCategoryId: (id) => set({ selectedCategoryId: id }),
}))
