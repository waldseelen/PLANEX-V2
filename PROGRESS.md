# PROGRESS.md — STEMA + PLAN.EX Integration Progress Log

**Reference:** [TASKS.md](file:///C:/Users/HP/DEV/STEMA/TASKS.md), [ARCHITECTURE.md](file:///C:/Users/HP/DEV/STEMA/ARCHITECTURE.md), [PRODUCT_DIRECTION.md](file:///C:/Users/HP/DEV/STEMA/PRODUCT_DIRECTION.md)

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
  still the actual UI read path (and still is — see
  `ARCHITECTURE.md` section 7).

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
| Data layer migration | ✅ Done | Phase 2 / Phase 5 | Was false. Real as of 2026-07-05: `plannerRepo`/`trackerRepo` genuinely write to Supabase via `supabaseRepo.ts`; Dexie is still the primary UI read path (unchanged target architecture). |
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
