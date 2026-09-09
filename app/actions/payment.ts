'use server';

import { sql } from '@/lib/db';
import type { ActionResult, ConfirmPaymentData } from './types';

/**
 * Resolve a pending payment.
 *
 * - `fail`    → booking PAYMENT_FAILED, payment FAILED.
 * - `success` → try to claim a seat; if the class filled up first, the
 *   payment is REFUNDED (money changed hands upstream) and the booking
 *   goes PAYMENT_FAILED with reason CLASS_FULL.
 *
 * Every branch writes both the booking row and the payment row inside one
 * `sql.begin()` so the pair is never left half-applied.
 */
export async function confirmPayment(
  paymentId: string,
  result: 'success' | 'fail',
): Promise<ActionResult<ConfirmPaymentData>> {
  if (result !== 'success' && result !== 'fail') {
    return {
      ok: false,
      code: 'INVALID_PAYMENT_RESULT',
      message: 'result must be "success" or "fail".',
    };
  }

  const [row] = await sql`
    SELECT
      p.id       AS payment_id,
      b.id       AS booking_id,
      b.class_id AS class_id,
      b.status   AS booking_status
    FROM payments p
    JOIN bookings b ON b.id = p.booking_id
    WHERE p.id = ${paymentId}
  `;

  if (!row) {
    return {
      ok: false,
      code: 'PAYMENT_NOT_FOUND',
      message: 'No payment found for that id.',
    };
  }

  // Confirms are single-shot and PAYMENT_FAILED is terminal. A booking that
  // is not awaiting payment means a double-submit or a stale tab.
  if (row.booking_status !== 'PENDING_PAYMENT') {
    return {
      ok: false,
      code: 'BOOKING_NOT_PENDING',
      message: `Booking is already ${row.booking_status}.`,
    };
  }

  const bookingId = row.booking_id as string;
  const classId = row.class_id as string;
  const pid = row.payment_id as string;

  if (result === 'fail') {
    await sql.begin(async (tx) => {
      await tx`
        UPDATE bookings SET status = 'PAYMENT_FAILED', updated_at = now()
        WHERE id = ${bookingId}
      `;
      await tx`
        UPDATE payments SET status = 'FAILED', updated_at = now()
        WHERE id = ${pid}
      `;
    });
    return {
      ok: true,
      data: { status: 'PAYMENT_FAILED', reason: 'PAYMENT_DECLINED' },
    };
  }

  return sql.begin<ActionResult<ConfirmPaymentData>>(async (tx) => {
    // Serialize every confirm for this class on the classes row BEFORE
    // counting seats. Without this lock two concurrent confirms target two
    // different bookings rows, take two different row locks, and so never
    // block each other; under READ COMMITTED each COUNT(*) subquery then
    // reads a snapshot taken before either commits, both see the same stale
    // count, both pass `< 4`, and the class overbooks. The lock is held only
    // for these few writes — never across the (already-returned) payment.
    await tx`SELECT id FROM classes WHERE id = ${classId} FOR UPDATE`;

    const [won] = await tx`
      UPDATE bookings
      SET status = 'CONFIRMED', updated_at = now()
      WHERE id = ${bookingId}
        AND status = 'PENDING_PAYMENT'
        AND (SELECT COUNT(*) FROM bookings
             WHERE class_id = ${classId} AND status = 'CONFIRMED') < 4
      RETURNING id
    `;

    if (won) {
      await tx`
        UPDATE payments SET status = 'SETTLED', updated_at = now()
        WHERE id = ${pid}
      `;
      return { ok: true, data: { status: 'CONFIRMED' } };
    }

    // Lost the last seat. Payment succeeded upstream, so it is refunded,
    // not merely failed.
    await tx`
      UPDATE bookings SET status = 'PAYMENT_FAILED', updated_at = now()
      WHERE id = ${bookingId}
    `;
    await tx`
      UPDATE payments SET status = 'REFUNDED', updated_at = now()
      WHERE id = ${pid}
    `;
    return {
      ok: true,
      data: { status: 'PAYMENT_FAILED', reason: 'CLASS_FULL' },
    };
  });
}
