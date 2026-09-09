# Testing

Vitest against real Postgres in Docker. No DB mocks — mocking hides the exact concurrency behavior we need to prove.

## Structure

```
tests/
  helpers.ts         — resetDb(), factories
  booking.test.ts    — createBooking scenarios
  payment.test.ts    — confirmPayment scenarios
  race.test.ts       — concurrent last-seat race (20 iterations)
  roster.test.ts     — admin roster output
```

Each test file calls `resetDb()` in `beforeEach`. No test order dependencies.

## Required scenarios → test mapping

| Scenario (from task) | Test file | What's asserted |
|---|---|---|
| Class with available seats | `roster.test.ts`, `booking.test.ts` | Roster returns confirmed subset; booking succeeds |
| Class with exactly 3 confirmed | `helpers.ts` | Seed fixture reused by race test |
| Duplicate booking (same child + class) | `booking.test.ts` | Second `createBooking` returns error; DB has 1 booking |
| Payment failure | `payment.test.ts` | booking=`PAYMENT_FAILED`, payment=`FAILED`, roster unchanged |
| Overbooking (5th confirmation) | `payment.test.ts` | After 4 confirmed, 5th returns "class full" and booking=`PAYMENT_FAILED` |
| Last-seat race | `race.test.ts` | Two concurrent confirmations on class with 3 confirmed → exactly 1 wins |

## Race test — the important one

Setup: class with 3 CONFIRMED bookings. Two more students each with a `PENDING_PAYMENT` booking for that class.

```ts
const results = await Promise.all([
  confirmPayment(paymentIdA, 'success'),
  confirmPayment(paymentIdB, 'success'),
]);

const confirmed = results.filter(r => r.ok && r.data.status === 'CONFIRMED');
const failed    = results.filter(r => r.ok && r.data.status === 'PAYMENT_FAILED');

expect(confirmed).toHaveLength(1);
expect(failed).toHaveLength(1);

// Independent DB check — never trust return values alone
const [{ count }] = await sql`
  SELECT COUNT(*)::int AS count FROM bookings
  WHERE class_id = ${classId} AND status = 'CONFIRMED'
`;
expect(count).toBe(4);
```

Wrap in 20 iterations to catch flakes:

```ts
describe.each(Array.from({ length: 20 }, (_, i) => [i]))(
  'last-seat race iteration %i',
  () => { /* the test */ }
);
```

If it ever fails once, the invariant is broken. Stop and investigate.

## Seed data

`scripts/seed.ts` uses fixed UUIDs so tests can reference by name.

Concrete fixtures:
- **6 students** across 3 parents
- **Class A** — empty, 0 confirmed
- **Class B** — 3 confirmed (used for race test)
- **Class C** — 4 confirmed, full (used for overbooking rejection test)

## Reviewer verification

```bash
docker compose up -d
pnpm db:reset          # migrate + seed
pnpm test              # all scenarios, exit 0 = pass
pnpm test race         # just the race test, 20 iterations
```
