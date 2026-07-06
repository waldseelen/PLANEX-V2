# PRODUCT_DIRECTION.md

This file records the decisions from the product-direction discussion held
after the 2026-07-05 Supabase migration. Files like `TASKS.md`/`PROGRESS.md`
describe technical progress; this file describes *why* we're sequencing work
this way.

## Product Identity

The project started as a "workstation": one place for a student to manage
their courses, tasks, and habits. That goal hasn't changed. The STEMA
integration added a second layer on top of it: an AI-powered Socratic STEM
learning assistant.

## Two Layers, One Product

Early on we debated "is planner or STEM the real product." The conclusion:
these aren't two competing products — they're two layers of one product,
serving two different moments in the same academic life.

- **Primary core — Planner / Schedule / Habit**
  The daily entry hook. The reason the user opens the app every day (tasks,
  course schedule, habits, calendar). This space is heavily saturated
  (Notion, Todoist, Habitica, Toggl, Sunsama, etc.) — the goal here isn't to
  out-innovate competitors, just to be solid and frictionless enough not to
  annoy the user.

- **Secondary core — STEM (Socratic learning assistant)**
  The product's actual differentiator. Socratic chat + mistake analysis +
  FSRS spaced repetition together build a personalized "mistake/mastery
  graph" — the more a student uses it, the more valuable it becomes. That's
  a real moat competitors can't easily copy.

## Integration — The Bridge Missing Today

The vision: while a user is managing a course/unit in the planner, they
should be able to naturally drop into the STEM layer when they actually want
to study that course.

Today's code doesn't support this: the `concepts` / `learn_sessions` tables
in the `learn` module aren't linked to the `courses` / `units` tables in the
planner at all — it's a completely separate, floating concept graph. The
concrete work that would make the "integrated" claim real:  add
`course_id`/`unit_id` to `concepts` and `learn_sessions`, and add an entry
point from a planner unit into a STEM session (e.g. a "study this topic"
button).

## Agreed Sequencing

1. **Solidify the primary core.** The user doesn't yet consider planner/
   tracker mature enough — across missing/half-built features, stability/
   bugs, UX/flow, and performance. Since STEM is a newly added major
   feature, the existing foundation gets solidified first.
   - Next step: audit planner/tracker through real usage (navigating via the
     dev server + checking network/console) to produce a concrete list of
     issues, then fix based on that list.
2. **Build the integration bridge.** Link `concepts`/`learn_sessions` to
   `courses`/`units`, add natural entry points from planner into STEM.
3. **Focus STEM on a single loop.** Socratic chat + mistake analysis + FSRS
   spaced repetition. Everything else listed in `PROGRESS.md` — whiteboard,
   mindmap / React Flow knowledge graph, CS sandbox, exam generator, INCUP
   (ADHD) adaptations — is deferred for now. These are visually appealing
   but currently a distraction, repeating the "touching too many things at
   once" risk.
   - Priority in this step goes to things that don't show but make the loop
     actually work well: prompt quality, latency, cost, mastery-scoring
     accuracy. Visual flourishes don't matter until the core Socratic
     teaching is excellent.

## Deliberately Deferred

- Whiteboard / agent drawing engine deepening
- Mindmap / React Flow knowledge graph (Phase 8.2, 9)
- CS and Algorithm Sandbox (Phase 12)
- Smart Exam Generator (Phase 13)
- INCUP (ADHD) adaptations (Phase 14)
- Advanced onboarding & pre-built curriculum trees (Phase 18)
- Mobile/PWA (Phase 19)

These aren't bad ideas — their time just hasn't come. We won't move on to
them until the primary core, the integration bridge, and STEM's single loop
are solid.
