# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

> See also: `AGENT.md` for project identity, constraints, and the current-vs-target architecture split.

## Quick Commands

```bash
# Development
npm run dev

# Quality
npm run build
npm run lint
npm run typecheck
npm run test
npm run test:ui
npm run test:e2e

# Analysis
ANALYZE=true npm run build
```

## Migration Status (2026-07-05)

Project was rebranded PLAN.EX V2 (repo/Vercel project renamed from STEMA/stema to
PLANEX-V2/planex-v2; local folder rename is pending — see below). This file
previously described a target Supabase architecture that the code did not
actually implement: auth and all domain data ran on Firebase (Firestore +
Firebase Auth), silently falling back to per-browser `localStorage` in
production because no Firebase env vars were ever set. That has been fixed:

- `firebase` package removed entirely (client, server, and `api/*` routes).
- Real Supabase project provisioned (`xtkovwztuopzeqpazxur`), full schema in
  `supabase/migrations/` (planner + tracker + learn/AI, all RLS-protected).
- `authStore.ts` now uses real Supabase Auth (`supabase.auth.signInWithOAuth`),
  not the previous Firebase Auth / always-logged-in mock user.
- `src/lib/cloud/supabaseRepo.ts` replaces the old Firestore-backed
  `firestoreRepo.ts` for planner/tracker/settings cloud sync.
- `api/chat.ts`, `api/feynman.ts`, `api/documents/ingest.ts` use
  `api/lib/supabaseEdge.ts` (service-role client + verified-JWT user lookup)
  instead of the old unverified-JWT Firebase edge client.
- RAG search uses a real pgvector `match_document_chunks` RPC instead of
  fetching all chunks and computing cosine similarity in JS.
- Google/GitHub OAuth providers still need to be enabled with real
  credentials in the Supabase dashboard before login will work end-to-end.
- Local folder is still named `STEMA` on disk (rename blocked by another
  process holding a lock on it) even though the repo/Vercel project are
  `PLANEX-V2`/`planex-v2` — rename it manually once nothing else has it open.

Do not trust the "hybrid Dexie/Supabase" framing below as aspirational —
domain data (planner/tracker) is still genuinely Dexie-first with Supabase as
the sync target, exactly as described. What changed is that the Supabase side
of that sync is now real, not silently broken.

## Product Snapshot

PLAN.EX is in a hybrid SaaS transition. The current product shape is:

- Public landing at `/`
- Public landing using a single hero OAuth entry surface, solid low-glow panels, and a professional footer sign-off
- Supabase OAuth with Google and GitHub
- Callback processing at `/auth/callback`
- Canonical profile completion route at `/auth/profile-completion`
- Legacy compatibility alias at `/auth/profile-setup`
- Public and protected route layers split in `App.tsx`
- `AppLayout` running only as the authenticated app shell
- Pre-render auth bootstrap via `ensureInitialAuthBootstrap()`
- In-product onboarding overlay after first successful profile completion
- Profile settings page with avatar upload and onboarding restart
- Cloud bootstrap that can seed remote defaults, hydrate local cache, or import local data
- Remote runtime tables added for settings, pomodoro configs, rules, reminders, and completion records
- Reminder scheduling wired via `useReminderScheduler` hook in AppLayout — loads enabled reminders and schedules browser notifications
- Tracker activity modal with localized icon picker and template-driven quick start
- Planner course/task/personal task/habit modals now support persisted Lucide icon selection, with success toasts only after awaited mutation success
- Planner and tracker domain queries still mostly Dexie-backed today
- Visual & Design Overhaul (9-phase) completed: near-zero shadow tokens, flat cards, `rounded-lg` buttons, standard-easing-only motion, neutral icon containers, spacious h-14 header, spring easing removed
- i18n completeness audit done: HabitDetailPage, GlobalSearchBoxes, ExternalSearchButtons, ErrorBoundary, Modal close buttons all localized; App.tsx cross-namespace t() calls fixed
- Test suite: 343 tests passing (37 files) — includes CRUD smoke, auth integration, RLS smoke, avatar upload, and Modal i18n tests
- Session re-validation (2026-03-14): `npm run typecheck`, `npm run test -- --run tests/rls/rlsSmoke.test.ts`, and `npm run build` all passed; user confirmed PROD-2 dashboard configuration is completed.

Important:

- `TASKS.md` describes the target end state.
- `PROGRESS.md` describes how far the repo has actually moved toward that target.
- The codebase is still hybrid today.
- Do not describe the current system as fully migrated away from Dexie unless you actually complete that migration.

## Source of Truth

Use these files in order:

1. `PROGRESS.md`
   Current implementation progress vs target.
2. `TASKS.md`
   Product target, UX rules, migration direction.
3. `ARCHITECTURE.md`
   Full system map: components, data flow, folder responsibilities, dependency rules, and where to make changes.
4. `src/app/App.tsx`
   Current routing and shell truth.
5. `src/modules/auth/store/authStore.ts`
   Current auth, profile, onboarding, and preference-sync behavior.
6. `src/app/providers/CloudDataBootstrap.tsx`
   Current cloud bootstrap and migration prompt behavior.
7. `src/lib/cloud/domainSync.ts`
   Current sync, hydrate, owner-mismatch, and cloud-first behavior.

## Project Structure

```text
src/
├── app/                    # App shell, router, providers
│   ├── App.tsx             # Public and protected route trees
│   ├── layouts/            # AppLayout
│   └── providers/          # Theme, i18n sync, profile sync, cloud bootstrap
├── modules/
│   ├── auth/               # Landing, callback, profile setup, onboarding
│   ├── planner/            # Planner module
│   ├── tracker/            # Time tracking module
│   └── settings/           # Settings and profile settings
├── db/                     # Dexie-based local data layer
├── i18n/                   # Translation files and provider
├── shared/                 # Shared components, hooks, utils
└── index.css               # Design tokens and base styling
```

## Architecture Overview

### 1. Public and protected surfaces

- `/` is the public landing page.
- `/auth/callback` handles OAuth return flow.
- `/auth/profile-completion` is the canonical profile-completion route.
- `/auth/profile-setup` remains as a compatibility alias.
- `ProtectedRoute` and `AuthGuard` gate all planner/tracker/settings routes.
- `PublicLandingRedirect` sends authenticated users either to profile setup or `/planner`.

### 2. Auth and profile state

- Supabase Auth is the active identity layer.
- Supported providers: `google`, `github`.
- Auth bootstrap is resolved before first render in `main.tsx`.
- `profiles` is the active remote model for:
  - required profile fields
  - onboarding completion
  - preferred locale
  - preferred theme
  - avatar URL
- Theme and locale changes sync back to the profile when the user is authenticated, but explicit in-session choices must not be overwritten by stale profile hydration.

### 3. Data flow today: hybrid

- Planner and tracker domain records still run through Dexie local databases and query helpers.
- `PlannerDatabase` backs planner data.
- `LifeFlowDB` backs tracker data.
- `settingsStore` now has a remote-first path for settings and pomodoro defaults, but runtime consumers still read local cache in several places.
- `CloudDataBootstrap` can:
  - seed remote defaults for a new authenticated user
  - restore cloud data into local cache
  - prompt the user to import local data to cloud
  - clear local cache on owner mismatch
- Conflict policy is cloud-first.
- `domainSync.ts` provides correctness for the hybrid layer: summary, hydration, migration, and cache clearing. The dead `syncDomainTables` no-op has been removed.

### 4. Migration direction

The target architecture in `TASKS.md` is full user-scoped Supabase data. That is not complete yet. When touching documentation, code comments, or developer guidance:

- call the current system hybrid
- call the intended future system Supabase-first or full Supabase
- do not collapse the distinction

## Current Routes

```text
/                      public landing
/auth/callback         OAuth callback
/auth/profile-completion canonical profile completion
/auth/profile-setup    legacy compatibility alias
/planner               dashboard
/planner/courses       courses
/planner/courses/:id   course detail
/planner/tasks         personal tasks
/planner/statistics    planner statistics
/calendar              calendar
/habits                habits dashboard
/habits/:habitId       habit detail
/tracker               tracker
/tracker/records       records
/tracker/stats         tracker statistics
/tracker/goals         goals
/tracker/activities    activities
/tracker/categories    categories
/settings              settings
/settings/profile      profile settings
```

Legacy redirects still exist for:

- `/tasks` -> `/planner/tasks`
- `/statistics` -> `/planner/statistics`

## Environment Notes

- Vite dev server runs on `http://localhost:3000`.
- If you use Supabase locally, make sure allowed origins and callback URLs match `http://localhost:3000/auth/callback`.
- If `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing, the landing page still renders but auth actions are disabled.
- `VITE_ENABLE_SYNC=true` enables local-to-cloud bootstrap behavior.
- `VITE_ENABLE_GOOGLE_AUTH=false` or `VITE_ENABLE_GITHUB_AUTH=false` disables a provider.

## Hard Rules

### Auth and landing

1. Keep Google and GitHub as equal-weight providers unless explicitly asked otherwise.
2. Do not add email/password flows without user approval.
3. Keep theme and language controls visible on landing and profile-setup surfaces.
4. Keep the header theme toggle icon-only and binary for quick light/dark override; leave the `system` option to Settings.
5. Public landing stays text-and-card driven; do not turn it into a screenshot-heavy marketing page.
6. Keep landing to one primary OAuth entry surface; do not reintroduce a duplicate final CTA block unless explicitly asked.

### Profile and onboarding

1. Required profile fields are `full_name`, `occupation`, and `student_status`.
2. `school` and `department` only appear when `student_status` is `student` or `both`.
3. Avatar upload is optional and available later in `/settings/profile`.
4. Onboarding remains an overlay, not a standalone page.
5. Keep visible `skip`, keyboard control, reduced-motion support, and safe fallback for missing targets.

### Data layer

1. `PlannerDatabase` and `LifeFlowDB` are still active. Do not document them away.
2. Existing Dexie component queries should continue to use `useLiveQuery`.
3. Do not persist domain business data in Zustand.
4. Keep cloud-first conflict handling and local owner isolation intact.
5. Any new cloud table or sync flow must assume user-scoped rows and RLS.

### TypeScript and imports

1. Strict mode is expected. Avoid `any`.
2. Use `@/` imports for `src/` paths.
3. Keep auth/profile types aligned with the remote profile model.

### i18n and accessibility

1. All user-facing strings go through i18n.
2. Update both `tr` and `en`.
3. Auth/public/onboarding copy usually lives in the `auth` namespace.
4. Preserve accessible announcements for route changes and onboarding state changes.

## Ask for Approval Before Changes

Get user confirmation before:

- modifying `src/db/**`
- changing route structure
- adding or reshaping Zustand stores
- modifying `tailwind.config.js` or `src/index.css`
- deleting existing pages

## Testing Notes

- Tests use `fake-indexeddb` for Dexie-backed flows.
- Test files live under `tests/**/*.test.ts(x)`.
- When changing auth flows, prefer covering:
  - callback -> profile setup -> planner redirect
  - onboarding fallback behavior
  - profile form validation
  - provider disabled/error states

## Common Workflow

1. Read `TASKS.md` for target intent.
2. Read `App.tsx`, `authStore.ts`, and `CloudDataBootstrap.tsx` for current truth.
3. Decide whether the task is current-state maintenance or migration work.
4. Keep docs and implementation honest about that distinction.
5. Run `npm run typecheck` and relevant tests when behavior changes.
