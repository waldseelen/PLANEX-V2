# STEMA + PLAN.EX Integration Master Project Plan (TASKS.md)

This document contains all the steps and phases needed to integrate the
STEMA (Socratic STEM Learning Platform) module on top of PLAN.EX, which was
meant to be cleaned of Firebase and moved onto Supabase.

## Correction Notice (2026-07-05)

When this document was written, Phases 0-2 were checked off `[x]` as done,
but the actual code at the time still ran entirely on Firebase (Firebase
Auth + Firestore), with a silent per-browser `localStorage` fallback in
production. As of 2026-07-05 those phases are now genuinely true — Firebase
has been fully removed, a real Supabase schema exists, and the repo layer
really does talk to Supabase.

However, several **specific table names** named in the Phase 1 and Phase 2
sub-tasks below were never actually built that way — the real schema
(`supabase/migrations/20260705000000_init_schema.sql`) matches the naming
already used by the pre-existing `plannerRepo.ts`/`trackerRepo.ts` code, not
the names speculatively written into this plan:

- Phase 1.3 says `sessions`/`messages` → the real tables are
  `learn_sessions`/`learn_messages`.
- Phase 2.1 says `planner_tasks`/`planner_plans` → the real tables are
  `courses`, `units`, `tasks`, `personal_tasks`, `events`, `habits`,
  `habit_logs`, `completion_records`.
- Phase 2.2 says `tracker_habits`/`tracker_logs` → the real tables are
  `categories`, `tags`, `activities`, `time_sessions`, `running_timers`,
  `goals`, `rules`, `reminders`, `settings`, `pomodoro_configs`.

Don't trust a table name in this file over the actual migration file or
`ARCHITECTURE.md` section 4.

**Priority sequencing below is also superseded.** See
`PRODUCT_DIRECTION.md` for the currently agreed order: solidify the primary
planner/tracker core first (see `feature_quality_report.md` for concrete
issues), then build the planner↔learn integration bridge (link
`concepts`/`learn_sessions` to `courses`/`units`), then focus STEM on a
single loop (Socratic chat + mistake analysis + FSRS) before touching
anything in Phase 12-14, 18-19.

---

## Plan Structure

Each phase is broken into sub-tasks (`0.1`, `0.2`, `1.1`, etc.). Each major
phase ends with a **CHECK TASK** that guarantees the project's stability and
correctness. The check task must be completed before moving to the next
phase.

---

## 🗺 Original Strategic Roadmap & Priorities (superseded — see notice above)

The biggest competitive advantages against rivals like Astra AI were judged
to be:
1. **Bring your own material (RAG):** letting the user add and study from
   their own lecture notes/PDFs.
2. **Advanced mastery tracking:** measuring depth of learning via
   `concept_mastery` + `FSRS` + `error_logs`.
3. **Cost optimization:** dramatically lowering (up to 30x) LLM costs via
   DeepSeek V4.

Based on that, development was originally split into two waves:

> **Wave 1: Core flow, cost optimization, and going live (highest priority)**
> - Phase 17.1-17.2 (DeepSeek migration & LLM abstraction)
> - Phase 9 (Mapping Mode) & Phase 10 (RAG & pgvector)
> - Phase 16 (Security, testing, and production deploy)

> **Wave 2: Deepening, mobilization, and personalization (second stage)**
> - Phase 12 (CS & Algorithm Sandbox)
> - Phase 13 (Exam Generator & Interleaved Practice)
> - Phase 14 (INCUP & ADHD Adaptations)
> - Phase 18 (Advanced Onboarding & Pre-built Concept Trees)
> - Phase 19 (PWA & Mobile Adaptation)

This wave split is no longer the active plan — see `PRODUCT_DIRECTION.md`.

---

## 🛠 PHASE 0: Project Stabilization (Firebase Cleanup & Supabase Connection)

Fully clean up Firebase, remove remaining references, and get the project
building and running with Supabase Auth integrated.

- [x] **0.1: Clean up remaining Firebase imports and references**
  - [x] Remove/clean Firebase dependencies in `src/lib/cloud/plannerRepo.ts`.
  - [x] Remove/clean Firebase dependencies in `src/lib/cloud/trackerRepo.ts`.
  - [x] Clean Firebase imports in `src/lib/cloud/remoteDefaults.ts`.
  - [x] Remove Firebase Auth dependencies in `src/modules/auth/store/authStore.ts`.
  - [x] Clean Firebase code in `src/modules/auth/pages/AuthPage.tsx` and `AuthCallbackPage.tsx`.
  - [x] Clean Firebase connections in `src/modules/settings/pages/Settings.tsx` and `src/modules/settings/store/settingsStore.ts`.
  - [x] Clean Firebase data-export code in `src/modules/tracker/lib/exportService.ts`.
  - [x] Update Firebase error/status messages in `src/i18n/locales/en/auth.json` and `tr/auth.json`.
- [x] **0.2: Supabase client configuration**
  - [x] Create `src/config/supabase.ts` and initialize the `@supabase/supabase-js` client.
  - [x] Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env.local`.
  - [x] Build a safe fallback for a missing/broken env.
- [x] **0.3: Supabase Auth integration**
  - [x] Rewrite the login flow in `authStore.ts` for Google and GitHub OAuth providers.
  - [x] Build the mechanism that listens for user session state (`onAuthStateChange`).
  - [x] Test login, logout, and session refresh (refresh token) logic.
- [x] **0.4: Environment variables and build verification**
  - [x] Verify `tsconfig.json` and the Vite config work correctly.
  - [x] Start the app locally with `npm run dev` and confirm no errors.

### ✅ CHECK TASK (Phase 0):
- [x] No file contains a Firebase reference anymore.
- [x] The project builds error-free locally (`npm run dev`).
- [x] Login works via Supabase Auth (Google or GitHub) and the user session can be seen in the console.

---

## 🗄 PHASE 1: Supabase Database Schema & RLS Policies

Create all the relational and vector (pgvector) database schema the project
needs on Supabase, and write the security policies.

- [x] **1.1: Enable Supabase extensions**
  - [x] Enable the `pgvector` extension (for RAG vector search).
  - [x] Enable the `uuid-ossp` extension.
- [x] **1.2: Core user and profile tables**
  - [x] `profiles` table (id, email, full_name, avatar_url, updated_at).
  - [x] Auto-trigger for `profiles` (fires when a new row lands in `auth.users`).
- [x] **1.3: STEMA learning and chat tables**
  - [x] Chat sessions table (real name: `learn_sessions` — id, user_id, topic, status, created_at).
  - [x] Chat messages table (real name: `learn_messages` — id, session_id, role, content, raw_response, token_cost, prompt_tokens, latency_ms, created_at).
- [x] **1.4: Concept mastery and mistake analysis tables**
  - [x] `concepts` table (id, code, name, description, prerequisite_id).
  - [x] `concept_mastery` table (id, user_id, concept_id, score, evidence_count, updated_at).
  - [x] `error_logs` table (id, user_id, concept_id, error_type, raw_user_answer, model_feedback, created_at).
- [x] **1.5: FSRS (flashcard & spaced repetition) table**
  - [x] `sr_cards` table (id, user_id, concept_id, front, back, difficulty, stability, retrievability, state, reps, lapses, last_review, due_at).
- [x] **1.6: RAG documents and embedding table**
  - [x] `documents` table (id, user_id, title, file_path, file_type, size, created_at).
  - [x] `document_chunks` table (id, document_id, content, embedding [vector(1536)], metadata [jsonb]).
- [x] **1.7: Visualization and tracking tables**
  - [x] `mindmaps` table (id, user_id, name, nodes [jsonb], edges [jsonb], created_at).
  - [x] `tutor_events` table (id, user_id, event_type, payload [jsonb], created_at) — for metacognitive measurements.
- [x] **1.8: Row Level Security (RLS) definitions**
  - [x] Write RLS policies on every table so only the owner (matched on `user_id`) can read/write.
  - [x] Version-control migration files under `supabase/migrations/`.

### ✅ CHECK TASK (Phase 1):
- [x] The database schema was applied successfully via the Supabase CLI/Dashboard/MCP.
- [x] RLS tested: one user cannot access another user's data (messages, mindmaps, docs, etc.).
- [x] Queries using the pgvector extension were tested (the `match_document_chunks` RPC).

---

## 🔄 PHASE 2: PLAN.EX Planner/Tracker Supabase Migration

Move PLAN.EX's existing planner, habit tracker, and settings system off
Firebase onto Supabase SQL structures.

- [x] **2.1: `plannerRepo.ts` Supabase integration**
  - [x] Create the needed Supabase tables for tasks and plans (real names: `courses`, `units`, `tasks`, `personal_tasks`, `events`, `habits`, `habit_logs`, `completion_records`).
  - [x] Replace the CRUD operations in `plannerRepo.ts` with Supabase queries.
- [x] **2.2: `trackerRepo.ts` Supabase integration**
  - [x] Create Supabase tables for activities and logs (real names: `categories`, `tags`, `activities`, `time_sessions`, `running_timers`, `goals`, `rules`, `reminders`).
  - [x] Update the read/write methods in `trackerRepo.ts`.
- [x] **2.3: Dexie/IndexedDB hybrid sync structure**
  - [x] Reviewed the IndexedDB offline-support structure; it remains
    Dexie-first for UI reads today, with Supabase as the sync/hydration
    target via `CloudDataBootstrap` — not yet fully "online-first" for
    every read path. See `ARCHITECTURE.md` section 7 and
    `PRODUCT_DIRECTION.md` for why this is intentionally not being
    collapsed yet.
- [x] **2.4: `settingsStore` migration**
  - [x] User preferences and settings are saved to the `settings` and `pomodoro_configs` tables.
- [x] **2.5: Data bootstrapping mechanism**
  - [x] A newly registered user gets default planner templates and sample tasks seeded (`remoteDefaults.ts`).

### ✅ CHECK TASK (Phase 2):
- [x] A task added on the PLAN.EX planner screen is saved instantly to the real `tasks` table in Supabase.
- [x] Habit tracking data syncs successfully between local cache and the cloud database.

---

## 🎨 PHASE 3: `/learn` Module Frontend Skeleton & UI

Design of the `/learn` module hosting STEMA features, route definitions, and
shared UI components.

- [x] **3.1: Folder structure setup**
  - [x] Created `pages/`, `components/`, `store/`, `hooks/` under `src/modules/learn/`.
- [x] **3.2: Router and navigation integration**
  - [x] Defined the `/learn` route and its sub-routes (chat, mindmap) in the router.
  - [x] Added a "Learn" tab with a modern icon to the sidebar.
- [x] **3.3: Socratic entry point on the course detail page**
  - [x] Placed a "Solve Socratically / Explore with Learn" button on the PLAN.EX course/topic view.
- [x] **3.4: Mathematical notation (KaTeX) setup**
  - [x] Verified `react-katex` and `katex` packages load correctly.
  - [x] Wrote the shared `LatexRenderer` component rendering inline (`$...$`) and block (`$$...$$`) LaTeX.
- [x] **3.5: Chat UI component**
  - [x] Designed the chat window (modern, dark-mode aware, animated).
  - [x] Added character-based streaming support.
  - [x] Added copy support and syntax highlighting for code blocks.
- [x] **3.6: Loading (skeleton loader) effects**
  - [x] Added shimmering skeleton loaders for the moments the AI is "thinking."

### ✅ CHECK TASK (Phase 3):
- [x] The `/learn` route is reachable in the browser.
- [x] `LatexRenderer` renders formulas like $\int x^2 dx = \frac{x^3}{3} + C$ correctly.
- [x] The chat UI works responsively.

---

## 🧠 PHASE 4: AI Backend & Smart Model Router (Vercel Functions / Backend API)

Route an incoming query (mathematical reasoning, code writing, simple
classification) to the most suitable model, and stand up the API
infrastructure.

- [x] **4.1: API infrastructure setup**
  - [x] Configured the backend layer (Vercel Edge Functions, TypeScript) with the `/api/chat` endpoint.
- [x] **4.2: DeepSeek V4 integration**
  - [x] Set up the DeepSeek API connection for fast classification, concept-map JSON output, and first-pass analysis.
- [x] **4.3: Model routing via OpenRouter**
  - [x] All model calls route through OpenRouter (`api/lib/llmClient.ts` / `config.ts`), rather than maintaining separate direct integrations per provider.
- [x] **4.4: Task-based configuration**
  - [x] `TASK_CONFIG` in `api/lib/config.ts` maps each task type (socratic, feynman, mindmap, ocr, flashcard) to its model/temperature/response-format preset.
- [x] **4.5: Dynamic task router design**
  - [x] `taskType` selection in each API route effectively chooses which model preset a request uses.
- [x] **4.6: Prompt caching configuration**
  - [x] Configured request shape to maximize cache hits with the OpenRouter-routed models.
- [x] **4.7: Token and latency logging**
  - [x] Every API call's token usage, response time (ms), and cost are logged (now via `learn_messages`, not the originally-named `messages` table).

### ✅ CHECK TASK (Phase 4):
- [x] Requests sent to `/api/chat` route through the configured model per `TASK_CONFIG`.
- [x] Responses are saved to the database along with token and latency data.

---

## 🎓 PHASE 5: Socratic Tutor Engine

Build the hint loops and Socratic dialogue structure that guide the user to
the right answer instead of answering directly.

- [x] **5.1: Socratic system prompt design**
  - [x] Wrote the detailed system prompt instructing the model to never give a direct solution, give hints instead, and prompt the student to think. Temperature pinned at a stable 0.3.
- [x] **5.2: 3-tier hint system**
  - [x] Flow the model follows on a mistake:
    1. *Tier 1 (general hint):* recall the concept's core principle.
    2. *Tier 2 (directive hint):* focus on the formula or method.
    3. *Tier 3 (final hint):* a specific question that nearly gives away the answer.
- [x] **5.3: User mastery check**
  - [x] If the user's `mastery_score` for that topic is above 90%, skip the Socratic loop and directly confirm the answer.
- [x] **5.4: Self-explanation questions**
  - [x] At critical steps of a solution, the AI asks the user things like "why did we use a minus sign here — can you explain?"
- [x] **5.5: Socratic flow state machine**
  - [x] Tracks which hint tier the user is on and how long they've been stuck.
- [x] **5.6: Rendering the response in the UI**
  - [x] Displays the Socratic output cleanly in Markdown and KaTeX.

### ✅ CHECK TASK (Phase 5):
- [x] When the user asks an integral question, the AI doesn't give the result directly — it nudges with things like "have you thought about substitution first?"
- [x] After 3 failed attempts, the option to reveal the final solution is active.

---

## 🗣 PHASE 6: Feynman Mode (Learning by Explaining) and Referee Agent

The Feynman technique module: the user explains a topic in their own words
and the AI evaluates that explanation.

- [x] **6.1: Feynman UI design**
  - [x] Built a clean interface where the user picks a topic and explains it via free text or voice input.
- [x] **6.2: Referee prompt design (evaluator)**
  - [x] The referee model (via OpenRouter) compares against a hidden list of keywords/concept map the topic must cover.
- [x] **6.3: Missing terminology detection and redirection**
  - [x] Detects gaps in the explanation and, instead of saying "you got it wrong," asks a guiding question like "the part you explained is great, but what role does entropy play here?"
- [x] **6.4: Mnemonic suggester**
  - [x] The model suggests clever analogies, acronyms, or stories (mnemonics) to help hard concepts stick.
- [x] **6.5: Feynman scoring and mastery update**
  - [x] Produces a Feynman score (1-100) based on explanation quality and writes it as evidence to `concept_mastery`.

### ✅ CHECK TASK (Phase 6):
- [x] In Feynman mode, when "cell division" is explained, the referee agent notices the missing "mitosis/meiosis difference" concept and asks about it.
- [x] The resulting score is reflected in the user's profile's concept mastery level.

---

## 🎯 PHASE 7: Mistake Intelligence and FSRS System

Classify the user's mistakes, keep a mistake log, and generate smart
spaced-repetition cards via the FSRS (Free Spaced Repetition Scheduler)
algorithm.

- [x] **7.1: Mistake type classifier**
  - [x] The AI classifies a mistake into one of 4 categories:
    - *Conceptual*
    - *Procedural*
    - *Calculation (attention slip)*
    - *Strategic (wrong method chosen)*
- [x] **7.2: Write to `error_logs`**
  - [x] Logs the classified mistake, the original question, and the user's answer.
- [x] **7.3: FSRS algorithm implementation**
  - [x] Wrote the FSRS (open-source SuperMemo-alternative spaced-repetition algorithm) math as JS/TS functions.
- [x] **7.4: Automatic flashcard generation**
  - [x] Auto-generates a question/answer flashcard for the mistaken concept in the background and saves it to `sr_cards`.
- [x] **7.5: Framer Motion flashcard UI**
  - [x] Designed an animated flip-card UI component revealing the answer on click.
- [x] **7.6: Rating buttons**
  - [x] "Again", "Hard", "Good", "Easy" buttons under the card; the FSRS interval is recalculated on selection.
- [x] **7.7: PLAN.EX calendar integration**
  - [x] The FSRS-determined next due date (`due_at`) is auto-added to the PLAN.EX calendar as a "review task" event.

### ✅ CHECK TASK (Phase 7):
- [x] A calculation slip on a math problem gets tagged `calculation` and written to the database.
- [x] When an auto-generated card is marked "Hard," FSRS recomputes the due date and a task appears on that day in the PLAN.EX calendar.

---

## 📊 PHASE 8: Concept Mastery Dashboard

A dashboard showing how competent the user is in each topic, with
metacognitive calibration charts.

- [x] **8.1: Mastery scoring algorithm**
  - [x] A concept's mastery score only rises once at least 3 independent pieces of evidence exist (a correctly Socratic-solved question, a successful Feynman explanation, a correct FSRS card review).
- [ ] **8.2: Knowledge graph visualization**
  - [ ] Interactive tree graph showing prerequisite relationships between topics (e.g. you can't solve an integral without knowing derivatives). **Deliberately deferred** — see `PRODUCT_DIRECTION.md`.
- [x] **8.3: Metacognitive calibration chart**
  - [x] Scatter plot comparing the user's pre-question "how good am I at this?" self-estimate (1-5) against actual performance.
- [x] **8.4: Error cluster analysis**
  - [x] Pie chart of which mistake type is most common (e.g. 60% attention slips).
- [x] **8.5: Weak-topic alerts**
  - [x] Topics below a threshold are listed at the top of the panel as "urgently needs review."

### ✅ CHECK TASK (Phase 8):
- [x] Completed topics show green, gaps show red, and locked topics show inactive in the concept-mastery views that exist today.
- [ ] The interactive prerequisite tree (8.2) is not built — deferred.

---

## 🗺 PHASE 9: Visualization Mode (Mapping Mode) — AI Mindmap & Excalidraw Integration

Turn complex STEM topics into visual diagrams and flowcharts, with
whiteboard support.

- [x] **9.1: React Flow infrastructure**
  - [x] Installed `reactflow` and built the canvas on the mindmap page.
- [x] **9.2: AI structured JSON → mindmap conversion**
  - [x] Converts the AI's hierarchical JSON output into auto-laid-out React Flow nodes and edges.
- [ ] **9.3: Mindmap generation from a PDF**
  - [ ] Backend flow that extracts and maps topic headings from an uploaded lecture note/book in seconds. **Not built yet.**
- [ ] **9.4: "Expand this branch" feature**
  - [ ] Clicking a node pulls its details from the RAG database and adds new child nodes. **Not built yet.**
- [x] **9.5: Excalidraw integration**
  - [x] `@excalidraw/excalidraw` is integrated; the user can free-draw over the mindmap.
- [ ] **9.6: Export**
  - [ ] Download prepared maps as PNG, PDF, and Markdown. **Not built yet.**

### ✅ CHECK TASK (Phase 9):
- [x] Entering a topic name draws a mindmap on screen immediately.
- [x] Clicking a node and annotating on the Excalidraw canvas next to it works and the work can be saved.
- Further depth here (9.3, 9.4, 9.6) is **deliberately deferred** per `PRODUCT_DIRECTION.md`.

---

## 🗄 PHASE 10: RAG Document Ingestion (Vector Database and Search)

Let the user upload their own PDF lecture notes, chunk them into vectors,
and have the AI answer based only on those sources.

- [x] **10.1: Document upload UI**
  - [x] Drag & drop upload UI accepting PDF and TXT, saving files to Supabase Storage (`documents` bucket, private, owner-scoped RLS).
- [x] **10.2: Inductive chunking**
  - [x] Smart chunking that preserves theorem/formula/definition/example-question boundaries instead of splitting plain text (average chunk size 300-500 tokens).
- [x] **10.3: Embedding generation**
  - [x] Converts chunks to vectors via `text-embedding-3-small` over OpenRouter.
- [x] **10.4: pgvector storage and metadata**
  - [x] Vectors are written to `document_chunks` with page/metadata tags.
- [ ] **10.5: Mistake-index matching**
  - [ ] Match the user's previously-mistaken topics to the relevant pages in the document and add that to the chunk metadata. **Not built yet.**
- [x] **10.6: Vector search and context injection**
  - [x] When answering, the Socratic tutor runs a real pgvector similarity search (`match_document_chunks` RPC) over the user's documents and injects matched chunks into the prompt. (Previously this fetched every chunk and computed cosine similarity in JS — fixed on 2026-07-05.)
- [x] **10.7: Hallucination-prevention policy**
  - [x] If the topic isn't found in the documents, the AI is instructed to say "this information wasn't found in your sources" instead of making something up.

### ✅ CHECK TASK (Phase 10):
- [x] A 20-page physics PDF uploads, gets chunked into vectors, and is written to Supabase in the background.
- [x] Asking a specific question about the PDF's content gets an answer referencing a page number.

---

## 📷 PHASE 11: OCR Pipeline and Multimodal Input

Get handwritten mathematical equations, formulas, and graphs into the
system via camera/image and have them solved.

- [x] **11.1: Image upload and crop UI**
  - [x] Upload area supporting camera access, drag-and-drop, and clipboard paste.
- [x] **11.2: Image pre-processing**
  - [x] Brightness/contrast/noise-reduction filters improve handwriting readability.
- [x] **11.3: Multimodal OCR integration**
  - [x] Uploaded images are sent to a vision-capable model over OpenRouter (`callLLMWithMultimodal`) to detect text and LaTeX formulas.
- [x] **11.4: Formula cleanup pass**
  - [x] A cleanup step (`latexCleaner.ts`) reduces symbol-recognition error rate in the OCR output.
- [x] **11.5: User verification screen**
  - [x] Shows the AI-extracted formula to the user with an editable "was this read correctly? fix if needed" field.
- [x] **11.6: Route to solver/mindmap**
  - [x] The confirmed formula is sent as input directly to the Socratic Tutor or mindmap generator.

### ✅ CHECK TASK (Phase 11):
- [x] Uploading a photo of a handwritten $\lim_{x \to 0} \frac{\sin(x)}{x}$ converts it to clean LaTeX.
- [x] The resulting LaTeX formula can be fed into the Socratic Tutor chat.

---

## 💻 PHASE 12: CS and Algorithm Sandbox

Safe in-browser code execution and step-by-step visual debugging for
computer science and algorithm questions. **Deliberately deferred** — not
started, see `PRODUCT_DIRECTION.md`.

- [ ] **12.1: In-browser code execution (WebContainers or iframe)**
  - [ ] Safe in-browser execution infrastructure for JavaScript, Python, and C++ (e.g. Judge0 API or a local WASM-based sandbox).
- [ ] **12.2: Code editor UI**
  - [ ] Integrate Monaco Editor or CodeMirror with line numbers and syntax highlighting.
- [ ] **12.3: Socratic debugger prompt**
  - [ ] Instead of handing over working code on an error, the AI nudges: "could the bug be the index range on line 5? check there."
- [ ] **12.4: Time/space complexity (Big-O) analyzer**
  - [ ] Module that charts the written code's Big-O complexity and (only if asked) suggests optimized alternatives.
- [ ] **12.5: Variable state visualizer (state trace)**
  - [ ] Animated panel showing variable values at each loop iteration as a table or chart.

### ✅ CHECK TASK (Phase 12):
- [ ] Python code written in the sandbox editor runs and its output shows in a terminal panel.
- [ ] The Socratic assistant explains the cause of a bug with hints when the code errors.

---

## 📝 PHASE 13: Smart Exam Generator and Interleaved Practice

An engine that generates practice exams of varying difficulty and type,
focused on the user's weak points. **Deliberately deferred** — not started,
see `PRODUCT_DIRECTION.md`.

- [ ] **13.1: Interleaved question-selection algorithm**
  - [ ] Instead of blocking (consecutive questions from one topic), build a selector that produces mixed-topic question sets, which makes learning stick better.
- [ ] **13.2: Difficulty calibration**
  - [ ] Dynamically adjust question difficulty based on the user's current mastery score (not too easy, not too hard — the optimal-difficulty zone).
- [ ] **13.3: Varied question types**
  - [ ] Templates supporting multiple-choice, open-ended Socratic questioning, and code-completion formats.
- [ ] **13.4: Exam wrapper (pre/post-exam metacognition)**
  - [ ] Ask "how well do you expect to do on this exam?" before, and "which topics do you think you got wrong?" after, to measure metacognitive awareness.
- [ ] **13.5: Automatic evaluation report**
  - [ ] End-of-exam report listing weak points and feeding them directly into the FSRS review queue.

### ✅ CHECK TASK (Phase 13):
- [ ] A generated 5-question set has 3 questions from the user's weakest topics and 2 from others.
- [ ] Exam wrapper data is successfully written to `tutor_events`.

---

## ⚡ PHASE 14: INCUP (ADHD) Adaptations and UX Details

Interface improvements that ease focus and add urgency/gamification for
users with ADHD or attention difficulties (based on the TECHNICS document).
**Deliberately deferred** — not started, see `PRODUCT_DIRECTION.md`.

- [ ] **14.1: Focus bridge**
  - [ ] Background White Noise, Brown Noise, and Lo-Fi music player integrated into study pages.
- [ ] **14.2: Urgency mode (urgency timer)**
  - [ ] Visual countdown bar timers for specific tasks/mini-quizzes that trigger focus without inducing stress.
- [ ] **14.3: Body doubling**
  - [ ] Micro-animation of a virtual study partner (AI assistant mascot or animated avatar) quietly studying alongside the user.
- [ ] **14.4: Energy management setting**
  - [ ] Let the user record their peak-energy hours (e.g. 10:00-12:00) and have PLAN.EX auto-schedule tough STEM topics into those hours.
- [ ] **14.5: If-then plan builder**
  - [ ] Dynamic form for pre-planning what to do when hitting a blocker: "If *I get distracted*, *I will do 5 minutes of stretching*." Shown as an on-screen reminder.

### ✅ CHECK TASK (Phase 14):
- [ ] Pressing "I can't focus" triggers the if-then plan and starts brown noise in the background.
- [ ] The timer bar visually depletes to hold attention on screen.

---

## 📈 PHASE 15: Performance Optimization, Prompt Caching, and Cost Management

Optimizations to lower LLM costs, reduce latency, and maximize browser
performance. **Not started** — see `PRODUCT_DIRECTION.md` step 3 (this
belongs to "make the Socratic/mistake/FSRS loop actually work well," which
is prioritized before new visual features).

- [ ] **15.1: Prompt caching optimization**
  - [ ] Fix API request templates. Put variable data (like the user message) at the very end of the prompt to maximize cache hits.
- [ ] **15.2: Smart context pruning**
  - [ ] For chats past 20 messages, summarize older messages into a single system message to keep the context window small.
- [ ] **15.3: Cost dashboard (admin view)**
  - [ ] Chart panel showing which user consumed how many tokens and which model caused how much cost.
- [ ] **15.4: User-visible token counter**
  - [ ] Bar in the UI transparently showing remaining daily question quota or energy spent.
- [ ] **15.5: Code splitting and lazy loading**
  - [ ] Load large libraries under `/learn` (Excalidraw, React Flow, Monaco Editor) via dynamic imports only when that page is visited.

### ✅ CHECK TASK (Phase 15):
- [ ] Console/DB logs confirm that prompt token cost drops due to caching across consecutive Socratic chat messages.
- [ ] Initial page bundle size is optimized via lazy loading.

---

## 🚀 PHASE 16: Security, Testing, and Production Deployment

Run security audits across the whole system, write tests, and move the
project to production (Vercel & Supabase Production).

- [x] **16.1: RLS security audit**
  - [x] Tested policies on every Supabase table via the Supabase advisor (`get_advisors`); fixed `search_path`-mutable functions, revoked public `EXECUTE` on `handle_new_user()`, and removed a redundant public-bucket listing policy.
- [ ] **16.2: API rate limiting**
  - [ ] Put per-IP/per-user limits on API endpoints (e.g. max 10 requests/minute). **Not built yet.**
- [ ] **16.3: Sandbox security checks**
  - [ ] N/A until Phase 12 (CS Sandbox) is built.
- [x] **16.4: Vitest unit tests**
  - [x] Unit tests exist for the FSRS algorithm (`tests/fsrs.test.ts`), mastery scoring (`tests/mastery.test.ts`), RAG (`tests/rag.test.ts`), and RLS smoke tests (`tests/rls/rlsSmoke.test.ts`).
- [ ] **16.5: Playwright E2E tests**
  - [ ] End-to-end test covering login -> course detail -> start Socratic chat -> make a mistake -> FSRS card created -> added to calendar. **Not verified as covering the full flow.**
- [x] **16.6: Production environment setup**
  - [x] Created a production Supabase project (`xtkovwztuopzeqpazxur`) and a production Vercel project (`planex-v2`).
  - [ ] Google/GitHub OAuth providers and `SUPABASE_SERVICE_ROLE_KEY` still need to be configured — see `PROGRESS.md` session log (2026-07-05).
- [x] **16.7: Deployment and smoke test**
  - [x] Deployed to production (`https://planex-v2.vercel.app`); typecheck and build are clean. Full manual smoke test of every flow in the live environment is still pending.

### ✅ CHECK TASK (Phase 16):
- [ ] Playwright E2E tests complete without errors. **Not verified.**
- [ ] Supabase RLS and OAuth flows work fully in production. **OAuth providers not yet enabled.**
- [x] The app is reachable at its live URL.

---

## 🔌 PHASE 17: LLM Provider Abstraction & DeepSeek Integration

Manage all model calls through a single abstraction layer, integrate
DeepSeek V4, and log cost/tokens.

- [x] **17.1: Route all API calls through one `llmClient.ts` layer**
  - [x] Created `api/lib/llmClient.ts` and `api/lib/config.ts`.
  - [x] Built a modular LLM client structure where Claude, DeepSeek, and OpenAI-compatible models are interchangeable via OpenRouter.
  - [x] Refactored `api/chat.ts`, `api/feynman.ts`, `api/mindmap.ts`, `api/ocr.ts` so all model calls go through `llmClient.ts`.
- [x] **17.2: DeepSeek V4 integration and reasoning mode**
  - [x] DeepSeek V4 API connection set up via OpenRouter.
  - [x] DeepSeek V4's reasoning/thinking mode enabled for Feynman analysis and deep conceptual queries (`reasoning: true` on the feynman task type in `config.ts`).
- [x] **17.3: Per-model cost and token logging**
  - [x] Input/output token counts and computed cost are logged after every request (`promptTokens`, `completionTokens`, `cost` fields from `callLLM`/`streamLLM`), now written to `learn_messages`.
- [x] **17.4: Model and parameter configuration by task type**
  - [x] `temperature: 0.3` applied for the Socratic flow (`TASK_CONFIG.socratic`).
  - [x] `responseFormat: 'json_object'` guarantees JSON output for Feynman explanation evaluation.

### ✅ CHECK TASK (Phase 17):
- [x] Model calls are managed through a single client (`api/lib/llmClient.ts`); swapping models is a `config.ts` edit, no repo-wide refactor needed.
- [x] DeepSeek V4 integration works; all models are called via OpenRouter as `deepseek/deepseek-v4-flash`.
- [x] Token usage and cost for every request are captured from `callLLM`/`streamLLM` output and can be logged to the database.

---

## 👤 PHASE 18: Advanced Onboarding & Pre-built Curriculum Concept Trees

Build flows that integrate the student's profile into the system, and add
pre-built academic concept trees. **Deliberately deferred** — not started,
see `PRODUCT_DIRECTION.md`.

- [ ] **18.1: Personalized onboarding flow**
  - [ ] Build an onboarding UI collecting the student's major, academic goals, current knowledge level, and preferred learning style.
- [ ] **18.2: `buildSystemPrompt()` function injecting profile data into the system prompt**
  - [ ] Develop a function that dynamically injects the profile/preference data collected during onboarding into system prompts.
- [ ] **18.3: Pre-loaded curriculum concept trees**
  - [ ] Pre-load concept trees for Electrical-Electronics Engineering, Math, and Physics matching university curricula.

### ✅ CHECK TASK (Phase 18):
- [ ] A newly registered user can set their major and learning-style preference during onboarding.
- [ ] The AI assistant dynamically adjusts its analogies and language to the user's level (e.g. a first-year engineering student).
- [ ] Pre-built concept trees are seeded in the database and viewable in the dashboard/workbench.

---

## 📱 PHASE 19: Mobile Compatibility & PWA (Offline Support)

Adapt the workspace for mobile devices and add PWA integration for offline
support. **Deliberately deferred** — not started, see `PRODUCT_DIRECTION.md`.

- [ ] **19.1: `/learn` workspace mobile adaptation (responsive design)**
  - [ ] Make the left chat area and right Workbench panel collapsible or tab-switchable for mobile screen sizes.
- [ ] **19.2: PWA manifest and service worker integration**
  - [ ] Set up the manifest file and service worker structure to make the app an installable PWA.
  - [ ] Let FSRS flashcard review work from the local IndexedDB cache (Dexie) even without an internet connection.

### ✅ CHECK TASK (Phase 19):
- [ ] `/learn` works on mobile without layout shift, with smooth transitions between chat and workbench tabs.
- [ ] The app can be installed as a PWA on phone/desktop.
- [ ] A flashcard session can be started offline, with ratings stored locally to sync once online.

---

## 🧹 PHASE 20: Documentation-Pass Findings (opened 2026-08-03)

Open items surfaced by the `CLAUDE.template.md` documentation-alignment pass.
These are **code** items — the documentation side is already done. Evidence and
line references for each are in `PROGRESS.md` §7 and §7.1. Nothing here was fixed
in that pass; it was documentation-only under a no-code-change constraint.

- [ ] **20.1: Decide the fate of the stubbed local-cache/bootstrap layer**
  - [ ] `src/lib/cloud/domainSync.ts` is entirely no-op stubs, yet
        `src/app/providers/CloudDataBootstrap.tsx` still branches on
        `getDomainSyncSummary()`. Decide: finish the layer, or delete it and its
        dead branches. Acceptance: no code path in `CloudDataBootstrap.tsx` is
        unreachable, and no doc claims a behaviour the code does not perform.
  - [ ] `src/lib/cloud/localCacheOwner.ts`: `writeLocalCacheOwner` and
        `readLocalCacheOwner` have zero callers, so the owner value is never
        written and always reads `null`. Either wire them or remove them together
        with the two `clearLocalCacheOwner` calls in `authStore.ts` (lines 158, 498).
  - [ ] Answer the open question explicitly: with no local domain cache remaining,
        is cross-user cache isolation still a requirement? Record the answer in
        `ARCHITECTURE.md` §7. Acceptance: the question is answered in the doc, not
        left implied.

- [ ] **20.2: Rewrite `tests/rls/rlsSmoke.test.ts`**
  - [ ] The file mocks `@/config/firebase` and `@/lib/cloud/firebaseRepo`, **neither
        of which exists**, so its Scenario 2 and 3 assertions intercept nothing. Its
        header comment claims a Supabase→Firebase migration, the reverse of what
        happened. Rewrite against `@/lib/cloud/supabaseRepo`. Acceptance: removing
        the mock makes the test fail — i.e. it actually binds to the system under test.
  - [ ] Only Scenario 1 (unauthenticated rejection) is currently meaningful, because
        `@/lib/cloud/currentUser` is the one mock that still binds. Preserve that
        coverage through the rewrite.

- [ ] **20.3: Produce a trustworthy test count**
  - [ ] Run `npm run test -- --run` in a clean checkout and record the result in
        `PROGRESS.md` §6 with the command and date. Acceptance: the four
        contradictory historical counts (343 / 282 / 319 / 321) are superseded by
        one reproducible number.
  - [ ] Investigate the 10 network-dependent failures. Hypothesis on record: tests
        reach the real Supabase client, which `src/config/supabase.ts` points at
        `https://placeholder.supabase.co` when env vars are absent. Acceptance:
        confirmed or refuted with output, not inference.

- [ ] **20.4: Fix onboarding step 6's permanently-broken target**
  - [ ] `OnboardingOrchestrator` step 6 targets `nav-calendar`, but
        `src/app/components/navItems.ts` has no item with id `calendar` (ids are
        overview, tasks, habits, tracker, courses, learn, stats, settings), so the
        step always renders the missing-target fallback in the real app. It is
        invisible in tests because `tests/auth/authFlow.test.tsx` hand-renders a
        `data-onboarding-target="nav-calendar"` stub div. Acceptance: the step points
        at a target that resolves in the running app, or the step is removed and the
        8-step contract updated in `MEMORY.md`.

- [ ] **20.5: Retire `npm run test:e2e` or give it a config**
  - [ ] The script runs `playwright test`, `@playwright/test` is installed, but there
        is no `playwright.config.*` and no spec directory. Acceptance: either a real
        config plus at least one passing spec, or the script and dependency are
        removed. A gate with nothing behind it must not stay documented as a gate.

- [ ] **20.6: Clear the lint-suppression backlog**
  - [ ] Four file-level `eslint-disable` blocks (`src/lib/backup/backupService.ts`,
        `src/lib/backup/exportService.ts`, `src/lib/cloud/plannerRepo.ts`,
        `src/lib/cloud/trackerRepo.ts`) and eight inline `eslint-disable-next-line`
        comments violate `CLAUDE.md` §7.3. Acceptance: `npm run lint` runs to
        completion with zero suppressions, reported with error and warning counts
        separately. Do **not** clear this with a bulk `--fix` (§7.5).

- [ ] **20.7: Remove dead dependencies**
  - [ ] `prop-types` (zero references), `@stripe/stripe-js` (SDK never imported;
        only env-var price-ID strings in `src/config/plans.ts`), and
        `@next/bundle-analyzer` (a Next.js package in a Vite repo). Requires approval
        per `CLAUDE.md` §15. Acceptance: removed, with `npm run build` and
        `npm run typecheck` clean afterwards.
  - [ ] Decide whether `src/config/plans.ts`'s `STRIPE_PRICE_IDS` should stay. There
        is no billing implementation behind it; leaving it implies one exists.

- [ ] **20.8: Remove or implement `VITE_ENABLE_SYNC`**
  - [ ] The flag exists in `.env.example:36` with zero references in `src/` or
        `api/`. Acceptance: either it gates real behaviour, or it is deleted from
        `.env.example`. Docs already record it as dead.

### ✅ CHECK TASK (Phase 20):
- [ ] No document in the repo asserts a behaviour that the code does not perform.
- [ ] `npm run test`, `npm run lint`, and `npm run typecheck` each have a real,
      dated result in `PROGRESS.md` §6 produced by running that exact command.
- [ ] No test in `tests/` mocks a module the repo does not depend on.

- [ ] **20.9: Remove the dead `CONSTANTS.DB_NAME` entry**
  - [ ] `src/config/constants.ts:184` defines `DB_NAME: 'LifeFlowDB'` with zero
        consumers anywhere in `src/`. It is the last textual residue of the removed
        local database and reads as evidence one still exists. Acceptance: removed,
        with `npm run typecheck` clean.
