# Spec

Trial booking system for Ottodot. Parent books a trial class for a child, pays, gets confirmed. Admin sees roster. Trial classes capped at 4 students.

## In scope

**Parent flow (`/`):**
1. Choose child + available class
2. Submit booking → `PENDING_PAYMENT` booking + `PENDING` payment
3. Mock payment (two buttons: success / fail)
4. See resulting booking status
5. "Book another" resets the form and re-fetches available classes (see UX rules below)

**Admin flow:**
6. `/admin` — list all classes with current occupancy (e.g. "3 / 4") and a "See participants" button per class
7. `/admin/[classId]` — roster of CONFIRMED students for that class

## Out of scope (state these as deliberate cuts in README)

- Auth
- Regular enrollment (trial only)
- Real payment gateway
- Payment retry — `PAYMENT_FAILED` is terminal
- Cancellation / refund flows initiated by parent
- Email / notifications
- Multi-tenancy
- Pagination on roster
- Waitlist when class is full

## Correctness properties (the whole point of the task)

1. No duplicate confirmed bookings for same (child, class)
2. No overbooking beyond 4 confirmed per class
3. Payment failure never adds child to confirmed roster
4. Last-seat race: two parents on the last seat → exactly one wins

*How these are enforced: see `architecture.md`.*
*How these are tested: see `testing.md`.*

## UX rules

- **"Book another" button after payment result** must both (a) reset local component state back to the selection step, AND (b) call `router.refresh()` to re-fetch available classes from the server. The class the parent just booked may now be full; other parents may have booked into other classes concurrently. Never force a full page reload.
- **Admin class list** displays occupancy as `confirmed / capacity` (e.g. `3 / 4`, `4 / 4`). A class at capacity should be visually distinct (e.g. "FULL" label), but still clickable to view participants.
- **All error states** rendered as plain divs with the error message. No toast library.

## Deliverables

- Public GitHub repo with `README.md`, `AI_USAGE.md`, implementation, seed, tests
- 5–8 min video walkthrough (Loom / YouTube unlisted)

## README checklist

- How to run
- What was built
- Time spent (honest)
- Assumptions
- Key architecture and backend decisions
- What was deliberately cut
- What to monitor post-release
- What's next with more time

## AI_USAGE.md checklist

- Which AI tools used
- What used AI for
- One place AI helped move faster
- One place I disagreed with / corrected / rejected AI output
- What to change about AI workflow next time
- How I verified the final implementation
