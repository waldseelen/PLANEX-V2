# PLAN.EX Project Memory

## Project Overview
React + TypeScript SPA — student planning app.
Stack: Vite, React 18, Framer Motion, Zustand, Dexie (IndexedDB), i18n, echarts, TailwindCSS.
Test baseline: **282 tests passing** (as of 2026-03-14)

## Architecture
- `src/app/` — layout, routing, providers
- `src/modules/` — planner, tracker, settings
- `src/shared/` — shared components, hooks, utils
- `src/i18n/` — i18n config + locale files (namespaces: common, auth, landing, onboarding, planner, tracker, calendar, habits, settings)

## i18n Key Convention
Locale files wrap keys under their namespace name: `{ "onboarding": { "progress": "..." } }`.
Translation functions must use full-path keys: `t('onboarding.progress')`, NOT `t('progress')`.
This applies everywhere — including `OnboardingCoachmark` (`tOnboarding('onboarding.xxx')`).

## Design Token Reference
- `bg-background` → `var(--bg-primary)` (light: #FAFAFA / dark: #050505)
- `bg-surface-100/200/300` → surface hierarchy
- `text-text-primary/secondary/muted` → text hierarchy
- `status-violet/green/amber/red/blue` → semantic status colors (dot, badge, border-l)
- `status-*-soft` → status/10 (light) or /12-15 (dark) — for badge backgrounds
- accent → violet (#7C3AED light / #8B5CF6 dark)

## Key Rules (Color Layer Architecture)
- Card/modal/sidebar backgrounds → monochrome tokens only
- Primary button → bg-black text-white (light) / bg-white text-black (dark)
- Status/urgency → dot(8px), border-l-2(3px), badge-outline only
- Course left stripe / calendar dot / progress bar → `course.color` (data color, correct usage)
- NEVER use color as a card background
- Motion: 180-200ms standard easing only; spring easing forbidden

## Completed Passes (Chronological)

### ✅ Visual Rework (Phases 1-6) — DONE
Token reset, Nav, Layout/Ambient, Card/Components, Page-by-page, Polish (reduced-motion).
Detail: `memory/visual_rework.md`

### ✅ Optimizations (Phase 0-5) — DONE (2026-03-11)
Set-based lookups, useMemo guards, Zustand→Dexie migrations for all planner pages,
CommandBar lazy-mount, RightPanel O(1) maps, test baseline 238→282.
Detail: `memory/optimizations.md`

### ✅ Design Overhaul, 9 Phases — DONE (2026-03-13)
Token reset, typography, component reset (rounded-lg, scale(0.985)), motion cleanup,
landing update, app shell h-14, onboarding spring→standard, module icon neutral.
Detail: `memory/design_overhaul.md`

### ✅ Exposed-Flow Stabilization — DONE (2026-03-14)
**Test baseline fixed: 5 failing → 282 passing**
- `src/i18n/locales/tr/onboarding.json` + `en/onboarding.json`: added 8-step keys
  (welcome, modules, planner, tracker, habits, calendar, goals, usage + begin/gotIt/start + moduleCards + usageOptions)
- `src/modules/auth/components/OnboardingCoachmark.tsx`: fixed the tOnboarding key-path bug
  (`'progress'` → `'onboarding.progress'` etc. — all shorthand keys corrected)
- `src/modules/auth/pages/AuthPage.tsx`: added `v1.0.0` to the footer
- `tests/auth/authFlow.test.tsx`: added a step 0→1→2 click simulation for the fallback test
- `tests/components/ActivityEditModal.test.tsx`: added `ToastProvider` wrapper + icon picker click

## Onboarding 8-Step Contract (OnboardingOrchestrator)
Steps (kind): welcome, modules, planner (target:dashboard-hero), tracker (target:nav-tracker),
habits (target:dashboard-section-habits), calendar (target:nav-calendar),
goals (target:quick-actions), usage
primaryLabels: begin → common.next × 5 → start

## Test Setup Notes
- `tests/` — all test files, Vitest + RTL + fake-indexeddb
- Components using `useToast()` require a `<ToastProvider>` wrapper in tests
- `OnboardingOrchestrator` requires `<ToastProvider>` + `<MemoryRouter>` + `data-onboarding-target` DOM nodes
- Icon picker headings (Study & Education etc.) are only visible after clicking the icon toggle button
