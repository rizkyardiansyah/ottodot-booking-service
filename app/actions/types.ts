// Shared shapes for the server actions. Not a "use server" module — those
// may only export async functions, so every plain type lives here.

/** Errors are values. Actions never throw for expected failure paths. */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };

export type CreateBookingData = {
  bookingId: string;
  paymentId: string;
};

export type ConfirmPaymentData =
  | { status: 'CONFIRMED' }
  | { status: 'PAYMENT_FAILED'; reason: 'PAYMENT_DECLINED' | 'CLASS_FULL' };

export type StudentOption = {
  id: string;
  name: string;
  parentName: string;
};

export type AvailableClass = {
  id: string;
  name: string;
  startsAt: string;
  capacity: number;
  confirmedCount: number;
};

/** Admin view: every class regardless of status, with live occupancy. */
export type ClassOccupancy = AvailableClass & {
  status: string;
};

export type BookingStatusView = {
  bookingId: string;
  bookingStatus: string;
  paymentId: string;
  paymentStatus: string;
  classId: string;
  className: string;
};

export type RosterEntry = {
  bookingId: string;
  studentName: string;
  parentName: string;
  confirmedAt: string;
};

export type ClassRoster = {
  classId: string;
  className: string;
  capacity: number;
  confirmedCount: number;
  entries: RosterEntry[];
};
