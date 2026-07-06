# ARCHITECTURE.md — PLAN.EX V2 & STEMA System Skeleton

This file reflects PLAN.EX's architecture skeleton and data flow after moving
off Firebase onto a real Supabase backend, with the **STEMA** AI learning
workspace integrated on top. See `PRODUCT_DIRECTION.md` for why the planner/
tracker core is being solidified before the STEM/planner integration bridge
described in section 6 gets built.

---

## 1. High-Level System Map

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                                BROWSER / CLIENT                                   │
│                                                                                   │
│  ┌────────────────┐   ┌────────────────────────────────────────────────────────┐  │
│  │  Public Layer  │   │                Protected App Shell                     │  │
│  │ (unauthenticated)│  │   AppLayout + Sidebar + Header                         │  │
│  │                │   │                                                        │  │
│  │  /             │   │   /planner, /tracker, /habits, /calendar, /settings,   │  │
│  │  /auth/*       │   │   /learn (unified Socratic & Feynman workspace)        │  │
│  │  └────────────────┘   └───────────┬────────────────────────────────────────────┘  │
│          │                           │                                            │
│          ▼                           ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │                            Data Layer (Hybrid)                              │  │
│  │                                                                             │  │
│  │   Auth + sync target: Supabase (Auth, RLS, domain & STEMA data)             │  │
│  │   Primary UI reads/writes today: Dexie (planner/tracker local-first cache) │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────────┘
```

Note: this is honestly a **hybrid** shape, not "Supabase-first" — planner and
tracker UI components still read/write Dexie directly via `useLiveQuery`;
Supabase is the sync target that `CloudDataBootstrap` and the repo layer
(`plannerRepo.ts`/`trackerRepo.ts`) push to and hydrate from. What changed on
2026-07-05 is that this sync target is now a real Supabase project — before
that, the "cloud" side silently fell back to Firestore or, when unconfigured,
per-browser `localStorage`.

---

## 2. System Components

### 2.1 App Shell (`src/app/`)

| Component | File | Responsibility |
|---|---|---|
| Route tree | `App.tsx` | Splits public and protected route layers. Manages the `/learn` route and its sub-redirects. |
| Authenticated shell | `layouts/AppLayout.tsx` | Sidebar, header, nav — post-login only. |
| Auth bootstrap | `src/modules/auth/store/authStore.ts` (`ensureInitialAuthBootstrap`) | Resolves the Supabase session before first render. |
| Cloud bootstrap | `providers/CloudDataBootstrap.tsx` | Remote defaults seeding, local-to-cloud transfer prompts, and cache clearing. |
| Profile sync | `providers/ProfilePreferencesSync.tsx` | Writes theme/locale changes back to the profile. |
| Theme management | `providers/ThemeProvider.tsx` | Dark/light management via CSS custom properties. Preserves the grayscale aesthetic. |

### 2.2 Auth Module (`src/modules/auth/`)

| Subfolder | Responsibility |
|---|---|
| `pages/` | `PublicLandingPage` (single CTA, minimalist), `AuthCallbackPage`, `ProfileCompletionPage`. |
| `components/` | `AuthGuard`, `ProtectedRoute`, `AuthProviderButtons` (Google/GitHub), `OnboardingOrchestrator` and coachmarks. |
| `store/` | `authStore.ts` — session, profile completion, onboarding steps, and preference sync. Backed by real Supabase Auth (`supabase.auth.signInWithOAuth`/`onAuthStateChange`), not Firebase. |
| `lib/` | OAuth redirects, profile helpers, security schemas, and telemetry. |

### 2.3 Planner Module (`src/modules/planner/`)

| Subfolder | Responsibility |
|---|---|
| `pages/` | Overview, Courses, CourseDetail, PersonalTasks, Habits, HabitDetail, Calendar, Statistics. |
| `store/` | `plannerAppStore.ts` (app state), `plannerUIStore.ts` (UI state). |
| `queries/` | `courseQueries.ts`, `taskQueries.ts`, etc. — use `useLiveQuery` against Dexie, backed by `plannerRepo.ts` for the cloud side. |

### 2.4 Tracker Module (`src/modules/tracker/`)

| Subfolder / file | Responsibility |
|---|---|
| `pages/` | TrackerPage, RecordsPage, StatsPage, GoalsPage, ActivitiesPage, CategoriesPage. |
| `lib/` | `timerService.ts` (start/stop timer), `ruleEngine.ts` (rule checks), `suggestionEngine.ts` (session suggestions), `exportService.ts` (CSV/JSON export). |
| `queries/` | `activityQueries.ts`, `sessionQueries.ts`, etc. |

### 2.5 STEMA Learning Module (`src/modules/learn/`)

| Subfolder / file | Responsibility |
|---|---|
| `pages/LearnChat.tsx` | **Unified workspace:** left panel holds the Socratic, Feynman, or free-mode AI chat stream; right panel holds the interactive Workbench. |
| `pages/MindmapPage.tsx` | Standalone AI-generated mindmap page (React Flow), saved to the `mindmaps` table. |
| `components/Whiteboard.tsx` | **Smart drawing canvas:** lets the user free-draw/draw geometric shapes and also renders plot/graph commands sent by the AI. |
| `components/LatexRenderer.tsx` | **Custom LaTeX & Markdown parser:** renders inline and block KaTeX and basic markdown without heavy external dependencies. |
| `lib/fsrs.ts` | **FSRS card scheduler:** SuperMemo-based algorithm computing a flashcard's next due date, stability, and difficulty. |

Not yet connected: `concepts` and `learn_sessions` have no `course_id`/
`unit_id` link back to the planner's `courses`/`units`. This is the concrete
integration-bridge work described in `PRODUCT_DIRECTION.md`, not yet done.

### 2.6 Cloud Layer (`src/lib/cloud/`)

| File | Responsibility |
|---|---|
| `supabaseRepo.ts` | Low-level generic Supabase CRUD (`listOwnedRows`/`upsertOwnedRow`/`updateOwnedRows`/`deleteOwnedRows`) operating on a runtime table name, plus error handling and RLS-aware `user_id` scoping. Replaces the old Firestore-backed `firestoreRepo.ts`. |
| `plannerRepo.ts` | Course, task, event, and habit database operations specific to the planner domain. |
| `trackerRepo.ts` | Time session, rule, category, and activity database operations specific to the tracker domain. |
| `queryInvalidation.ts` | Pub/sub cache invalidator that notifies subscribed queries when a table changes. |
| `domainSync.ts` | Backward-compat shims and hydrating the local database from cloud data. |

Server-side (`api/lib/supabaseEdge.ts`) is a separate service-role client used
only by `api/chat.ts`, `api/feynman.ts`, and `api/documents/ingest.ts` — it
verifies the bearer token against Supabase Auth (`auth.getUser(token)`)
rather than trusting a client-decoded JWT payload.

---

## 3. Data Flow and Synchronization

### 3.1 Planner / Tracker Data Flow (Dexie-first, Supabase-synced)

UI components read/write Dexie directly through `useLiveQuery`. The repo
layer (`plannerRepo.ts`/`trackerRepo.ts`, via `supabaseRepo.ts`) is what
`CloudDataBootstrap` uses to push local data to Supabase and hydrate local
cache from Supabase — it is not yet the primary path every component reads
through.

```
[React component]
    │ (useLiveQuery against Dexie)
    ▼
[Dexie (PlannerDatabase / LifeFlowDB)]
    ▲
    │ (hydrate / push, via CloudDataBootstrap)
    ▼
[plannerRepo / trackerRepo]
    │ (CRUD via supabaseRepo.ts)
    ▼
[Supabase (Cloud Postgres, RLS-protected)]
```

### 3.2 STEMA Workbench Integration Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AI Chat Flow                                    │
│                                                                        │
│  Student asks a question ──► api/chat.ts calls an OpenRouter model    │
│                                │                                       │
│                                ▼                                       │
│          If the response contains whiteboard commands                 │
│            (e.g. `[WHITEBOARD_DRAW: {type: "plot", fn: "sin(x)"}]`)   │
└────────────────────────────────┬───────────────────────────────────────┘
                                 │ (parsed client-side)
                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       STEMA Workbench (right panel)                    │
│                                                                        │
│  ├─ Whiteboard ──► drawing engine renders shapes/plots onto the canvas │
│  ├─ FSRS review ──► cards generated from mistakes are written to DB    │
│  ├─ Notes/documents ──► uploaded to Supabase `documents` + storage     │
│  └─ Concepts ──► reactively lists updated mastery scores               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Database Table Layout

All tables live in the Supabase project (`supabase/migrations/`) and are
RLS-protected with `auth.uid() = user_id`.

1. `profiles`: user identity, preferences, and avatar info.
2. `courses` & `units`: courses and their curriculum units.
3. `tasks` & `personal_tasks`: course-linked tasks and standalone personal tasks.
4. `events`: calendar events and exams.
5. `habits` & `habit_logs`: habit tracking and daily completion records.
6. `categories` & `activities`: tracker time categories and activities.
7. `time_sessions` & `running_timers`: stopwatch records and active timers.
8. `goals`: time-based targets.
9. `reminders`: in-app reminders.
10. `rules`: tracker automation rules.
11. `completion_records`: completed-task records.
12. `settings` & `pomodoro_configs`: user UI preferences and pomodoro durations.
13. `learn_sessions` & `learn_messages`: STEMA chat sessions and message content.
14. `concepts` & `concept_mastery`: STEM concept graph and per-student mastery scores. Not yet linked to `courses`/`units` — see section 2.5.
15. `error_logs`: classification of mistakes made (procedural, conceptual, etc.).
16. `sr_cards`: FSRS-based spaced-repetition flashcards.
17. `documents` & `document_chunks`: uploaded study material and pgvector embeddings for RAG.
18. `mindmaps`: saved AI-generated mindmaps (React Flow nodes/edges).
19. `tutor_events`: telemetry log for metacognitive behavior tracking.

RAG retrieval uses the `match_document_chunks` Postgres function (pgvector
cosine similarity), not client-side similarity computation.

---

## 5. Folder Responsibilities

```
src/
├── app/             → Route management, main Layout (AppLayout), and providers
├── modules/
│   ├── auth/        → Login screen, callback handler, onboarding overlay
│   ├── planner/     → Course, calendar, task, and habit UI pages
│   ├── tracker/     → Timer, stopwatch, categories, and goals
│   ├── settings/    → Profile settings, password, and avatar upload screen
│   └── learn/       → STEMA workspace, Whiteboard, LatexRenderer, FSRS cards
├── db/              → Dexie database schemas and offline sync helpers
├── lib/
│   ├── cloud/       → supabaseRepo, plannerRepo, trackerRepo, and cache invalidation
│   └── validation/  → Form and data schema validation (Zod)
├── config/          → Lucide icon catalog, default templates, and Supabase client init
├── i18n/            → Translation files (TR / EN) and i18next config
└── shared/          → useSupabaseQuery, LatexRenderer, modal, and other shared components
```

---

## 6. Where To Change What

* **Socratic / Feynman AI behavior rules:** system prompts in `api/chat.ts` or `api/feynman.ts`.
* **Adding a new whiteboard drawing function or plot type:** the parser and canvas drawing methods in `src/modules/learn/components/Whiteboard.tsx`.
* **Tuning FSRS algorithm coefficients and learning delays:** `src/modules/learn/lib/fsrs.ts`.
* **Adding or updating a database CRUD query:** the relevant domain repo (`plannerRepo.ts` or `trackerRepo.ts`).
* **Linking `concepts`/`learn_sessions` to `courses`/`units` (the pending integration bridge):** add `course_id`/`unit_id` columns via a new migration in `supabase/migrations/`, then wire the planner UI entry point.
* **UI theme tokens or Notion/Linear-style aesthetics:** `src/index.css` and `tailwind.config.js`.

---

## 7. Dual-Layer Status

IndexedDB (Dexie) and Supabase both exist in parallel today; **Supabase is
the sync target and durable source of truth for the cloud side, but Dexie is
still what most planner/tracker UI reads from directly.**
* `CloudDataBootstrap` and the repo layer write to Supabase and hydrate Dexie for fast offline reads and bootstrap-time hydration.
* If the user loses connectivity, the system can still read from Dexie, but the primary write target is the cloud API.
* Fully collapsing this into a single Supabase-first read path is a `TASKS.md` target, not done yet — see `PRODUCT_DIRECTION.md` step 1 for why this is intentionally sequenced after auditing the current planner/tracker core.

---

## 8. Test Strategy

* **Unit and component tests:** `tests/planner/*.test.ts` and `tests/tracker/*.test.ts` run under Vitest and React Testing Library with local IndexedDB mocks (`fake-indexeddb`).
* **Security (RLS) tests:** `tests/rls/rlsSmoke.test.ts` checks unauthorized-access behavior.
* **Verification:** TypeScript compile correctness (`npm run typecheck`) and a production build (`npm run build`) are the project-wide integrity gate.
