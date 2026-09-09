'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createBooking } from '@/app/actions/booking';
import { confirmPayment } from '@/app/actions/payment';
import type {
  AvailableClass,
  ConfirmPaymentData,
  StudentOption,
} from '@/app/actions/types';

type Props = {
  students: StudentOption[];
  classes: AvailableClass[];
};

type Booking = { bookingId: string; paymentId: string };

const REASON_LABEL: Record<string, string> = {
  PAYMENT_DECLINED: 'Payment was declined.',
  CLASS_FULL: 'The class filled up before payment completed.',
};

export function ParentFlow({ students, classes }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Three stages, derived from these four pieces of state (see "Book another").
  const [studentId, setStudentId] = useState('');
  const [classId, setClassId] = useState('');
  const [booking, setBooking] = useState<Booking | null>(null);
  const [paymentResult, setPaymentResult] = useState<ConfirmPaymentData | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const student = students.find((s) => s.id === studentId);
  const klass = classes.find((c) => c.id === classId);

  function handleBook(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createBooking(studentId, classId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setBooking(result.data);
    });
  }

  function handlePay(outcome: 'success' | 'fail') {
    if (!booking) return;
    setError(null);
    startTransition(async () => {
      const result = await confirmPayment(booking.paymentId, outcome);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setPaymentResult(result.data);
    });
  }

  function bookAnother() {
    setStudentId('');
    setClassId('');
    setBooking(null);
    setPaymentResult(null);
    setError(null);
    // Re-fetch available classes from the server component — the class just
    // booked may now be full, and other parents may have booked elsewhere.
    router.refresh();
  }

  const errorBox = error ? (
    <div className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
      {error}
    </div>
  ) : null;

  // Stage C — payment result
  if (paymentResult) {
    const confirmed = paymentResult.status === 'CONFIRMED';
    return (
      <div>
        <div
          className={`rounded border p-4 ${
            confirmed
              ? 'border-green-300 bg-green-50 text-green-900'
              : 'border-red-300 bg-red-50 text-red-900'
          }`}
        >
          <p className="font-semibold">{paymentResult.status}</p>
          {!confirmed && paymentResult.status === 'PAYMENT_FAILED' && (
            <p className="mt-1 text-sm">
              {REASON_LABEL[paymentResult.reason] ?? paymentResult.reason}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={bookAnother}
          className="mt-4 rounded bg-gray-900 px-4 py-2 text-white hover:bg-gray-700"
        >
          Book another
        </button>
        {errorBox}
      </div>
    );
  }

  // Stage B — booking created, awaiting mock payment
  if (booking) {
    return (
      <div>
        <div className="rounded border border-gray-200 bg-white p-4">
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Booking ID</dt>
              <dd className="font-mono">{booking.bookingId}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Student</dt>
              <dd>{student?.name ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Class</dt>
              <dd>{klass?.name ?? '—'}</dd>
            </div>
          </dl>
        </div>
        <p className="mt-4 text-sm text-gray-600">
          Mock payment — no real gateway.
        </p>
        <div className="mt-2 flex gap-3">
          <button
            type="button"
            onClick={() => handlePay('success')}
            disabled={isPending}
            className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-500 disabled:opacity-50"
          >
            Pay success
          </button>
          <button
            type="button"
            onClick={() => handlePay('fail')}
            disabled={isPending}
            className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-500 disabled:opacity-50"
          >
            Pay fail
          </button>
        </div>
        {isPending && <p className="mt-3 text-sm text-gray-500">Loading...</p>}
        {errorBox}
      </div>
    );
  }

  // Stage A — selection
  return (
    <form onSubmit={handleBook}>
      <label className="block text-sm font-medium">
        Child
        <select
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          required
          className="mt-1 block w-full rounded border border-gray-300 bg-white p-2"
        >
          <option value="">Select a child…</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} (parent: {s.parentName})
            </option>
          ))}
        </select>
      </label>

      <label className="mt-4 block text-sm font-medium">
        Class
        <select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          required
          className="mt-1 block w-full rounded border border-gray-300 bg-white p-2"
        >
          <option value="">Select a class…</option>
          {classes.map((c) => {
            const full = c.confirmedCount >= c.capacity;
            return (
              <option key={c.id} value={c.id} disabled={full}>
                {c.name} — {c.confirmedCount}/{c.capacity}
                {full ? ' (full)' : ''}
              </option>
            );
          })}
        </select>
      </label>

      <button
        type="submit"
        disabled={isPending || !studentId || !classId}
        className="mt-4 rounded bg-gray-900 px-4 py-2 text-white hover:bg-gray-700 disabled:opacity-50"
      >
        Book
      </button>
      {isPending && <p className="mt-3 text-sm text-gray-500">Loading...</p>}
      {errorBox}
    </form>
  );
}
