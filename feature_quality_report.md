# STEMA Feature Quality Report: Activity, Habit, Tracker & Sidebar

This report is concrete evidence for `PRODUCT_DIRECTION.md` step 1
("solidify the primary planner/tracker core") — these are the specific
issues to work through before moving on to the STEM/planner integration
bridge or any new STEM features.

> **Scope note.** This file records dated *observations* of tech debt, not current
> status. The test counts quoted below ("319 passing", "321 passing") are what was
> observed on 2026-07-06 and are **not** the current test gate. `PROGRESS.md` §6
> owns the current figure and supersedes both — see `CLAUDE.md` §3.

## Status (observed 2026-07-06)

Items 2 and 3 below are resolved, via
[PR #1](https://github.com/waldseelen/PLANEX-V2/pull/1) (merged
2026-07-06): dead `plannerUIStore`/planner `Toast.tsx` removed,
`plannerAppStore`/`trackerUIStore` trimmed to their actually-consumed
fields, and all 6 tracker edit modals (`ActivityEditModal`,
`CategoryEditModal`, `GoalEditModal`, `RecordEditModal`,
`ReminderEditModal`, `TagEditModal`) migrated onto the single canonical
`src/shared/components/Modal.tsx` instead of hand-rolled framer-motion
dialogs. Typecheck clean, 319 tests passing (10 pre-existing
network-dependent failures unrelated to this change).

Item 1 is now resolved (re-checked 2026-07-06, see note below). Item 4
(`RightPanel.tsx` God Component) is still open.

## 1. Folder and File Naming Consistency — RESOLVED (re-checked 2026-07-06)
On re-inspection this item was stale: `src/modules/tracker/components/`
already mirrors planner's `components/features` + `components/ui` split,
and `src/db/time-tracking/` is already its own isolated folder
(`database.ts`, `migrations.ts`, `types.ts`, `queries/`) exactly like
`src/db/planner/` — this was true since the module's original commit, so
the original claim in this section was inaccurate rather than a regression.

The one real gap found on re-check: `src/modules/tracker/types/` existed
as an empty folder, while the module's actually-shared domain types
(`RecordsFilterState`, `PeriodKey`, `ActivitySuggestion`, `PomodoroPhase`)
were defined inline in the components/lib/store files that happened to
use them first, instead of centralized like planner's
`types/index.ts`. Fixed: those 4 types now live in
`src/modules/tracker/types/index.ts`; all consumers (`RecordsPage`,
`StatsPage`, `TrackerPage`, `PomodoroRuntime`, the module's `index.ts`
barrel) import from there. `TrackerUIState` (the Zustand store's own
`create<T>()` shape) was deliberately left in `trackerUIStore.ts`,
matching the same convention already used by `plannerAppStore.ts`
(`PlannerAppState`/`PlannerAppActions` stay local to the store file).
Typecheck, build, and test suite (321 passing, same 10 pre-existing
network-dependent failures) all verified clean after the move.

## 2. State Management (Zustand and Dexie.js)
- **Zustand used for modals (major inconsistency):** both
  `trackerUIStore.ts` and `plannerUIStore.ts` are designed to centrally
  manage open modals (e.g. `isEditModalOpen`, `activeModal`, etc.). On
  inspection, though, developers reached for React's local hooks instead of
  using these central Zustand stores (e.g. `HabitsDashboardPage.tsx` uses
  `const [isAddModalOpen, setIsAddModalOpen] = useState(false)`). This has
  left the corresponding store code as dead code.
- **Dexie.js and hooks:** database integration is solid here. Custom hooks
  like `useHabits`, `useCourses`, `useActiveActivities` reactively feed data
  to the UI and show a consistent pattern.
- **Toast state confusion:** `plannerAppStore.ts` has a Zustand-managed
  toast (notification) system, while a Context-API-based
  `src/shared/components/Toast.tsx` also exists. Two different state
  management architectures collide here.

## 3. Code Duplication in UI Components
- **Modal hell (code duplication):** there are 3 separate Modal
  implementations in the system. The project has a general
  `src/shared/components/Modal.tsx` component. But the planner team copied
  it to create `src/modules/planner/components/ui/Modal.tsx`. The tracker
  team did worse: `ActivityEditModal.tsx` and `GoalEditModal.tsx` use
  neither of these — they reimplement the backdrop, HTML divs, and
  body-scroll-lock logic **from scratch** using `framer-motion` directly
  inside the modal itself.
- **Missing Button and Input wrappers:** the `planner` module uses buttons
  and inputs through wrappers like `components/ui/Button.tsx`, while the
  `tracker` module uses raw HTML tags with Tailwind classes directly
  (e.g. `<input className="input" />`) without going through a wrapper.
- **Toast duplicates:** planner pages have started importing the shared
  (`shared`) Toast instead of using their own in-module Toast component,
  which has left the planner's own Toast code as unnecessary duplication.

## 4. Code Smells That Need Refactoring
- **God Component (`RightPanel.tsx`):**
  `src/app/components/RightPanel.tsx` is a full 901 lines long (a God
  Component). It pulls and processes data from almost every module in the
  project — Habits, Tracker Timers, Pomodoro, Courses, Tasks, and
  Deadlines — in a single file. This is one of the biggest code smells in
  the codebase. Developers opened a
  `src/app/components/RightPanelWidgets/` folder to split this file apart,
  but that folder is currently **completely empty**.
- **Tight coupling:** `RightPanel` and `SidebarNew` call database hooks
  (`useCourses`, `useTodayHabitsWithStatus`, etc.) directly inside
  themselves instead of receiving pure data as props. This destroys the
  testability and reusability of these components.
- **Cleaning up unused code:** the unused modal state in the Zustand
  stores, and the duplicated Modal and Toast files, urgently need to be
  removed and wired back to the ones in `src/shared` (refactored).
