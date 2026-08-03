# PROGRESS.md — STEMA + PLAN.EX Integration Progress Log

**Reference:** `TASKS.md`, `ARCHITECTURE.md`, `PRODUCT_DIRECTION.md` (repo-root relative;
absolute local paths were removed on 2026-08-03 — they pointed at a machine and a
folder name that no longer exist).

---

## Correction Notice (2026-07-05)

Several "✅ Completed" entries below, written on 2026-06-19, described a
Supabase migration that had **not actually happened** in the code at the
time. In reality:

- `authStore.ts` still ran on Firebase Auth, with the app defaulting to an
  always-logged-in mock user.
- `plannerRepo.ts`/`trackerRepo.ts` still wrote to Firebase Firestore via
  `firestoreRepo.ts`, and silently fell back to per-browser `localStorage`
  when Firebase env vars weren't set (which they never were in production).
- `api/chat.ts`, `api/feynman.ts`, `api/documents/ingest.ts` used an
  unverified-JWT Firebase edge client (`api/lib/firebaseEdge.ts`).
- The claimed 18-table Supabase schema never existed as a migration file —
  there was no `supabase/migrations/` directory at all.

This has now been fixed for real — see "## 5. Session Log (2026-07-05)"
below. The lesson: don't mark a phase "done" in this file until the actual
code has been re-read and verified, not just because a plan said it would be
done. Original entries are kept below unedited (translated) for the
historical record, with this notice as the correction.

---

## 1. Project Story: How It Started, What It Does, Where It's Going

### 🎬 How It Started
The project began as **PLAN.EX**, a personal productivity and planner app
letting students and professionals manage their courses, personal tasks,
habits, and time tracking from one place.
* **Initial infrastructure:** a hybrid setup with **Dexie (IndexedDB)**
  running locally in the browser and a server-side **Firebase**
  integration.
* **Need for change:** given Firebase's complexity, relational query
  limitations, and schema maintainability concerns, Firebase was slated for
  full removal. **Supabase** was chosen as the primary database for its
  data model, security rules, and strong relational foundation.

### 🧠 What Is the STEMA Integration and What Does It Do?
On top of PLAN.EX, an AI-powered STEM learning platform module based on
cognitive and metacognitive measurement — **STEMA (Socratic STEM Learning
Platform)** — was integrated.
STEMA isn't a classic chat interface that just hands out solutions; it is:
1. **Socratic Tutor Mode:** an interactive teacher agent that, instead of
   answering directly, guides the student with 3-tier hints and
   self-explanation questions.
2. **Feynman Referee Mode:** a referee agent that asks the student to
   explain a STEM topic in their own simplified words, evaluates that
   explanation, identifies conceptual gaps and missing terminology, and
   produces memorable mnemonic analogies.
3. **Mistake Intelligence:** an intelligence layer that classifies the
   student's mistakes (conceptual, procedural, attention, strategic) and
   builds a mistake log.
4. **FSRS Spaced Repetition System:** a mechanism that auto-generates
   flashcards from mistake topics and builds a smart study schedule using
   the SuperMemo-based FSRS algorithm.
5. **Dynamic Whiteboard & Agent Drawing:** a vector whiteboard engine that,
   to visualize a verbal or mathematical explanation, processes drawing and
   graph commands (`[WHITEBOARD_DRAW: {...}]`) sent live from the AI chat
   stream.

### 🚀 Where Is It Going?
The project is evolving from a classic task/time manager into a **smart STEM
study companion**. Per `PRODUCT_DIRECTION.md`, the near-term target is not
new STEM features but solidifying the primary planner/tracker core, then
building the bridge that links STEM concepts to planner courses/units, then
focusing STEM itself on a single loop (Socratic chat + mistake analysis +
FSRS) before touching:
* Further RAG integration (already functional via pgvector as of 2026-07-05)
* React Flow knowledge graph
* Sandbox integration for coding/software-development topics

---

## 2. What We Did (as originally logged, 2026-06-19 — see correction notice above)

### 🏗 1. Firebase Cleanup & Supabase Foundations (Phase 0 & Phase 1)
* **Claimed:** Firebase fully removed from `plannerRepo`, `trackerRepo`,
  `settingsStore`, and `authStore`; Supabase client configured; 18-table SQL
  schema + RLS created.
* **Reality found on 2026-07-05:** none of this had actually happened yet.

### 🔄 2. Data Layer Transformation (IndexedDB to "Supabase-First")
* **Claimed:** Planner/Tracker CRUD fully moved off local Dexie writes onto
  Supabase via `plannerRepo.ts`/`trackerRepo.ts`; a `useSupabaseQuery` hook
  replaced Dexie's `useLiveQuery`.
* **Reality found on 2026-07-05:** the repo layer was still Firestore-backed
  with a silent localStorage fallback; `useLiveQuery` against Dexie was
  still the actual UI read path at that time. (That is no longer true — the
  `useLiveQuery` read path was removed at some point after this entry; see
  the 2026-08-03 session log below.)

### 🎓 3. Socratic Engine and Feynman Evaluation System (Phase 5 & Phase 6)
This part was accurate: `api/chat.ts` had real Socratic dialogue prompts
(mastery-aware hint escalation) and `api/feynman.ts` had a real referee
agent returning score/gaps/mnemonic JSON, plus a custom `LatexRenderer`.
What was wrong was only the persistence layer underneath them (Firestore,
not Supabase) — now fixed.

### 🎨 4. Design Refresh and UI Consolidation (Phase 7-8)
This work was real and unaffected by the backend migration: Linear/Notion
aesthetic cleanup, the unified `/learn` workspace (`LearnChat.tsx`) with
whiteboard, FSRS review, document library, and concept mastery panels all
in one screen.

### 🔌 5. LLM Provider Abstraction (Phase 17) — 2026-06-19
This was also real: `api/lib/llmClient.ts` and `api/lib/config.ts` centralize
all OpenRouter-based model calls (`callLLM`, `streamLLM`,
`callLLMWithMultimodal`), with per-task-type model/temperature/pricing
config and a single cost-calculation path.

---

## 3. Original Status Table (kept for history — see correction notice)

| Area | Original claim | Phase / Ref | Actual state as of 2026-07-05 |
| --- | --- | --- | --- |
| Firebase cleanup | ✅ Done | Phase 0 | Was false. Firebase was removed for real on 2026-07-05 (package + all code paths). |
| Supabase schema & RLS | ✅ Done | Phase 1 / ARCH-2 | Was false — no migration file existed. A real schema now exists in `supabase/migrations/` (planner + tracker + learn/AI, all RLS-protected). |
| Data layer migration | ✅ Done | Phase 2 / Phase 5 | Was false on 2026-06-19. Became real on 2026-07-05 for the write path: `plannerRepo`/`trackerRepo` genuinely write to Supabase via `supabaseRepo.ts`. Dexie was still the UI read path *on that date*; it no longer is — see the 2026-08-03 session log. |
| Socratic tutor & LaTeX | ✅ Done | Phase 5 | Accurate; persistence layer under it is now real Supabase instead of Firestore. |
| Feynman referee & scoring | ✅ Done | Phase 6 | Accurate; same persistence fix applies. |
| Mistake intelligence & FSRS cards | ✅ Done | Phase 7 | Accurate; same persistence fix applies. |
| Whiteboard & agent drawing | ✅ Done | Phase 8 / Phase 9 | Accurate, unaffected by backend migration. |
| Unified workspace design | ✅ Done | Phase 8 / UI-UX | Accurate. |
| Dead file cleanup | ✅ Done | Refactor | Accurate. |
| RAG embeddings (pgvector) | ✅ Done | Phase 10 | Was partially false — RAG existed but computed cosine similarity client-side over all chunks fetched from Firestore. Now uses a real `match_document_chunks` pgvector RPC. |
| OCR pipeline (multimodal input) | ✅ Done | Phase 11 | Accurate, unaffected by backend migration. |
| LLM provider abstraction | ✅ Done | Phase 17 | Accurate. |
| React Flow knowledge graph | ⏳ Pending | Phase 8.2 | Still pending — deliberately deferred per `PRODUCT_DIRECTION.md`. |
| Advanced onboarding | ⏳ Pending | Phase 18 | Still pending — deliberately deferred. |
| Mobile & PWA integration | ⏳ Pending | Phase 19 | Still pending — deliberately deferred. |

---

## 4. Original Next Steps (2026-06-19 plan — superseded by PRODUCT_DIRECTION.md)

### 🎯 Wave 1 (originally "high priority")
1. Production deploy & smoke test (Phase 16)
2. Performance optimization & cost management (Phase 15)

### 🌟 Wave 2 (originally "deepening and adaptations")
1. Advanced onboarding & pre-built curriculum (Phase 18)
2. Mobile & PWA integration (Phase 19)
3. Other modules (Phase 12, 13, 14): CS sandbox, exam generator, INCUP (ADHD) adaptations

These are all now explicitly superseded by the sequencing in
`PRODUCT_DIRECTION.md`: solidify the primary planner/tracker core first,
then build the planner↔learn integration bridge, then focus STEM on its
single core loop. Everything in Wave 2 above stays deliberately deferred
until those three are solid.

---

## 5. Session Log (2026-07-05) — Real Supabase Migration

* Audited the actual codebase (not just the docs) and found Firebase Auth +
  Firestore still fully active, with a silent per-browser `localStorage`
  fallback in production since Firebase env vars were never set.
* Removed the `firebase` npm package and every Firebase code path
  (`src/config/firebase.ts`, `api/lib/firebaseEdge.ts`,
  `src/lib/cloud/firestoreRepo.ts`).
* Provisioned a new Supabase project (`xtkovwztuopzeqpazxur`) and applied a
  real schema: `supabase/migrations/20260705000000_init_schema.sql` (planner
  + tracker + learn/AI domains, all tables RLS-protected on
  `auth.uid() = user_id`), plus `avatars` and `documents` storage buckets.
* Rewrote `authStore.ts` to use real Supabase Auth
  (`signInWithOAuth`/`onAuthStateChange`/`getSession`), removing the
  always-logged-in mock user and the `resolveAuthState` test bypass that had
  been hardcoded to always return `'authenticated'`.
* Added `src/lib/cloud/supabaseRepo.ts` (replacing `firestoreRepo.ts`) and
  rewired `plannerRepo.ts`, `trackerRepo.ts`, `settingsStore.ts`,
  `remoteDefaults.ts`, `LearnChat.tsx`, `MindmapPage.tsx`,
  `exportService.ts` to use it.
* Added `api/lib/supabaseEdge.ts` (service-role client + verified-JWT user
  lookup via `auth.getUser(token)`) and rewired `api/chat.ts`,
  `api/feynman.ts`, `api/documents/ingest.ts` to use it instead of the old
  unverified-JWT Firebase edge client.
* Replaced client-side cosine-similarity RAG search with a real
  `match_document_chunks` pgvector RPC.
* Migrated `LearnChat.tsx`'s document upload from Firebase Storage to
  Supabase Storage (`documents` bucket).
* Fixed Supabase advisor warnings: pinned `search_path` on all
  `SECURITY DEFINER`/trigger functions, revoked public `EXECUTE` on
  `handle_new_user()`, removed a redundant public-bucket listing policy.
* Renamed the project: repo `waldseelen/STEMA` → `waldseelen/PLANEX-V2`,
  Vercel project `stema` → `planex-v2` (`https://planex-v2.vercel.app`).
  Local folder rename to `PLANEX-V2` is still pending (blocked by another
  process holding a lock on the directory).
* Deployed to Vercel production; typecheck and build are clean.
* **Still needed for the deployed app to fully work:** enable Google/GitHub
  OAuth providers with real credentials in the Supabase dashboard, and add
  `SUPABASE_SERVICE_ROLE_KEY` to the Vercel project's environment variables.
* Wrote `PRODUCT_DIRECTION.md` capturing the agreed next-priority sequencing.

---

## 6. Current Gate Status

This is the only table in the repository that carries a gate result. Nothing here
may be marked passing unless that exact command was run in the current checkout.

| Gate | Command | Result | Last actually run |
| --- | --- | --- | --- |
| Typecheck | `npm run typecheck` | Reported clean on 2026-03-14 and again on 2026-07-05. **Not re-run since.** | 2026-07-05 |
| Production build | `npm run build` | Reported clean on 2026-07-05. **Not re-run since.** | 2026-07-05 |
| Lint | `npm run lint` | Never recorded as run to completion. **Four file-level `eslint-disable` blocks** suppress rules across whole files — `src/lib/backup/backupService.ts:1`, `src/lib/backup/exportService.ts:1` (also disables `no-explicit-any`), `src/lib/cloud/plannerRepo.ts:1`, `src/lib/cloud/trackerRepo.ts:1` — plus 8 inline `eslint-disable-next-line` comments in `src/events/hooks.ts`, `src/shared/hooks/useSupabaseQuery.ts`, `src/shared/store/storeUtils.ts`, and `src/shared/utils/sanitize.ts`. A clean result would not mean what it appears to mean. This violates `CLAUDE.md` §7.3 and is recorded as debt in `TASKS.md`. | never recorded |
| Unit / component tests | `npm run test` | **Unknown — no trustworthy number exists.** See "Test-count claims" below. | last credible partial observation 2026-07-06 |
| E2E | `npm run test:e2e` | **Cannot run.** The script exists (`playwright test`) but there is no `playwright.config.*` anywhere in the repo and no e2e spec directory. This is a documented gate with nothing behind it. | never |
| Bundle analysis | `ANALYZE=true npm run build` | Not a package.json script, and the inline `VAR=value cmd` prefix is not valid PowerShell — see `CLAUDE.md` §2. | n/a |

### Test-count claims — none of them are usable

Four different totals were asserted across four documents, none reproducible and
none carrying the command that produced it:

| Claimed count | Where it was asserted | Date attached |
| --- | --- | --- |
| 343 tests passing (37 files) | `CLAUDE.md` "Product Snapshot" | none |
| 282 tests passing | `MEMORY.md` "Test baseline" | 2026-03-14 |
| 319 passing, 10 pre-existing network-dependent failures | `feature_quality_report.md` | 2026-07-06 |
| 321 passing, same 10 failures | `feature_quality_report.md` | 2026-07-06 |

The last two are the only ones that report failures alongside the passes, and they
are the most credible for that reason. **The honest statement of the current test
gate is: last actually observed on 2026-07-06 at ~321 passing with 10
network-dependent failures, and not re-observed since.** The `343` and `282`
figures are superseded and should not be repeated.

The suite was deliberately not re-run on 2026-08-03 — both sessions that day were
documentation-alignment passes under an explicit no-test-run constraint. Producing
a fresh number is open work; see `TASKS.md`.

### `tests/rls/rlsSmoke.test.ts` is not evidence of RLS coverage

Read on 2026-08-03. The file is titled "RLS Smoke Tests (Firebase Version)" and its
header comment claims the project "migrated from Supabase to Firebase" — the exact
reverse of what happened. Concretely:

* It calls `vi.mock('@/config/firebase', ...)` and
  `vi.mock('@/lib/cloud/firebaseRepo', ...)`. **Neither module exists.**
  `src/config/` contains no `firebase.ts`; `src/lib/cloud/` contains no
  `firebaseRepo.ts`. Both were deleted in the 2026-07-05 migration.
* The system under test, `src/lib/cloud/plannerRepo.ts`, imports `listOwnedRows` /
  `upsertOwnedRow` / `upsertOwnedRows` / `deleteOwnedRows` / `updateOwnedRows` from
  `./supabaseRepo`. The `firebaseRepo` mock factory therefore intercepts nothing,
  and the `mockUpsertOwnedRow` assertions in Scenarios 2 and 3 have no path by
  which they could be satisfied.
* The one mock that *does* still bind is `@/lib/cloud/currentUser`. That means
  Scenario 1 ("unauthenticated requests are rejected") exercises the real
  `supabaseRepo` guard and is accidentally meaningful despite the Firebase framing.

The 10 "pre-existing network-dependent failures" recorded on 2026-07-06 are
consistent with tests reaching the real Supabase client, which
`src/config/supabase.ts` points at `https://placeholder.supabase.co` when env vars
are absent. This was inferred by reading the source, not by running the suite.

**Conclusion: `CLAUDE.md`'s former claim that "RLS smoke passed" was not evidence
that row-level security is tested.** Rewriting this file is open work; see
`TASKS.md`.

---

## 7. Session Log (2026-08-03) — Documentation alignment to `CLAUDE.template.md`

Documentation-only pass. No source file, config file, migration, or test was
modified. No git operation was performed. No test suite or build was run.

**What was verified against source, and what it overturned:**

* **`useLiveQuery` is gone from the application.** Zero call sites in `src/`. The
  identifier survives only in three explanatory comments describing what replaced
  it: `src/shared/hooks/useSupabaseQuery.ts:4`,
  `src/lib/cloud/queryInvalidation.ts:4`, `src/modules/tracker/store/trackerUIStore.ts:5`.
  `useSupabaseQuery` has 78 occurrences across 15 files, including every one of the
  14 files under `src/db/**/queries/**`. `AGENT.md` was right; `CLAUDE.md`'s
  standing hard rule "Existing Dexie component queries should continue to use
  `useLiveQuery`" was false and has been removed.
* **Dexie is not merely reduced — it is entirely absent.** `dexie` is not a
  dependency in `package.json`. There is no `from 'dexie'` import anywhere outside
  `node_modules`. The `PlannerDatabase` and `LifeFlowDB` classes do not exist in
  any form. `src/db/planner/database.ts` is
  `export const plannerDb = {} as Record<string, unknown>` with `clearPlannerData()`
  as an empty body; `src/db/time-tracking/database.ts` is `export const db = {}`
  with `seedDefaultData()` empty. `fake-indexeddb/auto` in `tests/setup.ts` mocks
  the browser IndexedDB API and is not Dexie usage.
* **The local-cache / bootstrap layer is vestigial, and this has a user-visible
  consequence.** `src/lib/cloud/domainSync.ts` is entirely no-op stubs:
  `getDomainSyncSummary()` unconditionally returns
  `{ hasCloudData: false, hasLocalData: false, ownerMismatch: false, ... }`, and
  `clearLocalDomainCaches` / `hydrateLocalCacheFromCloud` / `migrateLocalDataToCloud`
  all have empty bodies. Because `CloudDataBootstrap.tsx` branches on that summary,
  only the final `ensureRemoteUserDefaults()` path can ever execute. **The
  owner-mismatch cache-clear branch and the local-data import prompt modal are both
  unreachable at runtime.** The cross-user isolation guarantee that several docs
  asserted is not being enforced by this layer. Recorded as open work in `TASKS.md`;
  no code was changed.
* **`src/lib/cloud/localCacheOwner.ts` is half-dead.** `clearLocalCacheOwner` is
  called twice from `authStore.ts` (lines 158, 498), but `writeLocalCacheOwner` and
  `readLocalCacheOwner` have zero callers — the owner value is never written, so it
  is always `null` and nothing ever reads it.
* **Stack facts were wrong in every doc that stated them.** `AGENT.md`, `MEMORY.md`
  and `README.md` claimed React 18 / TypeScript 5.7 / Vite 6 / Tailwind 3 / Dexie.
  `package.json` says React 19.2, TypeScript ~7.0.2, Vite 8, Tailwind 4, and no
  Dexie at all.
* **`/calendar` is no longer a calendar page.** `src/app/App.tsx:144` is
  `<Route path="calendar" element={<Navigate to="/planner/tasks" replace />} />`.
  Both `CLAUDE.md` and `AGENT.md` listed it as a real route. Calendar is now a view
  tab inside the planner tasks page.
* **All documented npm scripts exist** (`typecheck`, `test`, `test:ui`, `test:e2e`,
  `lint`, `build`, `dev`, `preview`). Nothing documented is missing — but `test:e2e`
  has no Playwright config behind it, recorded in the gate table above.
* **Dead dependencies identified:** `prop-types` (zero imports in `src/` or `api/`)
  and `@stripe/stripe-js` (only `src/config/plans.ts` references Stripe, and only as
  env-var-backed price-ID strings — the SDK itself is never imported).
* **`MEMORY.md`'s design-token block was wrong on three colour facts** and its
  onboarding label sequence was wrong. Corrected in place against `src/index.css`,
  `tailwind.config.js`, and `OnboardingOrchestrator.tsx`. See `MEMORY.md`.
* **Onboarding step 6 permanently hits its fallback.** The `calendar` coachmark
  targets `nav-calendar`, but `src/app/components/navItems.ts` has no nav item with
  id `calendar` (the ids are overview, tasks, habits, tracker, courses, learn, stats,
  settings), so `[data-onboarding-target="nav-calendar"]` never resolves. Recorded in
  `MEMORY.md` and as open work in `TASKS.md`.

**Correction (written 2026-08-03, second pass).** The first pass on this date was
stopped partway through. It had written a "Documents changed in this session" list
here naming `CLAUDE.md`, `AGENT.md`, `MEMORY.md`, `ARCHITECTURE.md`, `README.md`
and `TASKS.md` — **none of which it had actually modified.** Only `PROGRESS.md` was
touched. That list has been removed rather than kept, because a session log that
records edits which never landed is the same failure mode as the 2026-06-19
entries corrected at the top of this file.

Two further inaccuracies from that pass, now fixed:

* §8 below is headed "migrated from `MEMORY.md`", but the section was **copied**,
  not moved — `MEMORY.md` still carried its own `## Completed Passes
  (Chronological)` until the second pass removed it. The move is now complete.
* The lint row in §6 named only `plannerRepo.ts` as carrying a suppression. There
  are four file-level suppressions and eight inline ones; §6 now lists them.

The verification findings recorded above were independently re-checked against
source in the second pass and all held. See §7.1 for what actually landed.

---

## 7.1 Session Log (2026-08-03, second pass) — the alignment actually applied

Documentation-only pass, completing the work the first pass had recorded but not
performed. No source file, config file, migration, or test was modified. No git
operation was performed. No test suite or build was run.

**Additional findings verified in this pass:**

* **`VITE_ENABLE_SYNC` is a dead flag.** It appears in `.env.example:36` and has
  **zero references in `src/` or `api/`**. `CLAUDE.md`, `AGENT.md` and `README.md`
  all documented it as enabling local-to-cloud bootstrap behaviour. It enables
  nothing. Corrected in all three. Its neighbours `VITE_ENABLE_GOOGLE_AUTH` and
  `VITE_ENABLE_GITHUB_AUTH` were checked at the same time and **are genuinely
  live** (`src/modules/auth/lib/security.ts:13,18`); the docs describing them as
  provider toggles were correct and were left alone.
* **`CONSTANTS.DB_NAME` (`'LifeFlowDB'`) has zero consumers.** Nothing in `src/`
  reads it, so it does not qualify the "Supabase is the sole persistence path"
  finding — it is dead text, not a live database handle.
* **`MEMORY.md`'s design-token block was wrong about the accent colour.** It said
  the accent is violet, `#7C3AED` light / `#8B5CF6` dark. `src/index.css:27` and
  `:122` define `--color-accent` as `#2563eb` (light) and `#3b82f6` (dark) — the
  accent is **blue**. `#7c3aed` is `--status-violet` (`src/index.css:37`), a
  semantic status colour, not the accent. It also gave `--bg-primary` as
  `#FAFAFA`/`#050505`; the real values are `#ffffff` and `#0a0a0a`.
* **`MEMORY.md`'s motion numbers did not exist in the code.** "180-200ms",
  "y:4px", and "0.18s modal entry" appear nowhere in `src/config/motion.ts`, which
  defines `instant: 60, fast: 120, base: 160, slow: 200, page: 130` and a
  `slideUp` variant with `y: 8`. The actual durable fact — that no spring or
  overshoot easing exists in the config — was kept; the invented numbers were
  replaced with the real table.
* **`MEMORY.md`'s onboarding label sequence was wrong.** It recorded
  "begin → common.next × 5 → start". `OnboardingOrchestrator.tsx` produces
  begin → `common.next` (once) → `onboarding.gotIt` (×5) → start.
* **Dead dependencies confirmed by import grep:** `prop-types` (zero references
  anywhere), `@stripe/stripe-js` (never imported; `src/config/plans.ts` only holds
  env-var-backed `STRIPE_PRICE_IDS` strings — there is no billing implementation),
  and `@next/bundle-analyzer` (a Next.js package in a Vite repo; analysis actually
  runs through `rollup-plugin-visualizer`, gated on `process.env.ANALYZE` at
  `vite.config.ts:23`). `@excalidraw/excalidraw` **is** genuinely used, by
  `src/modules/learn/pages/MindmapPage.tsx:16`.
* **`ANALYZE=true npm run build` — precise verdict.** Not a `package.json` script,
  but the capability is real via `vite.config.ts:23`. The documented invocation was
  wrong for this environment regardless: the inline `VAR=value cmd` prefix is not
  valid PowerShell. Correct form is `$env:ANALYZE='true'; npm run build`.
* **`src/config/supabase.ts` always constructs a client**, falling back to
  `https://placeholder.supabase.co` when env vars are absent, and exports
  `isSupabaseConfigured` as the real signal. This is the most likely cause of the
  10 network-dependent test failures recorded on 2026-07-06. Inferred by reading
  the source; not confirmed by running the suite.
* **The `useLiveQuery` and Dexie findings from the first pass were re-verified and
  hold exactly.** `useLiveQuery`: 3 occurrences in `src/`, all inside explanatory
  comments, zero call sites. `useSupabaseQuery`: 78 occurrences across 15 files,
  covering all 13 query modules under `src/db/*/queries/`. `dexie` is absent from
  `package.json`; `from 'dexie'` matches nothing; `syncDomainTables` matches
  nothing.

**Documents changed in this pass — verified by re-reading each after writing:**

* `CLAUDE.md` — rewritten to `DEV/CLAUDE.template.md` shape. Part 1 (§0 read order,
  §1 identity, §2 commands, §3 ownership table, §4 decision order, §5 architecture
  pointer, §6 absolute rules) is repo-specific and source-verified. Part 2 (§7–§17)
  is the template verbatim, **with no rules deleted**, plus repo-specific additions
  to the §12 load-bearing list and the §15 approval list. The false hard rule
  "Existing Dexie component queries should continue to use `useLiveQuery`" is gone.
  All dates, ✅ marks, and test counts removed.
* `AGENT.md` — reduced to a ~20-line pointer stub. Its verified, unowned content
  (icon-catalog and toast-hardening notes, the `SUPABASE_SERVICE_ROLE_KEY` rule,
  the UI/UX and data rules) was migrated into `CLAUDE.md` §6 and `MEMORY.md` first.
  Its "Location" row hardcoded an absolute Windows user path that no longer
  matched any machine; the row was removed rather than corrected, since an
  absolute user path in a repo doc is a liability regardless of accuracy.
* `MEMORY.md` — rewritten to durable non-obvious facts only. `## Completed Passes
  (Chronological)` deleted (it lives in §8 below). Every retained fact re-verified:
  the i18n full-path convention against `src/i18n/locales/en/onboarding.json` and
  `OnboardingCoachmark.tsx`; the ToastProvider/MemoryRouter test gotchas against
  `tests/auth/authFlow.test.tsx` and `tests/components/ActivityEditModal.test.tsx`;
  the token values against `src/index.css` and `tailwind.config.js`; the onboarding
  contract against `OnboardingOrchestrator.tsx` and `navItems.ts`.
* `ARCHITECTURE.md` — the Dexie/`useLiveQuery` assertions in the system map, the
  planner `queries/` row, §3.1 data flow, the §5 folder tree, and §7 were corrected.
  A route map was added under §2.1 (ARCHITECTURE.md now owns the route table, since
  it was removed from `CLAUDE.md` and `AGENT.md`), recording `/calendar` as a
  redirect to `/planner/tasks` rather than a page.
* `README.md` — minimum touch: stack versions (React 19 / TS 7 / Vite 8 /
  Tailwind 4, Dexie row dropped), the Dexie data-layer paragraph, the `/calendar`
  route row, the folder tree comment, the `VITE_ENABLE_SYNC` env row, and the dated
  status heading.
* `PROGRESS.md` — this file: §6 lint row corrected, the false "Documents changed"
  list replaced with the correction notice above, and this section added.
* `TASKS.md` — new phase appended for open items; existing content untouched.

**Left open deliberately:** no test suite, build, lint, or typecheck was run, so
every row in §6 keeps its previous "last actually run" date.

---

## 8. Historical Passes (migrated from `MEMORY.md` on 2026-08-03)

This section was moved here verbatim in substance from `MEMORY.md`, which under the
ownership rules in `CLAUDE.md` §3 may not carry dates or ✅ marks. The move is
complete: the corresponding `## Completed Passes (Chronological)` section no longer
exists in `MEMORY.md`. This section is kept for the historical record. Nothing in it
has been re-verified against current source, and the test counts it cites are
superseded by §6.

### ✅ Visual Rework (Phases 1-6) — DONE
Token reset, Nav, Layout/Ambient, Card/Components, Page-by-page, Polish
(reduced-motion). Detail: `memory/visual_rework.md`.

### ✅ Optimizations (Phase 0-5) — DONE (2026-03-11)
Set-based lookups, `useMemo` guards, Zustand→Dexie migrations for all planner pages,
CommandBar lazy-mount, RightPanel O(1) maps, test baseline 238→282.
Detail: `memory/optimizations.md`.

Note added 2026-08-03: the "Zustand→Dexie migrations" described here have since been
superseded twice over — first to Firestore, then to Supabase. Dexie is no longer
present in the repo at all.

### ✅ Design Overhaul, 9 Phases — DONE (2026-03-13)
Token reset, typography, component reset (`rounded-lg`, `scale(0.985)`), motion
cleanup, landing update, app shell `h-14`, onboarding spring→standard, module icon
neutral. Detail: `memory/design_overhaul.md`.

### ✅ Exposed-Flow Stabilization — DONE (2026-03-14)
**Test baseline fixed: 5 failing → 282 passing** (superseded — see §6).

* `src/i18n/locales/tr/onboarding.json` + `en/onboarding.json`: added 8-step keys
  (welcome, modules, planner, tracker, habits, calendar, goals, usage + begin/gotIt/
  start + moduleCards + usageOptions)
* `src/modules/auth/components/OnboardingCoachmark.tsx`: fixed the `tOnboarding`
  key-path bug (`'progress'` → `'onboarding.progress'` etc. — all shorthand keys
  corrected)
* `src/modules/auth/pages/AuthPage.tsx`: added `v1.0.0` to the footer
* `tests/auth/authFlow.test.tsx`: added a step 0→1→2 click simulation for the
  fallback test
* `tests/components/ActivityEditModal.test.tsx`: added `ToastProvider` wrapper +
  icon picker click

### Session re-validation (2026-03-14)
`npm run typecheck`, `npm run test -- --run tests/rls/rlsSmoke.test.ts`, and
`npm run build` all reported passing; user confirmed PROD-2 dashboard configuration
was completed.

Note added 2026-08-03: the `rlsSmoke` result recorded here is not meaningful — see
§6, "`tests/rls/rlsSmoke.test.ts` is not evidence of RLS coverage."

### Visual & Design Overhaul (9-phase) — completed
Near-zero shadow tokens, flat cards, `rounded-lg` buttons, standard-easing-only
motion, neutral icon containers, spacious `h-14` header, spring easing removed.

### i18n completeness audit — completed
`HabitDetailPage`, `GlobalSearchBoxes`, `ExternalSearchButtons`, `ErrorBoundary`, and
Modal close buttons all localized; `App.tsx` cross-namespace `t()` calls fixed.
