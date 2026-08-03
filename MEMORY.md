# MEMORY.md — durable non-obvious facts

Facts about how this repo actually behaves that are not inferable from reading
one file. Nothing here carries a date, a ✅, or a gate result — those live in
`PROGRESS.md` (`CLAUDE.md` §3). Binding rules live in `CLAUDE.md` §6; this file
carries the *values and contracts* those rules refer to.

## Traps and dead surfaces

- **`src/db/` is not a database.** The name is legacy. `src/db/planner/database.ts`
  and `src/db/time-tracking/database.ts` export empty object stubs
  (`{} as Record<string, unknown>`) with empty-bodied `clearPlannerData()` /
  `seedDefaultData()`. `dexie` is not a dependency and `PlannerDatabase` /
  `LifeFlowDB` do not exist as classes — `LifeFlowDB` is only a `DB_NAME` string
  at `src/config/constants.ts:184`. Everything under `src/db/*/queries/` reads
  from Supabase.
- **`useLiveQuery` is not in this codebase.** The identifier appears only in
  three explanatory comments describing what replaced it
  (`src/shared/hooks/useSupabaseQuery.ts`, `src/lib/cloud/queryInvalidation.ts`,
  `src/modules/tracker/store/trackerUIStore.ts`). A comment mentioning Dexie is
  not evidence Dexie is present.
- **`src/lib/cloud/domainSync.ts` is entirely no-op stubs.**
  `getDomainSyncSummary()` always returns `hasCloudData: false`,
  `hasLocalData: false`, `ownerMismatch: false`. Since
  `CloudDataBootstrap.tsx` branches on that summary, the owner-mismatch
  cache-clear branch and the local-data import prompt modal are **unreachable at
  runtime**; only `ensureRemoteUserDefaults()` can execute.
- **`src/lib/cloud/localCacheOwner.ts` is half-dead.** `clearLocalCacheOwner` is
  called twice from `authStore.ts`; `writeLocalCacheOwner` and
  `readLocalCacheOwner` have zero callers, so the owner value is never written
  and always reads `null`.
- **`VITE_ENABLE_SYNC` is dead.** Present in `.env.example`, referenced nowhere
  in `src/` or `api/`. It enables nothing. Its neighbours
  `VITE_ENABLE_GOOGLE_AUTH` and `VITE_ENABLE_GITHUB_AUTH` **are** live — read by
  `src/modules/auth/lib/security.ts:13,18` — so do not assume the whole
  `VITE_ENABLE_*` family is dead.
- **`CONSTANTS.DB_NAME` (`'LifeFlowDB'`, `src/config/constants.ts:184`) has zero
  consumers.** Nothing opens a database with it. It is the last textual residue
  of the removed local database, not a live handle.
- **Installed but never imported:** `prop-types`, `@stripe/stripe-js` (only
  env-var price-ID strings in `src/config/plans.ts` — there is no billing code),
  `@next/bundle-analyzer` (a Next.js package; analysis actually runs through
  `rollup-plugin-visualizer`).
- **`src/config/supabase.ts` always constructs a client**, falling back to
  `https://placeholder.supabase.co` / `placeholder-anon-key` when env vars are
  missing. A non-null `supabase` export therefore does not mean Supabase is
  configured — branch on the exported `isSupabaseConfigured` instead.
- **`useSupabaseQuery` does not auto-revalidate.** It is a pub/sub cache; a
  mutation that does not call `invalidateTables([...])` leaves stale rows
  rendered with no error.

## i18n key convention

Locale files wrap every key under their own namespace name — `en/onboarding.json`
begins `{ "onboarding": { "progress": ..., "skip": ... } }`. Translation calls
must therefore use the **full path**, including the namespace, even when the
`t` function is already bound to that namespace:
`tOnboarding('onboarding.progress')`, never `tOnboarding('progress')`. This bit
`OnboardingCoachmark.tsx` once already.

Namespaces (`src/i18n/locales/{en,tr}/`): `auth`, `calendar`, `common`,
`habits`, `landing`, `onboarding`, `planner`, `settings`, `tracker`.

## Design token values

Defined in `src/index.css` and surfaced through `tailwind.config.js`, which maps
Tailwind colour names onto CSS custom properties. The two files must change
together — editing one alone yields classes that resolve to nothing.

- `--bg-primary`: `#ffffff` (light) / `#0a0a0a` (dark)
- `--color-accent`: `#2563eb` (light) / `#3b82f6` (dark) — **the accent is blue**
- `--color-accent-2`: `#d97706` (light)
- `--accent-soft`: `rgba(37, 99, 235, 0.08)` light / `rgba(59, 130, 246, 0.12)` dark
- `bg-surface-100/200/300` → `--bg-surface-*-rgb`, the surface hierarchy
- `text-text-primary/secondary/muted` → text hierarchy
- `status-violet/green/amber/red/blue` → semantic status colours, with
  `status-*-soft` variants for badge backgrounds. `--status-violet` is `#7c3aed`
  and `--status-green` is `#16a34a`.

**`#7c3aed` is `--status-violet`, not the accent.** Older docs conflated the two
and described the accent as violet; it is blue.

## Motion config

`src/config/motion.ts` is the single source. Durations (ms):
`instant: 60`, `fast: 120`, `base: 160`, `slow: 200`, `page: 130`.
Easings: `standard [0.4, 0, 0.2, 1]`, `enter [0, 0, 0.2, 1]`,
`exit [0.4, 0, 1, 1]`, each with a `cssEasing` string twin. The `slideUp`
variant uses `y: 8`.

**There is no spring or overshoot easing in this config** — it was removed
deliberately and must not be reintroduced (`CLAUDE.md` §6).

## Onboarding step contract

`OnboardingOrchestrator` builds 8 steps in this order:

| # | kind | target | primary label |
| - | ---- | ------ | ------------- |
| 1 | `welcome` | — | `onboarding.begin` |
| 2 | `modules` | — | `common.next` |
| 3 | `coachmark` | `dashboard-hero` | `onboarding.gotIt` |
| 4 | `coachmark` | `nav-tracker` | `onboarding.gotIt` |
| 5 | `coachmark` | `dashboard-section-habits` | `onboarding.gotIt` |
| 6 | `coachmark` | `nav-calendar` | `onboarding.gotIt` |
| 7 | `coachmark` | `quick-actions` | `onboarding.gotIt` |
| 8 | `usage` | — | `onboarding.start` |

**Step 6 always hits the fallback.** It targets `nav-calendar`, but
`src/app/components/navItems.ts` defines ids `overview`, `tasks`, `habits`,
`tracker`, `courses`, `learn`, `stats`, `settings` — there is no `calendar` item,
so `[data-onboarding-target="nav-calendar"]` never resolves in the real app. The
missing-target fallback is load-bearing, not defensive polish. Tracked in
`TASKS.md`.

## Test setup gotchas

- Test files live under `tests/**/*.test.ts(x)`; runner is Vitest + Testing
  Library + jsdom, with `fake-indexeddb/auto` polyfilling IndexedDB in
  `tests/setup.ts` (a jsdom polyfill, not Dexie usage).
- **Any component calling `useToast()` needs a `<ToastProvider>` wrapper** —
  imported from `../../src/shared/components`. Used by `authFlow`,
  `cloudDataBootstrap`, `profileSettings`, `ActivityEditModal`, and
  `CalendarPage` tests.
- **`OnboardingOrchestrator` needs `<ToastProvider>` + `<MemoryRouter>` *and*
  hand-placed `data-onboarding-target` DOM nodes.** `tests/auth/authFlow.test.tsx`
  renders stub divs for `header-shell`, `command-bar`, `quick-actions`,
  `nav-calendar`, `nav-tracker`, `nav-settings` — which is why the step-6 target
  bug above is invisible in tests but real in the app.
- **Icon-picker category headings (e.g. "Study & Education") only render after
  the icon toggle button is clicked.** Asserting on them without the click fails.
