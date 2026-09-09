# AI Usage

The task explicitly welcomes AI tool usage. Here's exactly how I used it and where I pushed back.

## Tools used

- **Claude Code (Sonnet 5)** — scaffolding, implementation, test generation, UI. All actual file creation.
- **Claude Opus 4.7 (web chat)** — design review and judgment calls: schema design, last-seat race approach, README structure, root-cause analysis when tests failed.

Split rationale: Sonnet is fast and cheap for execution work with clear specs. Opus is worth the extra cost when the answer is "which approach do I defend in an interview," not "type this out for me."

## What I used AI for

- Bootstrapping the Next.js + Postgres + Docker + Vitest scaffold from a spec I wrote by hand
- Writing the migration SQL from a schema I designed and pushed on beforehand
- Implementing the server actions against pre-committed architecture docs
- Generating the Vitest test cases, including the `Promise.all` race test
- Writing the minimal UI (parent flow + admin roster)

## What I did NOT use AI for

- Designing the schema. Done by hand first, argued through with Opus in chat, then handed to Sonnet as a fixed spec.
- The last-seat race approach. Decided (and later corrected) with Opus, not Sonnet.
- This README (structure and design decisions section) — written by hand because the reviewer is judging judgment, not template-following.
- The video walkthrough.

## Where AI helped me move faster

Bootstrapping the scaffold. Sonnet 5 produced a working Next.js + Postgres + Docker Compose + Vitest setup that ran end-to-end on the first try in roughly 15 minutes. Doing this by hand — package.json, tsconfig, docker-compose, migration script, seed script, connection pool — would have been an hour of tedium and I would have gotten one thing wrong that took another 30 minutes to debug.

The value wasn't that Sonnet did anything clever. It was that boilerplate ate zero of the 4-hour budget, leaving the time for the parts that actually decide the outcome.

## Where I disagreed with, corrected, or rejected AI output

During backend design, I initially proposed an atomic UPDATE with COUNT(*) < 4 in the WHERE clause and no explicit locking — believing it was race-safe under READ COMMITTED. Working through the scenarios out loud, the flaw surfaced: the UPDATE takes a row lock on the target booking row, but two different students racing for the same class have two different booking rows. No lock contention. Both COUNT(*) subqueries see a snapshot from before either transaction commits, both see count=3, both pass. Predicate locking that would prevent this only exists under SERIALIZABLE isolation. I revised the design before implementation, adding SELECT id FROM classes WHERE id=$class_id FOR UPDATE at the start of the confirm transaction. This serializes all confirms for one class on the classes row, held for milliseconds — not across the payment call. The race test in tests/race.test.ts runs 20 iterations and consistently passes 20/20.

## What I would change about my AI workflow if I did this again

I split the models deliberately — Opus 4.7 for design and judgment calls, Sonnet 5 for execution — and that division held up. Opus earned its cost on the schema and the race-handling approach; for scaffolding, server actions, test generation, and UI, Sonnet 5 was fully capable and significantly cheaper. What I'd invest even more in next time is the part that mattered most: tight context files (spec, architecture, testing plan, setup) and phase-by-phase prompts. When the context is tight and the prompt is specific, model tier matters much less than prompt quality.

## How I verified the final implementation

- Ran `pnpm test` — all scenarios green including the 20-iteration race test.
- Read the FOR UPDATE + atomic UPDATE SQL by hand and confirmed it matches the design in `docs/architecture.md`.
- Manually walked through the parent flow in two browser tabs to demonstrate the race resolution live.
- Manually caused each failure mode: duplicate booking, payment fail, overbooking attempt.
- Direct DB queries after each test to confirm state matches return values (never trust return values alone).
- Ran the full flow from `docker compose up -d && pnpm db:reset` on a clean state to confirm the reviewer can reproduce.
