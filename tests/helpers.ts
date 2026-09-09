import { sql } from '../lib/db';
import { IDS, seedInto } from '../scripts/seed';

export { IDS };

type BookingStatus =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'PAYMENT_FAILED'
  | 'CANCELLED';
type PaymentStatus = 'PENDING' | 'SETTLED' | 'FAILED' | 'REFUNDED';

/**
 * Truncate every table and reload the fixed-UUID seed fixtures.
 * Called in `beforeEach` — tests must not depend on each other's state.
 */
export async function resetDb() {
  await sql`
    TRUNCATE payments, bookings, classes, students RESTART IDENTITY CASCADE
  `;
  await sql.begin(seedInto);
}

export async function createStudent(
  parentName: string,
  name: string,
): Promise<string> {
  const [row] = await sql`
    INSERT INTO students (parent_name, name)
    VALUES (${parentName}, ${name})
    RETURNING id
  `;
  return row.id;
}

export async function createClass(
  name: string,
  opts: { startsAt?: string; capacity?: number; status?: string } = {},
): Promise<string> {
  const [row] = await sql`
    INSERT INTO classes (name, starts_at, capacity, status)
    VALUES (
      ${name},
      ${opts.startsAt ?? '2026-10-05T08:00:00Z'},
      ${opts.capacity ?? 4},
      ${opts.status ?? 'OPEN'}
    )
    RETURNING id
  `;
  return row.id;
}

/** Raw booking insert at an arbitrary status — bypasses the server actions. */
export async function createBooking(
  classId: string,
  studentId: string,
  status: BookingStatus,
): Promise<string> {
  const [row] = await sql`
    INSERT INTO bookings (class_id, student_id, status)
    VALUES (${classId}, ${studentId}, ${status})
    RETURNING id
  `;
  return row.id;
}

export async function createPayment(
  bookingId: string,
  status: PaymentStatus,
  amount = 50.0,
): Promise<string> {
  const [row] = await sql`
    INSERT INTO payments (booking_id, amount, status)
    VALUES (${bookingId}, ${amount}, ${status})
    RETURNING id
  `;
  return row.id;
}

/** A booking mid-flow: PENDING_PAYMENT booking + PENDING payment. */
export async function createPendingBooking(
  classId: string,
  studentId: string,
): Promise<{ bookingId: string; paymentId: string }> {
  const bookingId = await createBooking(classId, studentId, 'PENDING_PAYMENT');
  const paymentId = await createPayment(bookingId, 'PENDING');
  return { bookingId, paymentId };
}

export async function confirmedCount(classId: string): Promise<number> {
  const [row] = await sql`
    SELECT COUNT(*)::int AS count FROM bookings
    WHERE class_id = ${classId} AND status = 'CONFIRMED'
  `;
  return row.count;
}
