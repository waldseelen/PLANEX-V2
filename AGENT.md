# AGENT.md - Project Identity, Constraints, and Migration Reality

This file holds two different things open at once for PLAN.EX V2:

1. The target architecture defined in `TASKS.md`
2. How the codebase actually behaves today

Don't lose this distinction. See `PRODUCT_DIRECTION.md` for the agreed
priority order (solidify the primary planner/tracker core first, then build
the planner<->learn integration bridge, then focus STEM on a single loop).
This file is the single agent guide for the repo.

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

## Project Identity

| Field | Value |
| --- | --- |
| Project name | PLAN.EX V2 (repo/Vercel: PLANEX-V2 / planex-v2, codename STEMA) |
| Slogan | Plan. Execute. Be Expert. |
| Type | Public landing + Supabase auth + protected productivity app + STEM AI learning layer |
| Status | Auth, planner/tracker cloud sync, and the learn/AI backend are now genuinely wired to Supabase (before 2026-07-05 they silently fell back to Firestore/localStorage). Google/GitHub OAuth providers still need to be enabled in the Supabase dashboard. |
| Last session note (2026-07-05) | Firebase removed entirely (package + code). New Supabase project (`xtkovwztuopzeqpazxur`) created, full schema + RLS applied, authStore/plannerRepo/trackerRepo/api edge functions moved to Supabase, deployed to Vercel (`planex-v2.vercel.app`). |
| Location | `C:\Users\HP\DEV\PLANEX-V2` (folder renamed from STEMA to match the repo/Vercel project) |
| Dev server | `http://localhost:3000` |
| Main stack | React 18, TypeScript 5.7, Vite 6, Tailwind 3, Framer Motion 12, Supabase, Dexie, Zustand |

## Project Structure

```text
src/
├── app/                    # App shell, router, providers
│   ├── App.tsx             # Public and protected route tree
│   ├── layouts/            # AppLayout
│   └── providers/          # Theme, i18n sync, profile sync, cloud bootstrap
├── modules/
│   ├── auth/               # Landing, callback, profile setup, onboarding
│   ├── planner/            # Planner module
│   ├── tracker/            # Time tracking module
│   ├── learn/              # STEM AI learning module (Socratic chat, Feynman, FSRS, whiteboard, mindmap)
│   └── settings/           # Settings and profile settings
├── db/                     # Dexie-based local data layer
├── i18n/                   # Translation files and provider
├── shared/                 # Shared components, hooks, utils
└── index.css               # Design tokens and base styling
```

## Source Priority

Follow this order:

1. `PROGRESS.md`
   Where things actually stand today relative to the target.
2. `TASKS.md`
   Target product and target architecture document. Some phase checkmarks
   in it predate the 2026-07-05 migration and were aspirational rather than
   real — cross-check against the code before trusting a "done" mark.
3. `src/app/App.tsx`
   Current route and shell reality.
4. `src/modules/auth/store/authStore.ts`
   Current auth, profile completion, onboarding, and preference-sync reality
   — now backed by real Supabase Auth, not Firebase.
5. `src/app/providers/CloudDataBootstrap.tsx`
   Current local-to-cloud bootstrap behavior.
6. `src/lib/cloud/domainSync.ts`
   Current sync/hydration and cloud-first conflict logic.

Rule:

- Don't document the target as "done."
- Don't describe today's implementation as "fully migrated" unless it is.
- Always draw a clear line between current state and target state.

## Today's Implementation Status

As of 2026-07-05:

- Public landing at `/`
- Single OAuth CTA surface on the landing hero, quiet premium OAuth buttons, solid panel language, footer sign-off
- Google and GitHub OAuth, now backed by real Supabase Auth (`supabase.auth.signInWithOAuth`) — the previous Firebase Auth / always-logged-in mock user is gone
- `/auth/callback` callback processing
- Canonical `/auth/profile-completion` and compatibility alias `/auth/profile-setup`
- Auth bootstrap before render, via a real `supabase.auth.getSession()` call
- Public and protected route layers in `App.tsx`
- `AppLayout` as the authenticated-only shell
- `/settings/profile` profile editing and avatar upload (now via Supabase Storage, not Firebase Storage)
- 8-step onboarding overlay on `/planner`
- Auth state screens: initial loading, redirect pending, profile loading, bootstrap loading
- Theme and locale preferences sync to profile; explicit user choice isn't overwritten by profile hydration afterward
- Cloud bootstrap/import prompt when local data exists
- Remote default seed flow for newly authenticated users
- Remote runtime table foundation for settings and pomodoro
- Localized Lucide icon catalog, icon search, and template-start flow in the tracker activity modal
- Persisted Lucide icon selection for course/task/personal-task/habit planner modals; await-based success/error toast hardening on create/update/delete flows

Still hybrid:

- Planner and tracker domain records still run through Dexie local databases (`PlannerDatabase`, `LifeFlowDB`); the cloud side of that sync (`plannerRepo.ts` / `trackerRepo.ts` via `supabaseRepo.ts`) is now genuinely Supabase, not Firestore or a silent localStorage fallback.
- `CloudDataBootstrap.tsx` manages this hybrid flow.
- `domainSync.ts` provides `hydrateLocalCacheFromCloud`, `getDomainSyncSummary`, and `clearLocalDomainCaches`.
- The full "Supabase as sole source of truth" architecture in `TASKS.md` is the target; the repo/service layer now points at a real backend, but the Dexie-first UI read pattern hasn't been removed.
- The `learn` module's `concepts`/`learn_sessions` are not yet linked to planner's `courses`/`units` — see `PRODUCT_DIRECTION.md` for why this is the next planned integration step, after the primary core is solidified.

## Architecture Decisions

### 1. Public surface

- `/` is the landing screen now; the old "goes straight to planner" assumption no longer applies.
- Landing should be text + feature-card driven, not screenshot-heavy.
- Theme and language controls stay visible in the hero.
- The header theme toggle doesn't expose system/light/dark labels; it behaves as an icon-only binary light/dark override. The `system` option stays in settings.
- Google and GitHub CTAs must be shown with equal hierarchy.

### 2. Auth and profile

- Auth providers are only `google` and `github`.
- Don't add an email/password flow; don't expand it without an explicit request.
- `full_name`, `occupation`, `student_status` are the core required profile fields.
- If `student_status` is `student` or `both`, `school` and `department` become required.
- Avatar upload isn't required; the provider avatar can be previewed and the user can change it later.

### 3. Onboarding

- Onboarding is an in-product overlay, not a standalone page.
- The target flow is 8 steps.
- `skip` must stay visible and accessible.
- Must be restartable from settings.
- Needs a safe fallback if the target element isn't found.
- On route change, the flow must close safely or continue at the correct target.

### 4. Data layer

- Supabase is the primary source for auth/profile.
- Remote runtime tables exist for settings and pomodoro default bootstrap.
- Planner and tracker query layer runs through `plannerRepo` + `trackerRepo`, which are genuinely Supabase-backed now (previously they silently fell back to Firestore or per-browser localStorage).
- Tracker service layer (`timerService`, `ruleEngine`, `suggestionEngine`, `exportService`) is Supabase-first.
- `trackerRepo.ts` also contains Rule and Reminder CRUD functions.
- All query files (`src/db/**/queries/**`) use `useSupabaseQuery` + repo functions; `useLiveQuery` and `syncDomainTables` were removed.
- Cloud sync conflict policy is cloud-first.
- Preserve local cache ownership logic; a user switch must not mix in the previous owner's data.
- Any new cloud table design must keep `user_id` and RLS in mind from the start.
- `PlannerDatabase` and `LifeFlowDB` Dexie schemas are still active; used for cloud bootstrap hydration.

## Hard Rules

### Auth and routing rules

1. `/` stays the public landing.
2. Protected routes never render without auth.
3. If the profile is incomplete, the user isn't left in the protected shell; they go to the profile flow.
4. When adding a new state to an auth surface, give the user a short explanatory line too; a spinner alone isn't enough.

### Data rules

1. Keep the distinction between `LifeFlowDB` and `PlannerDatabase`; both are still active for cloud bootstrap.
2. Use `plannerRepo` or `trackerRepo` for domain query mutations; don't write directly to Dexie.
3. Use `invalidateTables([...])` for reactivity after a mutation.
4. Don't move persistent domain data into Zustand.
5. Don't change the cloud-first conflict logic in sync/import behavior.
6. Don't make a change that would cause cross-user local cache mixing.

### UI/UX rules

1. Public landing doesn't use screenshots; stays text + feature-card driven.
2. OAuth buttons are `rounded-lg` (0.5rem), equal hierarchy, quiet premium fill.
3. Card/modal/sidebar background: monochrome tokens only (`bg-surface-100/200/300`). Accent-tinted card backgrounds are forbidden.
4. Icon containers: `bg-surface-200 text-text-secondary`. Accent-tinted decorative icon backgrounds are forbidden.
5. Shadow: near-zero — only `var(--shadow-card)` (1px ring) or `var(--shadow-card-elevated)` (2px+8px). `shadow-card-elevated` only on floating panels.
6. Motion: page transition ~180-200ms fade+slide (y:4px), modal entry 0.18s standard easing. Spring/overshoot (`[0.34, 1.56, 0.64, 1]`) is forbidden. Central config is `src/config/motion.ts`; `easing.spring` was removed.
7. H1/H2 weight: 800/700, letter-spacing: -0.03em/-0.025em. Body line-height: 1.6.
8. `reduced-motion` is supported across all animations.
9. Buttons: `rounded-lg`, active state `scale(0.985)`, hover `-translateY(1px)`.
10. Onboarding panel: flat border, neutral icon/selection card, standard easing.
11. Public landing, profile setup, and onboarding must be as usable on mobile as on desktop.

### i18n rules

1. All new user-facing text goes through i18n.
2. `tr` and `en` locale files are updated together.
3. Check the `auth` namespace first for auth/public/onboarding changes.

## Changes That Need Approval

Get user confirmation before:

- Schema, migration, or type changes under `src/db/**`
- Changing the route structure
- Adding a new Zustand store or substantially changing a store's contract
- Changing `tailwind.config.js` or `src/index.css`
- Deleting existing page components

## Current Route Map

```text
/                      -> Public landing
/auth/callback         -> OAuth callback
/auth/profile-completion -> Canonical profile completion
/auth/profile-setup    -> Legacy compatibility alias
/planner               -> Planner dashboard
/planner/courses       -> Courses
/planner/courses/:id   -> Course detail
/planner/tasks         -> Personal tasks
/planner/statistics    -> Planner statistics
/calendar              -> Calendar
/habits                -> Habits dashboard
/habits/:habitId       -> Habit detail
/tracker               -> Tracker
/tracker/records       -> Tracker records
/tracker/stats         -> Tracker stats
/tracker/goals         -> Goals
/tracker/activities    -> Activities
/tracker/categories    -> Categories
/learn                 -> STEM AI learning workspace
/settings              -> Settings
/settings/profile      -> Profile settings
```

## Environment Notes

- Vite dev server runs on `http://localhost:3000`.
- Supabase callback and allowed-origin settings must match: `http://localhost:3000/auth/callback`.
- If `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing, the landing page still renders but auth actions are disabled.
- `VITE_ENABLE_SYNC=true` enables local-to-cloud bootstrap behavior.
- `VITE_ENABLE_GOOGLE_AUTH=false` or `VITE_ENABLE_GITHUB_AUTH=false` disables a provider.
- `SUPABASE_SERVICE_ROLE_KEY` is required for `api/chat.ts`, `api/feynman.ts`, and `api/documents/ingest.ts` to write server-side; never expose it with a `VITE_` prefix.

## Testing Notes

- Dexie-backed tests use `fake-indexeddb`.
- Test files live under `tests/**/*.test.ts(x)`.
- Priority coverage for auth flows:
  - callback -> profile setup -> planner redirect
  - onboarding fallback behavior
  - profile form validation
  - provider disabled and error states

## Working Flow

1. Read `TASKS.md` first for target product intent, and `PRODUCT_DIRECTION.md` for the agreed priority order.
2. Verify current reality against `src/app/App.tsx`, `src/modules/auth/store/authStore.ts`, and `src/app/providers/CloudDataBootstrap.tsx`.
3. Decide whether the task is maintaining the current system or doing migration work.
4. Keep the gap between current state and target state explicit in both docs and code.
5. Run at least `npm run typecheck` and relevant tests on any behavior change.

## Priority Roadmap

See `PRODUCT_DIRECTION.md` for the current agreed sequencing. Summary:

1. **Solidify the primary core (planner/tracker).** See `feature_quality_report.md` for known concrete issues (modal duplication, a 901-line God Component in `RightPanel.tsx`, dead Zustand modal state, inconsistent folder organization between planner and tracker).
2. **Build the planner <-> learn integration bridge.** Link `concepts`/`learn_sessions` to `courses`/`units`; add a "study this topic" entry point from a planner unit into `/learn`.
3. **Focus STEM on one loop.** Socratic chat + mistake analysis + FSRS spaced repetition. Whiteboard, mindmap/React Flow, CS sandbox, exam generator, and INCUP (ADHD) adaptations are deliberately deferred.

## References

- `README.md`: user/contributor-facing overview
- `TASKS.md`: target SaaS architecture and product behavior
- `PRODUCT_DIRECTION.md`: agreed priority order and why
- `CLAUDE.md`: Claude Code-focused development instructions
- `ARCHITECTURE.md`: full map of system components, data flow, folder responsibilities, and where to change what
- `feature_quality_report.md`: known tech-debt in the planner/tracker UI layer
