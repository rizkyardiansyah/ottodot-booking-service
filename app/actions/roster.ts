'use server';

import { sql } from '@/lib/db';
import type {
  ActionResult,
  AvailableClass,
  BookingStatusView,
  ClassOccupancy,
  ClassRoster,
} from './types';

/**
 * Classes a parent can pick from: status OPEN, with a live CONFIRMED count
 * so the UI can show occupancy and flag full ones. The count is derived
 * (COUNT(*), never a stored column) so it cannot drift.
 */
export async function listAvailableClasses(): Promise<
  ActionResult<AvailableClass[]>
> {
  const rows = await sql`
    SELECT
      c.id,
      c.name,
      c.starts_at,
      c.capacity,
      COUNT(b.id) FILTER (WHERE b.status = 'CONFIRMED')::int AS confirmed_count
    FROM classes c
    LEFT JOIN bookings b ON b.class_id = c.id
    WHERE c.status = 'OPEN'
    GROUP BY c.id
    ORDER BY c.starts_at
  `;

  return {
    ok: true,
    data: rows.map((r) => ({
      id: r.id,
      name: r.name,
      startsAt: (r.starts_at as Date).toISOString(),
      capacity: r.capacity,
      confirmedCount: r.confirmed_count,
    })),
  };
}

/**
 * Admin class list: every class (any status) with its live CONFIRMED count,
 * so the roster view can show `N / capacity` and flag full classes.
 */
export async function listAllClasses(): Promise<
  ActionResult<ClassOccupancy[]>
> {
  const rows = await sql`
    SELECT
      c.id,
      c.name,
      c.starts_at,
      c.capacity,
      c.status,
      COUNT(b.id) FILTER (WHERE b.status = 'CONFIRMED')::int AS confirmed_count
    FROM classes c
    LEFT JOIN bookings b ON b.class_id = c.id
    GROUP BY c.id
    ORDER BY c.starts_at
  `;

  return {
    ok: true,
    data: rows.map((r) => ({
      id: r.id,
      name: r.name,
      startsAt: (r.starts_at as Date).toISOString(),
      capacity: r.capacity,
      confirmedCount: r.confirmed_count,
      status: r.status,
    })),
  };
}

/** Current booking + payment state, for the post-payment result screen. */
export async function getBookingStatus(
  bookingId: string,
): Promise<ActionResult<BookingStatusView>> {
  const [row] = await sql`
    SELECT
      b.id     AS booking_id,
      b.status AS booking_status,
      p.id     AS payment_id,
      p.status AS payment_status,
      c.id     AS class_id,
      c.name   AS class_name
    FROM bookings b
    JOIN payments p ON p.booking_id = b.id
    JOIN classes  c ON c.id = b.class_id
    WHERE b.id = ${bookingId}
  `;

  if (!row) {
    return {
      ok: false,
      code: 'BOOKING_NOT_FOUND',
      message: 'No booking found for that id.',
    };
  }

  return {
    ok: true,
    data: {
      bookingId: row.booking_id,
      bookingStatus: row.booking_status,
      paymentId: row.payment_id,
      paymentStatus: row.payment_status,
      classId: row.class_id,
      className: row.class_name,
    },
  };
}

/** Admin roster: the CONFIRMED students for one class, earliest first. */
export async function getClassRoster(
  classId: string,
): Promise<ActionResult<ClassRoster>> {
  const [cls] = await sql`
    SELECT id, name, capacity FROM classes WHERE id = ${classId}
  `;

  if (!cls) {
    return {
      ok: false,
      code: 'CLASS_NOT_FOUND',
      message: 'No class found for that id.',
    };
  }

  const rows = await sql`
    SELECT
      b.id         AS booking_id,
      b.updated_at AS confirmed_at,
      s.name       AS student_name,
      s.parent_name
    FROM bookings b
    JOIN students s ON s.id = b.student_id
    WHERE b.class_id = ${classId} AND b.status = 'CONFIRMED'
    ORDER BY b.updated_at, b.created_at
  `;

  return {
    ok: true,
    data: {
      classId: cls.id,
      className: cls.name,
      capacity: cls.capacity,
      confirmedCount: rows.length,
      entries: rows.map((r) => ({
        bookingId: r.booking_id,
        studentName: r.student_name,
        parentName: r.parent_name,
        confirmedAt: (r.confirmed_at as Date).toISOString(),
      })),
    },
  };
}
