import { beforeEach, describe, expect, it } from 'vitest';
import { sql } from '../lib/db';
import { createBooking } from '../app/actions/booking';
import { IDS, resetDb } from './helpers';

beforeEach(resetDb);

describe('createBooking', () => {
  it('creates a PENDING_PAYMENT booking + PENDING payment for an open class', async () => {
    // Liam has no booking anywhere in the seed; Class A is empty.
    const result = await createBooking(IDS.students.liamNg, IDS.classes.empty);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [booking] = await sql`
      SELECT status, class_id, student_id FROM bookings WHERE id = ${result.data.bookingId}
    `;
    expect(booking).toMatchObject({
      status: 'PENDING_PAYMENT',
      class_id: IDS.classes.empty,
      student_id: IDS.students.liamNg,
    });

    const [payment] = await sql`
      SELECT status, booking_id FROM payments WHERE id = ${result.data.paymentId}
    `;
    expect(payment).toMatchObject({
      status: 'PENDING',
      booking_id: result.data.bookingId,
    });
  });

  it('rejects a duplicate active booking for the same (student, class)', async () => {
    // Emma is already CONFIRMED in Class B from the seed.
    const result = await createBooking(
      IDS.students.emmaTan,
      IDS.classes.threeConfirmed,
    );

    expect(result).toEqual({
      ok: false,
      code: 'DUPLICATE_ACTIVE_BOOKING',
      message: expect.any(String),
    });

    const [{ count }] = await sql`
      SELECT COUNT(*)::int AS count FROM bookings
      WHERE class_id = ${IDS.classes.threeConfirmed}
        AND student_id = ${IDS.students.emmaTan}
    `;
    expect(count).toBe(1);
  });
});
