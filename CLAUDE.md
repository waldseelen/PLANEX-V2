# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and any other coding
agent working in this repository.

---

# Part 1 — This repository

## 0. Required read order

Read this file first, then the companions in this order, before executing
anything:

1. `CLAUDE.md` — this file: rules that bind a change
2. `ARCHITECTURE.md` — how the system is put together
3. `MEMORY.md` — durable non-obvious facts about how this repo behaves
4. `PROGRESS.md` — current gate status, blockers, session history
5. `TASKS.md` — the work queue; execute only items marked `[ ]`
6. `README.md` — human-facing orientation, read last

Treat 1–5 as one instruction set. Any of the five companions that is missing
gets created on your first session here — see §3.1.

**Read order is not trust order.** When two sources disagree, §4 decides —
live code outranks every document in this list, including this one.

## 1. Project identity

PLAN.EX V2 ("Plan. Execute. Be Expert.", codename STEMA) is a **single-page
React app with a Supabase backend and a small set of Vercel edge functions**. It
serves two layers of one product: a **planner/tracker** productivity core
(courses, units, tasks, habits, time tracking, goals, reminders) and **STEMA**, a
Socratic STEM learning layer (AI tutor chat, Feynman referee, mistake
classification, FSRS spaced repetition, whiteboard, mindmap). A public landing
page at `/` is the only unauthenticated surface; everything else is gated.

**The misconception to arrive with is that this is a "Dexie-first hybrid."** It
is not, and several documents said so for months. `dexie` is **not** a dependency
in `package.json`, there is no `from 'dexie'` import anywhere in `src/`, and the
`PlannerDatabase` / `LifeFlowDB` classes do not exist — `LifeFlowDB` survives
only as a string constant (`DB_NAME` at `src/config/constants.ts:184`).
`src/db/planner/database.ts` and `src/db/time-tracking/database.ts` are stubs
(`export const plannerDb = {} as Record<string, unknown>`, `clearPlannerData()`
with an empty body). **Supabase is the sole persistence path today**; every file
under `src/db/**/queries/**` reads through `useSupabaseQuery` + repo functions.
`src/db/` is a legacy directory name, not a local database.

**The real current-vs-target gap is elsewhere, and it is a correctness gap, not a
migration gap.** The local-cache and bootstrap layer was reduced to no-ops but
its callers were left in place:

- `src/lib/cloud/domainSync.ts` — `getDomainSyncSummary()` unconditionally
  returns `hasCloudData: false, hasLocalData: false, ownerMismatch: false`;
  `clearLocalDomainCaches`, `hydrateLocalCacheFromCloud`, and
  `migrateLocalDataToCloud` all have empty bodies.
- Because `src/app/providers/CloudDataBootstrap.tsx` branches on that summary,
  **the owner-mismatch cache-clear branch and the local-data import prompt are
  unreachable at runtime.** Only the final `ensureRemoteUserDefaults()` path can
  execute.
- `src/lib/cloud/localCacheOwner.ts` is half-dead: `clearLocalCacheOwner` is
  called twice from `authStore.ts` (lines 158, 498), but `writeLocalCacheOwner`
  and `readLocalCacheOwner` have **zero callers** — the owner value is never
  written, so it is always `null` and nothing ever reads it.

**Consequence: the cross-user local-cache isolation guarantee that several docs
asserted is not enforced by this layer.** Whether it still needs to be enforced
now that there is no local domain cache to mix is an open question — it is
recorded as open work in `TASKS.md`, not answered here. Do not write a doc or a
code comment that claims this isolation is active.

**Stack** (verified against `package.json`): React 19.2 + React DOM 19.2,
TypeScript ~7.0.2, Vite 8.1, Tailwind CSS 4.3 (via `@tailwindcss/postcss`),
React Router 7.18, Zustand 5.0 (UI state only), Framer Motion 12.42,
`@supabase/supabase-js` 2.110, Zod 4.4, Luxon 3.7, echarts 6.1 +
`echarts-for-react`, `lucide-react` 1.27, `reactflow` 11.11,
`@excalidraw/excalidraw` 0.18, katex + `react-katex`, `@dnd-kit`. Testing is
Vitest 4.1 + Testing Library 16.3 + jsdom 29 + `fake-indexeddb` 6.2. Lint is
ESLint 10 + `typescript-eslint`.

**Dependencies that are installed but dead** — do not treat their presence as
evidence a feature exists:

- `prop-types` — zero imports in `src/`, `api/`, or `tests/`.
- `@stripe/stripe-js` — the SDK is never imported. Only `src/config/plans.ts`
  mentions Stripe, and only as env-var-backed price-ID strings
  (`STRIPE_PRICE_IDS`). **There is no billing implementation.**
- `@next/bundle-analyzer` — a Next.js package in a Vite repo; bundle analysis
  actually runs through `rollup-plugin-visualizer` in `vite.config.ts`.

**Hosting / runtime:** Vercel (`planex-v2.vercel.app`), SPA bundle plus
`api/*` edge functions. Supabase provides Postgres (RLS-protected), Auth
(Google + GitHub OAuth only), and Storage (`avatars`, `documents` buckets).
LLM calls go out through OpenRouter via `api/lib/llmClient.ts`.

## 2. Commands

```bash
npm run dev          # clean:cache && vite  — dev server on http://localhost:3000
npm run build        # clean:all && tsc -b && vite build
npm run lint         # eslint .
npm run typecheck    # tsc --noEmit
npm run test         # vitest (watch mode; add -- --run for a single pass)
npm run test:ui      # vitest --ui
npm run test:e2e     # playwright test  — SEE WARNING BELOW
npm run preview      # vite preview
npm run clean:cache  # rimraf node_modules/.vite
npm run clean:all    # rimraf dist
```

These ten are the complete script list in `package.json`; there are no others.

**`npm run test:e2e` is a gate with nothing behind it.** The script exists and
`@playwright/test` is installed, but there is **no `playwright.config.*` anywhere
in the repo** and no e2e spec directory. Do not cite it as coverage.

**`ANALYZE=true npm run build` is not a script**, and the inline `VAR=value cmd`
prefix is not valid PowerShell (§17). `vite.config.ts:23` does read
`process.env.ANALYZE === 'true'` to enable `rollup-plugin-visualizer`, so the
capability is real — invoke it as `$env:ANALYZE='true'; npm run build`.

The primary correctness gate is `npm run typecheck` plus `npm run test`. Current
results and when each was last actually run live in `PROGRESS.md` — never here
(§7.2). **Do not cite a test count from any document without re-reading §7.7 and
the `rlsSmoke` note in `PROGRESS.md` first.**

## 3. Document hierarchy — one fact, one home

Each document owns its subject. Link to the owner instead of restating it, and
never assert the same fact in two files. When a duplicated fact goes stale, it
goes stale in every copy at once, and nothing tells you which copy is the lie.

| Subject                                        | Owner |
| ---------------------------------------------- | ----- |
| Conventions, patterns, binding rules           | `CLAUDE.md` (this file) |
| Structure, blueprint tree, runtime boundaries  | `ARCHITECTURE.md` |
| Durable non-obvious repo facts                 | `MEMORY.md` |
| Dates, session history, gate status            | `PROGRESS.md` |
| Work queue — phases, tasks, subtasks           | `TASKS.md` |
| Human/GitHub orientation, features, setup      | `README.md` |
| Agreed product priority order and why          | `PRODUCT_DIRECTION.md` |
| Known tech debt in the planner/tracker UI layer| `feature_quality_report.md` |
| Security findings and rejected-finding ledger  | — |

`AGENT.md` is intentionally a pointer stub to this file. It owns nothing; do not
move a rule into it.

Two exclusivity rules fall out of this table and are worth stating outright:

- **`PROGRESS.md` is the only file that carries a date or a ✅.** A line
  anywhere else that would go stale belongs there.
- **`TASKS.md` is the only file that carries `[ ]` / `[x]`.** Do not track work
  with checkboxes in any other document.

`PRODUCT_DIRECTION.md` and `feature_quality_report.md` are the two exceptions
allowed to carry a date, because each records *when a decision or an observation
was made* rather than what is true now. The exception is narrow:

- A dated line in either file must read as history — "observed on `<date>`" — and
  must not be phrased as current status.
- Neither file is the owner of any gate result or test count. Where one quotes a
  number it observed at the time, **`PROGRESS.md` §6 remains the owner of the
  current figure**, and the quoting file must say so. `feature_quality_report.md`
  quotes two historical test counts under that rule; §6 adjudicates them and
  supersedes both.
- Neither file may be updated with a *new* gate result. That goes to
  `PROGRESS.md`.

A row marked `—` has no owner in this repo; that subject then lives here, once.

### 3.1 Companion documents — create any that is missing

**At the start of your first session in this repository, check which of the five
companion docs exist. For each one that does not, scan the repo and write it.**
Do not ask first; do not stub it with placeholders. Announce which ones you
created.

Rules that bind this pass:

- **Scan before writing.** Read `package.json` and the lockfile, walk the source
  tree, and open the files that carry the answers. Every statement must come
  from something you read — never from a framework's usual layout, the project
  name, or a dependency that is listed but never imported.
- **An empty section is correct; an invented one is not.** On a brand-new repo
  most sections are headers with a one-line "nothing here yet." That is the
  honest state. A guessed architecture is a lie the next agent will build on.
- **Never overwrite a doc that already exists.** If it exists but contradicts
  the code, do not silently rewrite it: report the drift and ask.
- **Respect the ownership table above.** A fact belongs in exactly one of these
  files. When you are about to repeat something, link to its owner instead.

What each file owns:

**`ARCHITECTURE.md`** — structure and runtime boundaries, present tense, no
history and no status. Sections: system shape (including what is deliberately
absent — no backend, no auth, no multi-tenancy; absences prevent more wrong code
than presences) · **blueprint tree** of directories and meaningful files, one
trailing comment each, with generated output marked · data flow traced end to
end for one request, plus the routes that bypass it · layer/dependency rules ·
key subsystems whose behavior is not inferable from one file, each with its
entry point and governing invariant · extension seams and what adding one costs ·
external services and what breaks when each is missing, keys only, never values ·
generated-file source→output pairs.

**`MEMORY.md`** — durable non-obvious facts about how this repo actually
behaves, as a flat bullet list. The test for a line belonging here: *if it would
ever need a date, a ✅, or a version pin, it belongs in `PROGRESS.md` or
`ARCHITECTURE.md` instead.* Good entries are the traps: a helper that returns
`null` on failure so every caller must guard, two enforcement points that must
change together, a dependency that is installed but dead, a surface that looks
CMS-driven but is static. This file rots into a second changelog faster than any
other — keep dates out of it.

**`PROGRESS.md`** — the only file that carries a date or a ✅. Two sections:
`## Current Gate Status` (one row per gate: command, result, when it was last
actually run) and `## Session History` (one dated entry per session, newest
first — what changed, what was verified, what was left open). Never record a
gate as passing without having run that exact command in the current checkout.

**`TASKS.md`** — the only file that carries checkboxes, and the execution source
of truth. Structure: `## Phase N — <name>` → `- [ ] N.M <task>` →
`  - [ ] N.M.x <subtask>`. Each task states its acceptance condition, not just
its title. `[x]` means completed **or intentionally skipped**; never redo or
re-audit a closed item unless it is explicitly reopened. Execute only `[ ]`
items. See §8 for what earns an `[x]`.

**`README.md`** — for humans and GitHub, not for agents: what the project is and
who it is for, feature list, tech stack, setup and run instructions, env-var
table by key with a short description each. No gate status, no session history,
no agent rules — those have owners above.

## 4. Decision order on conflict

When sources disagree, trust them in this order:

1. Live code, configs, manifests, scripts, and the current filesystem.
2. The work queue (§3) for what to do next.
3. The progress doc (§3) for current health, blockers, and priorities.
4. Architecture and memory docs (§3) for stable context.
5. `README.md` for user-facing setup.
6. Historical artifacts — build logs, deleted docs, old plans — as background only.

`TASKS.md` describes a target end state and predates two backend migrations.
Several of its phase checkmarks were aspirational when written and were later
proven false against the code — cross-check any "done" mark in it against the
source before trusting it. `PROGRESS.md` carries the correction record.

## 5. Architecture

The full picture — system shape, blueprint tree, data flow, folder
responsibilities, the route table, and dependency rules — lives in
**`ARCHITECTURE.md`**. Read it before touching structure. Only the rules-shaped
parts live here.

The three files that are current-state truth when a document and the code
disagree, in this order:

1. `src/app/App.tsx` — the route tree and the public/protected split.
2. `src/modules/auth/store/authStore.ts` — auth, profile completion,
   onboarding state, and preference sync.
3. `src/app/providers/CloudDataBootstrap.tsx` — what actually happens on first
   authenticated render (read it together with `src/lib/cloud/domainSync.ts`,
   whose no-op stubs make most of the bootstrap branches unreachable — §1).

Layering, one way only:

```
src/app/  →  src/modules/  →  src/db/*/queries/  →  src/lib/cloud/*Repo.ts  →  Supabase
                                        ↑
              src/shared/, src/config/, src/i18n/   (cross-cutting)
```

`api/*` is a separate server-side tree and must never be imported from `src/`.
The service-role Supabase client lives only in `api/lib/supabaseEdge.ts`.

## 6. Absolute rules for this repository

### Auth and landing

1. **Keep Google and GitHub as equal-weight providers**, and do not add
   email/password flows without user approval. The provider set is enforced in
   `authStore.ts`; adding a third path means a second identity contract to keep
   RLS-consistent.
2. **`/` stays the public landing and protected routes never render without
   auth.** `ProtectedRoute` / `AuthGuard` gate everything else, and
   `PublicLandingRedirect` sends an authenticated user to profile setup or
   `/planner`. Bypassing the guard leaks an authenticated shell to a signed-out
   user. (`src/app/App.tsx`)
3. **Keep landing to one primary OAuth entry surface**, text-and-card driven.
   Do not reintroduce a duplicate final CTA block and do not turn it into a
   screenshot-heavy marketing page unless explicitly asked.
4. **Keep theme and language controls visible on landing and profile-setup
   surfaces.** These are the only surfaces a signed-out user can reach, so a
   user who cannot read the default locale has no other way to change it.
5. **The header theme toggle stays icon-only and binary** (light/dark quick
   override). The `system` option belongs in Settings, not the header.
6. **When adding a new state to an auth surface, add a short explanatory line,
   not just a spinner.** The auth flow has four distinct waiting states
   (initial loading, redirect pending, profile loading, bootstrap loading) and
   a bare spinner makes them indistinguishable when one hangs.

### Profile and onboarding

1. **Required profile fields are `full_name`, `occupation`, and
   `student_status`.** `school` and `department` become required only when
   `student_status` is `student` or `both`.
2. **Avatar upload is optional** and available later at `/settings/profile`.
   Never make it a blocker in the completion flow.
3. **Onboarding stays an in-product overlay, not a standalone page**, and must
   remain restartable from Settings.
4. **Keep visible `skip`, keyboard control, reduced-motion support, and the safe
   fallback for a missing target.** The fallback is load-bearing, not defensive
   polish: onboarding step 6 targets `nav-calendar`, and no nav item with that
   id exists (`src/app/components/navItems.ts`), so that step **always** renders
   the fallback. Remove the fallback and the flow breaks outright. See
   `MEMORY.md` for the step contract and `TASKS.md` for the fix.

### Data layer

1. **Supabase is the only persistence path. Do not reintroduce Dexie or any
   local domain database.** `src/db/` is a legacy folder name whose
   `database.ts` files are empty stubs (§1). Adding a real client-side DB back
   would recreate the dual-source-of-truth problem this repo already migrated
   out of twice (Dexie → Firestore → Supabase).
2. **All query files under `src/db/**/queries/**` use `useSupabaseQuery` plus a
   repo function.** `useLiveQuery` does not exist in this codebase — it survives
   only in three explanatory comments. Do not add a query hook that talks to
   Supabase directly from a component.
   (`src/shared/hooks/useSupabaseQuery.ts`)
3. **Mutate domain data only through `plannerRepo` / `trackerRepo`**, never by
   calling the Supabase client from a component or a store.
   (`src/lib/cloud/plannerRepo.ts`, `src/lib/cloud/trackerRepo.ts`)
4. **Call `invalidateTables([...])` after a mutation.** `useSupabaseQuery` is a
   pub/sub cache with no automatic revalidation — a mutation without an
   invalidation leaves stale rows on screen with no error.
   (`src/lib/cloud/queryInvalidation.ts`)
5. **Do not persist domain business data in Zustand.** Zustand holds UI state
   only (`trackerUIStore`, `plannerAppStore`). Domain rows live in Supabase.
6. **Any new cloud table or sync flow assumes user-scoped rows and RLS from the
   start**, matching the `auth.uid() = user_id` pattern in
   `supabase/migrations/`.
7. **Do not build new behavior on `domainSync.ts` or `localCacheOwner.ts`
   without reading §1 first.** Both are stubbed; their callers still branch on
   values that can never change. Treat any claim that local-owner isolation is
   enforced as unverified.
8. **`SUPABASE_SERVICE_ROLE_KEY` is server-only.** It is read exclusively by
   `api/lib/supabaseEdge.ts`. Never expose it under a `VITE_` prefix and never
   import `api/lib/*` from `src/`.

### TypeScript and imports

1. **Strict mode is expected; avoid `any`.** Where `any` already exists it is
   debt, not precedent.
2. **Use `@/` imports for `src/` paths**, not deep relative chains.
3. **Keep auth/profile types aligned with the remote `profiles` model** and with
   the generated `src/types/supabase.ts`. A drifted type here fails at runtime,
   not at compile time, because the client casts the row.

### i18n and accessibility

1. **All user-facing strings go through i18n, and `tr` and `en` are updated in
   the same change.** A key added to one locale only is a shipped bug in the
   other.
2. **Use full-path namespaced keys.** Locale files wrap their contents under the
   namespace name, so the key is `t('onboarding.progress')`, never
   `t('progress')`. See `MEMORY.md`.
3. **Auth, public, and onboarding copy lives in the `auth` and `onboarding`
   namespaces** — check those first before adding a key elsewhere.
4. **Preserve accessible announcements for route changes and onboarding state
   changes**, and keep landing, profile setup, and onboarding as usable on
   mobile as on desktop.

### UI and design tokens

1. **Card, modal, and sidebar backgrounds use monochrome surface tokens only**
   (`bg-surface-100/200/300`). Accent-tinted card backgrounds are forbidden —
   colour in this design system carries status meaning, so a tinted container
   reads as a state the component is not in.
2. **Icon containers are `bg-surface-200 text-text-secondary`.** No
   accent-tinted decorative icon backgrounds.
3. **Status and urgency are expressed as a dot, a `border-l`, or an outline
   badge — never as a filled card background.** Data colour (`course.color`) is
   the exception and belongs on the course stripe, calendar dot, and progress
   bar only.
4. **Shadows stay near-zero**: `var(--shadow-card)` generally, and
   `var(--shadow-card-elevated)` only on floating panels.
5. **Prefer the repo's utility classes and design tokens over inline styles or
   hardcoded colours**, so light/dark stays automatic. Token *values* are
   documented in `MEMORY.md`; do not restate them here.
6. **All motion comes from `src/config/motion.ts`.** Use its `duration` and
   `easing` exports; do not introduce a one-off duration or easing curve at a
   call site. **Spring/overshoot easing is deliberately absent from that config
   and must not be reintroduced.**
7. **Buttons are `rounded-lg`** with `active:scale(0.985)` and a `-translateY(1px)`
   hover, matching the existing component set.
8. **`reduced-motion` is respected across every animation** (§13.5).

---

# Part 2 — Portable engineering rules

These hold across all my projects. They exist because each one has already been
broken at least once, in this codebase or a sibling.

## 7. Verification and gates

1. **Never record a gate as passing without running that exact command in the
   current checkout.** Quote the output or say you did not run it. A ✅ that no
   machine produced decays into fiction the moment a dependency shifts.
2. **A gate's current result lives in exactly one file** (§3). Do not restate it
   here, in the README, or in a session note.
3. **Never add a lint-suppression comment** (`eslint-disable`, `@ts-ignore`,
   `# noqa`). Fix the violation or report it. Zero suppressions in a tree is an
   invariant worth keeping, not a coincidence.
4. **Never edit the ruleset to get past one file.** Changing lint or compiler
   config is a deliberate decision made with the user, not a way around an error.
5. **Do not run a bulk autofix to clear a backlog.** Report what the linter
   finds first; a repo-wide `--fix` produces a diff nobody can review.
6. **Report error and warning counts separately.** Under `--max-warnings=0` a
   warning fails the command, so "it passes except for warnings" is not a thing.
7. **A test count is not evidence.** Before citing "N tests passing", check what
   they assert. A test that mocks away the system under test — a suite mocking a
   module the repo no longer depends on, a stub that always resolves — is
   theater, and it passes forever.
8. **Name what your validator does not cover.** If a check script validates
   file A but not the config in file B, say so where the script is documented.
   Silent gaps are where runtime breakage hides.
9. **A known-broken gate gets documented, not worked around.** Record the cause,
   why it is not your change's fault, and what a real fix looks like. Do not
   downgrade a dependency or rewrite rules to make the symptom disappear.
10. **If validation cannot run locally, say exactly why** and record it in the
    progress doc — and in the work queue if it becomes work.

## 8. Definition of done

1. **A cross-cutting fix requires grepping every other occurrence of what you
   replaced, not just the cited `file:line`.** Fix all of them or explicitly
   list which remain and why. One call site fixed while its siblings keep the
   old broken code is a partial mitigation — do not report it as done.
2. **A value derived from the same inputs in more than one place must be
   computed by one shared function**, imported everywhere it is needed. Two
   independent implementations of the same rule drift the moment one is touched
   and the other is not.
3. **Paired contracts must be grepped in both directions.** Event dispatch ↔
   listener, parallel data files that must stay in lockstep, two independent
   copies of an auth check, a generated file and its source. These fail with
   zero error, warning, or visual sign — the action just silently does nothing.
4. **Never report a batch action as a blanket success if any item was silently
   skipped.** State what happened per item-class — completed vs. skipped and
   why — instead of one message covering all of them.
5. **A task is complete only once traced end to end**: every other call site of
   the same operation checked, and the affected user flow reasoned through with
   concrete inputs, or exercised in a browser. "A diff exists at the cited line"
   is not completion.
6. **If full verification was not possible, say so explicitly** rather than
   marking it done anyway.

## 9. Working method

1. **Trace the affected flow before editing:** route/entrypoint → component →
   helper/query → type/schema → external service. Edit after you have seen the
   whole chain, not after you have found the first plausible line.
2. **Keep the change as small as possible while still closing the task.** Do not
   quietly expand into unrelated cleanup. Many files contain older or unused
   patterns that should not be mass-cleaned unless that is the task.
3. **Never present a guess as a fact.** Write assumptions, risks, open
   questions, and TODOs explicitly.
4. **When code and documentation disagree, trust the code and document the
   drift.** Stale docs are poisoned context: an agent reading a wrong
   architecture file writes wrong code with full confidence.
5. **Label scaffolding as partial, never complete.** A feature that exists only
   as placeholders, demo data, or a `501` is not a feature. Do not advertise
   placeholder routes as working.
6. **Never collapse current state into target state.** If the repo is mid-
   migration, call the current system what it is and the intended one what it
   is. Do not describe a migration as finished unless you finished it.
7. **If you touch a scaffolded feature, either finish the user-visible path end
   to end or record the remaining gap** in the work queue.
8. **Read the rejected-findings ledger before reporting anything as a finding.**
   Items already investigated and refuted are recorded with their reasons (§3).
   Re-reporting them is noise that costs a review cycle every time. If you
   disagree with a rejection, argue against the recorded reason — do not re-file
   the finding as new.
9. **`[x]` means completed *or intentionally skipped*.** Do not redo, re-audit,
   or re-report a closed item unless it has been explicitly reopened.

## 10. Architecture invariants

1. **Respect the repository's one-way dependency flow.** Layers are declared in
   §5; do not add an import that points backwards through them.
2. **UI components stay dumb.** No business logic, no derived-value computation,
   no direct state mutation beyond dispatching an action. All "thinking" lives
   in the engine/service/lib layer.
3. **Data files contain data.** Never put functions, logic, or computed values
   inside a JSON/config module that is loaded as pure configuration.
4. **No God components.** Split by responsibility using the existing component
   boundaries. The test is unrelated concerns living in one file, not a line
   count — size is the smell that makes you look, not the verdict.
5. **Extend through the existing seam.** When a pattern already exists — a
   strategy object per provider, a registry, a per-domain descriptor — add to it
   rather than branching around it.
6. **Do not introduce a competing dependency or paradigm without approval.** No
   second state manager, no second styling system, no second HTTP client, no
   second date library. Use what is already here.
7. **Never edit generated output.** Edit the source and regenerate. Generated
   files are listed in §5.

## 11. Data and persistence

1. **Never hard-delete user history.** Use soft-delete or archive fields
   (`active: false`, `deleted_at`, `archived: true`). Historical records and
   relations must stay intact.
2. **Server-only credentials must never be reachable from the client.** Keep the
   admin/service-role client in a server-only module, and never expose a service
   key under a client-visible env prefix.
3. **Any new cloud table or sync flow assumes user-scoped rows and enforced
   access rules from the start** — not as a follow-up hardening pass.
4. **Do not add a direct client read/write path around the server layer** when
   security rules deny direct client access. The shortcut is the vulnerability.
5. **Match the id type as it actually exists, not as it was designed.** If ids
   are a `number | string` union because of legacy rows, never validate with
   `Number(id)` and never sort with `a.id - b.id` — both silently reject or
   `NaN` the other half. Use the repo's shared validator and comparator.
6. **A value that round-trips through a client control arrives as a string.**
   Look up the real entity and use its native id; do not coerce the raw control
   value.
7. **Any new outbound fetch to a user-supplied URL applies the repo's SSRF
   guard**: reject non-http(s) schemes, localhost and internal TLDs, private,
   loopback and link-local ranges, and the cloud metadata address.
8. **Security headers are centralized**, not duplicated per route.

## 12. Load-bearing configuration

Some config exists because removing it causes a *silent* failure — the build
succeeds, nothing errors, and the output is quietly wrong.

1. **Label load-bearing config at the site**, with the failure it prevents.
2. **A cleanup or dependency pass never removes labeled config**, however
   redundant it looks.
3. **Before deleting any flag, override, or resolution field, find out what it
   prevents.** "Nothing broke when I removed it" is only evidence if you checked
   the artifact, not just the exit code.

Real cases in this repo:

- **The `|| 'https://placeholder.supabase.co'` fallback in
  `src/config/supabase.ts`.** When `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
  are absent, `createClient` is still constructed against a placeholder host so
  the landing page renders instead of crashing at import time. The cost is that
  **any code path reaching the network in that state fails at request time, not
  at startup** — including tests, which is the most likely explanation for the
  network-dependent test failures recorded in `PROGRESS.md`. `isSupabaseConfigured`
  is the flag to branch on; do not remove it and do not assume a constructed
  client means a configured one.
- **`fake-indexeddb/auto` in `tests/setup.ts`.** It polyfills the browser
  IndexedDB API for jsdom. It is **not** Dexie usage and its presence is not
  evidence of a local database — but removing it will break any test that
  touches a browser storage API.
- **`process.env.ANALYZE` in `vite.config.ts:23`.** Gates
  `rollup-plugin-visualizer`. Not a `package.json` script — see §2 for how to
  invoke it on PowerShell.

**Documented gap — `VITE_ENABLE_SYNC` is dead.** It appears in `.env.example`
only; there are **zero references in `src/` or `api/`**. Docs previously
described it as enabling local-to-cloud bootstrap. It does not enable anything.
Do not branch on it, and do not document it as functional.

## 13. Time, locale, and accessibility

1. **Never derive "today" from `new Date().toISOString()` or any raw local/UTC
   value.** Go through the repo's single date helper. Raw dates drift by a day
   at night for anyone not on UTC.
2. **One date choke-point, not a repeated inline expression.** If the same date
   extraction appears at several call sites, it becomes one exported function.
3. **All user-facing strings go through i18n**, and every locale file is updated
   in the same change. A missing key in the second locale is a shipped bug.
4. **Use full-path namespaced keys** exactly as the locale files nest them.
5. **Respect `prefers-reduced-motion`** in every animation.
6. **Never unmount or route-suppress a global layout component without
   verifying both viewports.** Responsive containers (`sm:hidden` /
   `hidden sm:block`) must cover mobile and desktop with no dead zone where
   nothing renders.

## 14. UI contracts

1. **Prefer the repo's existing utility classes and design tokens over inline
   styles or hardcoded colors**, so light/dark support stays automatic.
2. **`z-index` only ranks within the nearest ancestor stacking context.**
   `position` + `z-index`, `opacity < 1`, `transform`, `filter`, and
   `backdrop-filter` each create one. Raising a descendant's z-index cannot make
   it outrank anything outside an ancestor that already has one — fix the
   ancestor.
3. **Motion stays consistent with the repo's central motion config.** Do not
   introduce a one-off duration or easing curve at a call site.

## 15. Changes that need approval first

Ask the user and wait before:

- Schema, migration, or data-layer model changes.
- Changing route structure or deleting existing pages.
- Adding or reshaping a global store's contract.
- Changing global CSS, design tokens, or the styling framework config.
- Adding, removing, or upgrading a dependency.
- Any `git commit`, `git push`, branch creation, or PR.
- Anything that touches production data, deployment settings, or secrets.

Repo-specific additions to that list:

- **Anything under `src/db/**`** — schema, types, or query-module shape.
- **The route structure in `src/app/App.tsx`**, and **deleting any existing
  page component**.
- **Adding a new Zustand store, or substantially changing an existing store's
  contract** (`trackerUIStore`, `plannerAppStore`).
- **`tailwind.config.js` and `src/index.css`** — the design-token source pair.
  They must change together; the Tailwind config resolves CSS custom properties
  defined in `index.css`, so editing one alone produces classes that silently
  resolve to nothing.
- **`supabase/migrations/**` and any RLS policy.**
- **`vercel.json`, `vite.config.ts`, and the `api/*` runtime surface.**

## 16. Reporting work

1. **One dated entry per session**, in the progress doc named in §3 — and
   nowhere else. Session notes scattered across files become parallel
   changelogs that contradict each other.
2. **Update gate status only if you ran a gate**, in the one file that owns it.
3. **Report outcomes faithfully.** If tests fail, say so and include the output.
   If a step was skipped, say that. When something is done and verified, state
   it plainly without hedging.

## 17. Environment notes (Windows)

1. Two shells are available and they take different syntax. Use PowerShell 7 for
   Windows tooling and `git`; use Bash only for POSIX scripts. Do not mix them.
2. Prefer absolute paths. Do not prefix commands with `cd`.
3. Interactive flags do not work here: no `git rebase -i`, no `git add -i`, no
   command that opens an editor or prompts on stdin.
4. Use dedicated file/search tools rather than shell `grep`/`cat`/`sed`.
5. Long-lived processes (dev servers, watchers) are started through the launch
   config, not as a foreground shell command.

---

## Doc trust note

Everything in Part 1 was written against this repository's source tree and is
expected to be re-verified whenever it looks wrong. If a statement here
contradicts the code, **the code wins** — fix this file in the same change and
say what drifted.

Part 2 is shared across projects and is edited at the canonical copy
(`DEV/CLAUDE.template.md`), then re-synced. Do not fork it in place: a copied
rule file that gets locally patched is how the same rule ends up saying two
different things in two repos.
