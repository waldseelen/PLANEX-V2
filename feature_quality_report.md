# STEMA Feature Quality Report: Activity, Habit, Tracker & Sidebar

This report is concrete evidence for `PRODUCT_DIRECTION.md` step 1
("solidify the primary planner/tracker core") — these are the specific
issues to work through before moving on to the STEM/planner integration
bridge or any new STEM features.

## 1. Folder and File Naming Consistency
- **Intra-module organization:** the `tracker` and `planner` modules' UI
  component organization is completely inconsistent. The `tracker` module
  (Activity and Tracker components) dumps modals, charts, and forms flatly
  into `src/modules/tracker/components/`. The `planner` module (Habit), by
  contrast, properly organizes UI components into `components/features` and
  `components/ui`. On top of that, the `tracker` module doesn't even have a
  `types` folder.
- **Database files:** Dexie.js configuration is inconsistent by directory.
  `planner` has its own isolated, well-organized `src/db/planner` folder
  (migrations, types.ts, database.ts included); time-tracking (`tracker`)
  database files pollute the project's main `src/db/` directory
  (`src/db/types.ts` and `src/db/migrations.ts` belong to time-tracking,
  only the `queries` folder is in a subdirectory).

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
