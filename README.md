# Ottodot Trial Booking

Trial class booking system. Parent picks a class for their child, pays, gets confirmed. Trial classes capped at 4 students.

Built for the Ottodot Full-Stack Engineer take-home.

## Run it

```bash
# Prerequisites: Node 20+, pnpm, Docker Desktop

pnpm install
cp .env.example .env.local    # DATABASE_URL uses port 5443
docker compose up -d
pnpm db:reset                 # migrate + seed
pnpm dev                      # http://localhost:3000
pnpm test                     # all scenarios including 20x race test
```

Admin roster: `http://localhost:3000/admin`

For full setup details, troubleshooting, and repo layout see [`docs/setup.md`](docs/setup.md).

## Setup notes

- `vitest.config.ts` has a `resolve.alias` mapping `@` → project root. Vite doesn't read `tsconfig.json` paths, so this is required for Vitest to resolve the `@/lib/db` imports. `tsc` and `tsx` handle it natively.
- `app/page.tsx` is a server component that fetches data and renders a single client component `app/_components/parent-flow.tsx`. Kept this split because `router.refresh()` re-runs server components — a fully client-side page would refresh into itself and stale-cache the class list after "Book another".

## Time spent

Roughly 3 hours total, across two phases.

**Design — Claude Opus 4.7 (web chat)** — ~1.5 hours
Schema, trust boundaries, and the last-seat race approach. I tested the race 
handling out-of-repo first — a scratch implementation to prove the design 
before committing to it. That's where I caught and corrected the original 
race condition flaw (see AI_USAGE.md): the first design looked atomic but 
didn't actually serialize two different bookings racing for the same class. 
This phase took longer than the build because getting the concurrency model 
right up front is what made the actual build fast and clean.

**Build — Claude Code (Sonnet 5)** — ~1 hour
- Scaffold + schema + seeds: ~15 min
- Server actions (booking, payment, roster): ~15 min
- Automated tests, incl. 20x race test: ~10 min
- Minimal UI + admin occupancy: ~15 min

Build was fast because the design was already settled and proven — Sonnet 
was implementing a known-correct approach, not exploring one. Each phase 
still included my own review: reading generated SQL against the design doc, 
verifying transactional wrapping, running manual DB queries to independently 
confirm test claims.

**Docs** — ~30 min
README + AI_USAGE.md.

## What was built

**Parent flow** (`/`)
- Pick student and available class
- Submit booking → creates `PENDING_PAYMENT` booking + `PENDING` payment
- Mock payment with two buttons (success / fail)
- Final status screen with "Book another" that resets state and re-fetches server data

**Admin flow** (`/admin`, `/admin/[classId]`)
- List of all classes with `confirmed / capacity` occupancy display
- Roster of confirmed students per class

**Backend**
- Server actions in `app/actions/`: booking, payment, roster
- All correctness invariants enforced in Postgres, not application code
- Race-safe last-seat confirmation via `SELECT ... FOR UPDATE` on the classes row + atomic UPDATE with capacity check

**Tests**
- Vitest against real Postgres (no DB mocks)
- All 6 scenarios from the task requirements
- Last-seat race test runs 20 iterations to catch flakes

## Assumptions

- Parent identity is a text field on `students`, not a separate table. Without auth, "parent" is a label on a student.
- Payment mock is deterministic (two buttons). Real payment provider integration would be webhook-driven, not synchronous.
- `PAYMENT_FAILED` is terminal. Parent creates a new booking to retry.
- Trial capacity of 4 is a fixed rule, encoded as a hard-coded `< 4` in the atomic UPDATE. Kept explicit for clarity; would move to a config or per-class capacity column in production.
- Server actions return errors as values for invalid inputs (`PAYMENT_NOT_FOUND`, `BOOKING_NOT_PENDING`, `CLASS_OR_STUDENT_NOT_FOUND`, `INVALID_PAYMENT_RESULT`, `BOOKING_NOT_FOUND`, `CLASS_NOT_FOUND`) rather than throwing. Keeps failure modes explicit and testable. `throw` reserved for genuinely unexpected conditions.

## Key architecture and backend decisions

### Data model

Four tables: `students`, `classes`, `bookings`, `payments`.

Booking has its own state machine (`PENDING_PAYMENT → CONFIRMED | PAYMENT_FAILED`). Payment has its own status because payment attempts and booking outcomes aren't 1:1 conceptually — a booking can fail because the parent's payment declined, or because the seat was lost between payment and confirmation. Different reasons, different reversal semantics.

### Trust boundary

Applied the rule: **UI checks are UX, backend checks are ergonomics, database checks are guarantees.**

- Class availability shown in UI dropdown — UX only, may be stale.
- Duplicate booking check in backend — nice error message, but the real guarantee is the partial unique index.
- Overbooking prevention — only Postgres can guarantee it under concurrency, so it lives at the DB layer.

Three invariants enforced at the DB:
1. Max 4 confirmed bookings per class — enforced by FOR UPDATE + `COUNT(*) < 4` in the atomic UPDATE.
2. One active booking per (class_id, student_id) — enforced by partial unique index on bookings where status is `PENDING_PAYMENT` or `CONFIRMED`.
3. Every payment belongs to exactly one booking — enforced by `UNIQUE` on `payments.booking_id`.

### Last-seat race handling — the interesting part

**Approach:** `SELECT ... FOR UPDATE` on the classes row at the start of the confirm transaction, followed by an atomic UPDATE on the booking row with the capacity check in the WHERE clause.

```sql
BEGIN;
  -- Serialize concurrent confirms for this class on the classes row.
  -- Held for single-digit ms — inside the confirm transaction only,
  -- NOT across the payment call.
  SELECT id FROM classes WHERE id = $class_id FOR UPDATE;

  UPDATE bookings
  SET status = 'CONFIRMED', updated_at = now()
  WHERE id = $booking_id
    AND status = 'PENDING_PAYMENT'
    AND (SELECT COUNT(*) FROM bookings
         WHERE class_id = $class_id AND status = 'CONFIRMED') < 4
  RETURNING id;

  -- If row returned: UPDATE payment → SETTLED
  -- If no row:       UPDATE booking → PAYMENT_FAILED, payment → REFUNDED
COMMIT;
```

**Why both pieces are needed:**

Without `FOR UPDATE`: two different bookings racing for the same class have two different row locks. Both `COUNT(*)` subqueries under READ COMMITTED see the same pre-commit snapshot; both pass the `< 4` guard; both commit. Overbooking. Predicate locking that would prevent this only exists under SERIALIZABLE isolation.

Without the `COUNT(*) < 4`: FOR UPDATE alone would serialize concurrent transactions but wouldn't enforce the capacity limit — each would still update its booking to CONFIRMED regardless of count.

Together: FOR UPDATE forces the second transaction to wait for the first to commit; when the second acquires the lock, its `COUNT(*)` sees the correct post-commit state (4) and the UPDATE returns no row → correctly rejected as CLASS_FULL.

### Why not other approaches

- **`SELECT FOR UPDATE` held across the payment call** — payment takes seconds. Holding a DB lock across an external call risks deadlock and pool exhaustion. Here the lock is held *inside* the confirm transaction only, after payment already returned. Single-digit ms.
- **SERIALIZABLE isolation + retry loop** — correct but needs retry orchestration. Heavier.
- **Advisory lock** (`pg_advisory_xact_lock(hashtext(class_id::text))`) — equivalent semantics, but FOR UPDATE on the classes row is more idiomatic.
- **`confirmed_count` counter column on classes** — also correct (two UPDATEs on the same class row serialize on the row lock), but needs a schema change and drift protection. FOR UPDATE on the existing row is zero schema change.

### Trade-offs accepted

- `COUNT(*)` in the WHERE clause reads the bookings table at confirm time. At 4-seat classes this is trivially cheap (uses `bookings_class_status_idx`). If classes had thousands of seats and confirmations were high-frequency, a counter column with drift protection would be worth the complexity. Not here.
- Payment mock is deterministic (two buttons). Real payment integration is deferred — see "Next steps".
- No auth. Parent and student identity passed explicitly. In production, session-based auth would replace raw IDs.

## What was deliberately cut

- Authentication and sessions
- Regular enrollment (trial only, per spec)
- Real payment provider integration
- Payment retry — `PAYMENT_FAILED` is terminal, parent creates a new booking
- Cancellation and refund flows initiated by parent
- Waitlist when class is full
- Email / SMS notifications
- Pagination on admin roster
- Multi-tenancy
- Rate limiting

Each is real work in a real product. None affect the correctness properties being tested.

## What I would monitor after release

- Rate of `PAYMENT_FAILED` with reason `CLASS_FULL` — expected under high demand, but a spike means the UX pre-check is stale too often.
- Rate of duplicate booking rejections by the unique index — indicates client-side retry bugs or double-clicks.
- Payment settlement latency p99 — wider window = more race hits.
- Invariant sanity: `SELECT class_id, COUNT(*) FROM bookings WHERE status='CONFIRMED' GROUP BY class_id HAVING COUNT(*) > 4` — must always return zero rows. Any hit means the DB invariant broke.
- Lock wait time on the `SELECT FOR UPDATE` — degrades under contention on popular classes.

## What I would do next with more time

**Necessary before production**
- Real payment provider (Stripe/Xendit) with webhook-driven state, not synchronous button clicks
- Auth for parents and admins
- Idempotency keys on `createBooking` and `confirmPayment` to survive client retries
- Structured logging + tracing on the confirmation path
- Rate limiting on booking submission per parent
- Cancellation flow: refund on cancel, seat re-opens for another parent
- Waitlist when class is full

**Nice to have**
- Real-time seat count in the UI (Server-Sent Events or polling)
- Confirmation emails
- Admin operations: reschedule a class, refund manually, block a student
- Multi-tenancy (schools, franchises)
- Trial-to-paid conversion analytics

## Repo layout

See `docs/setup.md` for the full tree. Key directories:

- `docs/` — spec, architecture, testing, setup. Read `architecture.md` for the race handling reasoning.
- `app/actions/` — server actions (booking, payment, roster)
- `app/` — parent UI (`page.tsx`) and admin (`admin/`)
- `migrations/` — SQL migration files
- `tests/` — Vitest tests, one file per concern
- `scripts/` — migrate, seed, reset
