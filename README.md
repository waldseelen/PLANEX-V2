# PLAN.EX V2

**Plan. Execute. Be Expert.**

PLAN.EX is a React + TypeScript app built to bring a student's coursework and
personal workflow together in one place. On top of that planner/tracker
core, a second layer — the **STEMA** AI learning workspace (Socratic tutor,
Feynman referee, FSRS spaced repetition, whiteboard, RAG over uploaded
notes) — is integrated at `/learn`.

See [`PRODUCT_DIRECTION.md`](PRODUCT_DIRECTION.md) for how these two layers
relate and what's prioritized next.

## Current Status

<!-- Dated status, gate results, and session history live in PROGRESS.md, which
     owns them. Keep this section to durable orientation only. -->


- Public landing at `/`
- Google and GitHub OAuth login, backed by real Supabase Auth
- `/auth/callback` callback flow
- `/auth/profile-setup` required profile completion
- 8-step product-level onboarding overlay inside `/planner`
- `/settings/profile` profile editing, avatar upload, and onboarding restart
- Protected route structure for planner, calendar, habits, statistics, tracker, learn, and settings
- Supabase-based local-to-cloud bootstrap and cloud-first conflict logic
- `/learn`: Socratic chat, Feynman evaluation, FSRS flashcard review, whiteboard, mindmaps, and RAG over uploaded documents (all backed by Supabase + pgvector, via `api/chat.ts`, `api/feynman.ts`, `api/documents/ingest.ts`)

Important:

- `TASKS.md` describes a target architecture and predates two backend migrations; cross-check its "done" marks against the code.
- Domain data now runs entirely on Supabase. There is no Dexie/IndexedDB layer. What is still unfinished is the local-cache bootstrap layer, whose stubs make parts of `CloudDataBootstrap` unreachable (see `ARCHITECTURE.md` section 7).
- What changed on 2026-07-05: that sync target, and all of `/learn`'s backend, are now genuinely Supabase — previously they silently ran on Firebase, or fell back to per-browser `localStorage` when Firebase wasn't configured (which it never was in production). Firebase has been removed entirely from the codebase.
- Google/GitHub OAuth providers and `SUPABASE_SERVICE_ROLE_KEY` still need to be configured in the Supabase dashboard / Vercel project for the deployed app to fully work end-to-end.

## Tech Stack

- React 19
- TypeScript 7
- Vite 8
- Tailwind CSS 4
- Framer Motion 12
- Supabase Auth / Database / Storage (with pgvector for RAG)
- Zustand (UI state only — domain data lives in Supabase)
- Vercel Edge Functions (`api/*`) for the AI/learn backend, via OpenRouter
- Vitest
- Playwright

## Architecture Overview

### Auth and user identity

- Supabase Auth is the login layer.
- Active providers are only `google` and `github`.
- Profile data lives in the `profiles` table.
- Profile model covers `full_name`, `occupation`, `student_status`, `school`, `department`, `grade`, `avatar_url`, `preferred_locale`, `preferred_theme`, `profile_completed`, and `onboarding_completed`.
- Theme and language preferences sync back to the profile after login.

### Domain data layer

- Planner and tracker modules read through the `useSupabaseQuery` hook and mutate through `plannerRepo` / `trackerRepo`, which talk to Supabase via `supabaseRepo.ts`.
- There is no local domain database. `src/db/` is a legacy folder name holding domain types and Supabase-backed query modules; its `database.ts` files are empty stubs.
- `CloudDataBootstrap` seeds remote defaults for a newly authenticated user. Its local-data import and cache-clear paths are currently unreachable — see `ARCHITECTURE.md` section 7.
- Conflict policy is cloud-first.

### Learn / STEM AI data layer

- `concepts`, `concept_mastery`, `learn_sessions`, `learn_messages`, `tutor_events`, `error_logs`, `sr_cards`, `documents`, `document_chunks`, and `mindmaps` all live in Supabase, RLS-protected per user.
- Not yet linked to planner's `courses`/`units` — see `PRODUCT_DIRECTION.md` for the planned integration bridge.
- Server-side AI calls (`api/chat.ts`, `api/feynman.ts`, `api/documents/ingest.ts`) use a service-role Supabase client (`api/lib/supabaseEdge.ts`) that verifies the bearer token against Supabase Auth rather than trusting a client-decoded JWT.

### UX surfaces

- Public landing, profile setup screen, and the protected app shell share one design language.
- Theme and language controls stay visible in the landing's first viewport.
- Onboarding is an in-product guidance layer, not a standalone page.
- Auth surfaces support reduced-motion and screen-reader behavior.

## Getting Started

### Requirements

- Node.js 18+
- npm
- A Supabase project (for OAuth, domain data, and the learn/AI backend)
- An OpenRouter API key (for the learn/AI features)

### Setup

```bash
npm install
```

Copy `.env.example` to `.env.local` and fill it in. At minimum for local development, set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ALLOWED_AUTH_ORIGINS`
- `SUPABASE_SERVICE_ROLE_KEY` (needed for `/learn` chat/feynman/document-upload features to persist anything)
- `OPENROUTER_API_KEY` (needed for `/learn` AI features to respond at all)

Then apply the database schema (see `supabase/migrations/`) to your Supabase project, either via the Supabase Dashboard SQL editor or `supabase db push` after `supabase link`.

Then:

```bash
npm run dev
```

Default development address: `http://localhost:3000`

For Supabase OAuth locally, use these origin/callback values:

- Allowed origin: `http://localhost:3000`
- Callback URL: `http://localhost:3000/auth/callback`

Notes:

- Update the callback/origin values in `.env.example` to match your own environment.
- If Supabase env vars are missing, the landing page still renders, but OAuth actions stay disabled.
- Google and GitHub OAuth providers must be enabled with real credentials in the Supabase dashboard before login works end-to-end — a fresh Supabase project has neither enabled by default.

## Environment Variables

| Key | Required | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (for `/learn`) | Server-side key for `api/chat.ts`/`api/feynman.ts`/`api/documents/ingest.ts`; never expose with a `VITE_` prefix |
| `OPENROUTER_API_KEY` | Yes (for `/learn`) | Model calls for Socratic chat, Feynman, mindmap, and OCR |
| `VITE_ALLOWED_AUTH_ORIGINS` | Recommended | OAuth callback origin allowlist |
| `VITE_ENABLE_SYNC` | Unused | Present in `.env.example` but referenced nowhere in `src/` or `api/`. Setting it has no effect. |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Optional | Future payment surfaces |
| `VITE_ENABLE_GOOGLE_AUTH` | Optional | Set `false` to disable the Google provider |
| `VITE_ENABLE_GITHUB_AUTH` | Optional | Set `false` to disable the GitHub provider |

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Starts the development server |
| `npm run build` | TypeScript build + Vite production build |
| `npm run preview` | Preview of the production build |
| `npm run lint` | Runs ESLint |
| `npm run typecheck` | TypeScript `noEmit` check |
| `npm run test` | Vitest tests |
| `npm run test:ui` | Vitest UI |
| `npm run test:e2e` | Playwright E2E tests |
| `ANALYZE=true npm run build` | Produces a bundle analyzer report |

## Route Map

| Route | Description |
| --- | --- |
| `/` | Public landing + OAuth CTAs |
| `/auth/callback` | OAuth callback page |
| `/auth/profile-setup` | First-login profile completion |
| `/planner` | Planner home |
| `/planner/courses` | Course list |
| `/planner/courses/:courseId` | Course detail |
| `/planner/tasks` | Personal tasks |
| `/planner/statistics` | Planner statistics |
| `/habits` | Habits dashboard |
| `/habits/:habitId` | Habit detail |
| `/tracker` | Tracker home |
| `/tracker/records` | Tracker records |
| `/tracker/stats` | Tracker statistics |
| `/tracker/goals` | Goals |
| `/tracker/activities` | Activities |
| `/tracker/categories` | Categories |
| `/learn` | STEM AI learning workspace (Socratic chat, Feynman, FSRS, whiteboard, documents) |
| `/settings` | General settings |
| `/settings/profile` | Profile settings |

Legacy redirects (not pages):

- `/calendar` -> `/planner/tasks` — calendar is a view tab inside the planner tasks page, not its own route
- `/tasks` -> `/planner/tasks`
- `/statistics` -> `/planner/statistics`

## Folder Overview

```text
src/
├── app/                 # Router, layout, providers
├── modules/
│   ├── auth/            # Landing, callback, profile setup, onboarding, auth store
│   ├── planner/         # Planner module
│   ├── tracker/         # Time tracking module
│   ├── learn/           # STEM AI learning workspace
│   └── settings/        # Settings + profile settings
├── db/                  # Domain types + Supabase-backed query modules (legacy name)
├── lib/cloud/           # Supabase-backed repo layer (supabaseRepo, plannerRepo, trackerRepo)
├── i18n/                # TR / EN locale files
├── shared/              # Shared components, hooks, utils
└── index.css            # Design tokens and base styles
api/                     # Vercel edge functions for the learn/AI backend (chat, feynman, ocr, mindmap, documents/ingest)
supabase/migrations/     # Full Postgres schema + RLS for this project
```

## Quality and Verification

Recommended minimum check:

```bash
npm run typecheck
npm run test
npm run build
```

Before running `npm run lint` repo-wide, check whether existing warnings and
older tech debt are clean; since the project is mid-transition, a fully
clean lint result isn't guaranteed on every branch. See
`feature_quality_report.md` for known planner/tracker UI-layer tech debt.

## Other Documents

- `PRODUCT_DIRECTION.md`: agreed product priority order and why
- `TASKS.md`: target SaaS architecture and product flow (some phase checkmarks predate the 2026-07-05 migration and should be cross-checked against the code)
- `PROGRESS.md`: session-by-session progress log, including the 2026-07-05 correction notice
- `ARCHITECTURE.md`: full system map — components, data flow, folder responsibilities, and where to change what
- `AGENT.md`: project identity, architecture reality, and constraints
- `CLAUDE.md`: Claude Code-focused repo guide
- `feature_quality_report.md`: known tech debt in the planner/tracker UI layer

## Deployment

- Framework: Vite (frontend) + Vercel Edge Functions (`api/*`)
- Build command: `npm run build`
- Output directory: `dist`
- Target platform: Vercel
- Repo: `waldseelen/PLANEX-V2` · Vercel project: `planex-v2` (`https://planex-v2.vercel.app`)

PWA structure and static asset optimizations are defined in `vite.config.ts`.
