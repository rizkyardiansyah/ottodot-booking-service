'use server';

import { sql } from '@/lib/db';
import type { ActionResult, CreateBookingData } from './types';

// Mock trial price. No real gateway — see docs/spec.md "Out of scope".
const TRIAL_CLASS_PRICE = 50;

/**
 * Start a trial booking: a PENDING_PAYMENT booking plus its PENDING payment,
 * written together so the pair is never half-created.
 *
 * Duplicate prevention is the DB's job: the partial unique index
 * `bookings_active_unique (class_id, student_id) WHERE status IN
 * ('PENDING_PAYMENT','CONFIRMED')` rejects a second active booking for the
 * same student in the same class. We catch that violation (SQLSTATE 23505)
 * and return it as a value rather than letting it throw.
 */
export async function createBooking(
  studentId: string,
  classId: string,
): Promise<ActionResult<CreateBookingData>> {
  try {
    const data = await sql.begin(async (tx) => {
      const [booking] = await tx`
        INSERT INTO bookings (class_id, student_id, status)
        VALUES (${classId}, ${studentId}, 'PENDING_PAYMENT')
        RETURNING id
      `;
      const [payment] = await tx`
        INSERT INTO payments (booking_id, amount, status)
        VALUES (${booking.id}, ${TRIAL_CLASS_PRICE}, 'PENDING')
        RETURNING id
      `;
      return { bookingId: booking.id as string, paymentId: payment.id as string };
    });

    return { ok: true, data };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return {
        ok: false,
        code: 'DUPLICATE_ACTIVE_BOOKING',
        message: 'This student already has an active booking for this class.',
      };
    }
    if (isForeignKeyViolation(err)) {
      return {
        ok: false,
        code: 'CLASS_OR_STUDENT_NOT_FOUND',
        message: 'The class or student does not exist.',
      };
    }
    throw err;
  }
}

function isUniqueViolation(err: unknown): boolean {
  return hasCode(err) && err.code === '23505';
}

function isForeignKeyViolation(err: unknown): boolean {
  return hasCode(err) && err.code === '23503';
}

function hasCode(err: unknown): err is { code: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as { code: unknown }).code === 'string'
  );
}
