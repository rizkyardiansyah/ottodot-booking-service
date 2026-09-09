import { beforeEach, describe, expect, it } from 'vitest';
import { sql } from '../lib/db';
import { confirmPayment } from '../app/actions/payment';
import { IDS, confirmedCount, createPendingBooking, resetDb } from './helpers';

beforeEach(resetDb);

describe('confirmPayment', () => {
  it('success path: booking → CONFIRMED, payment → SETTLED, seat consumed', async () => {
    const { bookingId, paymentId } = await createPendingBooking(
      IDS.classes.empty,
      IDS.students.liamNg,
    );

    const result = await confirmPayment(paymentId, 'success');
    expect(result).toEqual({ ok: true, data: { status: 'CONFIRMED' } });

    const [booking] = await sql`SELECT status FROM bookings WHERE id = ${bookingId}`;
    const [payment] = await sql`SELECT status FROM payments WHERE id = ${paymentId}`;
    expect(booking.status).toBe('CONFIRMED');
    expect(payment.status).toBe('SETTLED');
    expect(await confirmedCount(IDS.classes.empty)).toBe(1);
  });

  it('fail path: booking → PAYMENT_FAILED, payment → FAILED, roster unchanged', async () => {
    const before = await confirmedCount(IDS.classes.empty);
    const { bookingId, paymentId } = await createPendingBooking(
      IDS.classes.empty,
      IDS.students.liamNg,
    );

    const result = await confirmPayment(paymentId, 'fail');
    expect(result).toEqual({
      ok: true,
      data: { status: 'PAYMENT_FAILED', reason: 'PAYMENT_DECLINED' },
    });

    const [booking] = await sql`SELECT status FROM bookings WHERE id = ${bookingId}`;
    const [payment] = await sql`SELECT status FROM payments WHERE id = ${paymentId}`;
    expect(booking.status).toBe('PAYMENT_FAILED');
    expect(payment.status).toBe('FAILED');
    expect(await confirmedCount(IDS.classes.empty)).toBe(before);
  });

  it('overbooking: 5th confirmation on a full class is rejected as CLASS_FULL', async () => {
    // Class C already has 4 CONFIRMED from the seed.
    const { bookingId, paymentId } = await createPendingBooking(
      IDS.classes.full,
      IDS.students.liamNg,
    );

    const result = await confirmPayment(paymentId, 'success');
    expect(result).toEqual({
      ok: true,
      data: { status: 'PAYMENT_FAILED', reason: 'CLASS_FULL' },
    });

    const [booking] = await sql`SELECT status FROM bookings WHERE id = ${bookingId}`;
    const [payment] = await sql`SELECT status FROM payments WHERE id = ${paymentId}`;
    expect(booking.status).toBe('PAYMENT_FAILED');
    expect(payment.status).toBe('REFUNDED');
    expect(await confirmedCount(IDS.classes.full)).toBe(4);
  });
});
