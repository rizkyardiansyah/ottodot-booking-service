# CLAUDE.md

Read these before making changes:
- `docs/spec.md` — what to build, what to skip, UX rules
- `docs/architecture.md` — schema, endpoints, race handling
- `docs/testing.md` — test scenarios
- `docs/setup.md` — how the reviewer runs this

## Stack

- Next.js 14+ (App Router), TypeScript, Tailwind
- Postgres 15 in Docker (host port 5443)
- `postgres` (postgres.js) as the driver
- Vitest
- No auth, no ORM

## Dev commands

```bash
# One-time
pnpm install
docker compose up -d
pnpm db:migrate
pnpm db:seed

# Every session
docker compose up -d
pnpm dev            # :3000
pnpm test           # all scenarios
pnpm db:reset       # drop + migrate + seed
```

## Code quality bar

Aim for what a Principal Engineer would write for a 4-hour take-home, not for a system meant to run for 5 years. Concretely:

- **Small pure functions** where the domain allows. Server actions orchestrate; they don't inline SQL, HTTP, and business rules in one blob.
- **One responsibility per file.** `booking.ts` handles booking creation. `payment.ts` handles payment. Don't cross the streams.
- **Errors as values.** Every server action returns `{ ok: true, data }` or `{ ok: false, code, message }`. Never `throw` for expected failure paths (duplicate booking, class full, etc). `throw` only for genuinely unexpected conditions (DB down).
- **Meaningful names.** `confirmPayment`, not `handlePayment`. `PAYMENT_FAILED_CLASS_FULL`, not `ERR_02`.
- **Comment the WHY, not the WHAT.** Comment the atomic UPDATE explaining why SELECT FOR UPDATE on the classes row is what makes it race-safe. Don't comment `// insert booking`.
- **No dead code, no commented-out code, no `console.log` in committed code.**

**Security basics** (non-negotiable, cheap):
- All SQL through `postgres.js` template literals (`sql\`...\``). Never string-concatenate SQL. The template literal handles parameterization → SQL injection safe by default.
- Never log full request payloads or student names — log IDs only.
- Env vars for DATABASE_URL. Never commit `.env.local`.
- Server actions run server-side; do not leak DB connection to client bundle.

**What NOT to do — over-engineering trap list:**
- No Prisma / Drizzle / any ORM
- No dependency injection container
- No repository pattern / service layer abstraction — server actions call `sql` directly
- No custom error class hierarchy — plain error codes as strings
- No event bus / message queue / background jobs
- No auth
- No rate limiting
- No metrics library — log-based observability is enough for the take-home
- No i18n
- No feature flags

## Design decisions already made — do not re-litigate

- **DB is the source of truth for invariants.** App checks are UX affordances.
- **Last-seat race handling**: inside the confirm transaction, first `SELECT id FROM classes WHERE id=$class_id FOR UPDATE` to serialize confirms for that class, THEN the atomic UPDATE on bookings with `COUNT(*) < 4` in WHERE. See `docs/architecture.md` for the full explanation of why FOR UPDATE on classes is required (the naive UPDATE-only approach is broken because two different bookings take two different row locks and both COUNT(*) subqueries see stale snapshots). The FOR UPDATE is held for single-digit ms inside the confirm transaction only — NOT across the payment call.
- **Partial unique index** on `(class_id, student_id) WHERE status IN ('PENDING_PAYMENT', 'CONFIRMED')` for duplicate prevention. Catch the constraint violation (`SQLSTATE 23505`) and translate to `{ ok: false, code: 'DUPLICATE_ACTIVE_BOOKING' }`.
- **`PAYMENT_FAILED` is terminal.** No retry. Parent creates a new booking.
- **Server actions**, not API routes.
- **One shared connection pool** exported from `lib/db.ts`.
- **All state transitions wrap two UPDATEs (booking + payment) in `sql.begin()`.** Never leave the pair partially applied.

## Non-negotiable invariants

Enforced at the database:
1. At most 4 bookings with `status = 'CONFIRMED'` per class.
2. At most one active booking (`PENDING_PAYMENT` or `CONFIRMED`) per `(class_id, student_id)`.
3. Every payment belongs to exactly one booking.

## Time budget

4-hour cap. Correctness of backend flow and clarity of README beat frontend polish and feature breadth every time.
