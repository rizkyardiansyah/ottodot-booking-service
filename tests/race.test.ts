import { beforeEach, describe, expect, it } from 'vitest';
import { sql } from '../lib/db';
import { confirmPayment } from '../app/actions/payment';
import { IDS, createPendingBooking, resetDb } from './helpers';

// Class B has 3 CONFIRMED in the seed. Two parents race for the last seat:
// exactly one may win, and the class must never exceed 4 CONFIRMED.
// 20 iterations because a broken lock fails only intermittently.
describe.each(Array.from({ length: 20 }, (_, i) => [i]))(
  'last-seat race iteration %i',
  () => {
    beforeEach(resetDb);

    it('exactly one confirm wins; the other is refunded; count stays 4', async () => {
      const a = await createPendingBooking(
        IDS.classes.threeConfirmed,
        IDS.students.liamNg,
      );
      const b = await createPendingBooking(
        IDS.classes.threeConfirmed,
        IDS.students.miaNg,
      );

      const [resA, resB] = await Promise.all([
        confirmPayment(a.paymentId, 'success'),
        confirmPayment(b.paymentId, 'success'),
      ]);

      const results = [resA, resB];
      const confirmed = results.filter(
        (r) => r.ok && r.data.status === 'CONFIRMED',
      );
      const classFull = results.filter(
        (r) =>
          r.ok &&
          r.data.status === 'PAYMENT_FAILED' &&
          r.data.reason === 'CLASS_FULL',
      );

      expect(confirmed).toHaveLength(1);
      expect(classFull).toHaveLength(1);

      // Independent DB check — never trust return values alone.
      const [{ count }] = await sql`
        SELECT COUNT(*)::int AS count FROM bookings
        WHERE class_id = ${IDS.classes.threeConfirmed} AND status = 'CONFIRMED'
      `;
      expect(count).toBe(4);

      // The loser's booking and payment landed in the terminal refunded state.
      const loser = resA.ok && resA.data.status === 'CONFIRMED' ? b : a;
      const [loserBooking] = await sql`
        SELECT status FROM bookings WHERE id = ${loser.bookingId}
      `;
      const [loserPayment] = await sql`
        SELECT status FROM payments WHERE id = ${loser.paymentId}
      `;
      expect(loserBooking.status).toBe('PAYMENT_FAILED');
      expect(loserPayment.status).toBe('REFUNDED');
    });
  },
);
