import Link from 'next/link';
import { getClassRoster } from '../../actions/roster';

export const dynamic = 'force-dynamic';

function formatConfirmedAt(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'UTC',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default async function ClassRosterPage({
  params,
}: {
  params: { classId: string };
}) {
  const result = await getClassRoster(params.classId);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/admin" className="text-sm underline">
        ← Back to classes
      </Link>

      {!result.ok ? (
        <div className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {result.message}
        </div>
      ) : (
        <>
          <h1 className="mt-4 text-xl font-semibold">{result.data.className}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {result.data.confirmedCount} / {result.data.capacity} confirmed
          </p>

          <table className="mt-4 w-full border border-gray-200 bg-white text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="p-2 font-medium">Student</th>
                <th className="p-2 font-medium">Parent</th>
                <th className="p-2 font-medium">Confirmed at (UTC)</th>
              </tr>
            </thead>
            <tbody>
              {result.data.entries.map((e) => (
                <tr key={e.bookingId} className="border-b border-gray-100">
                  <td className="p-2">{e.studentName}</td>
                  <td className="p-2">{e.parentName}</td>
                  <td className="p-2 tabular-nums">
                    {formatConfirmedAt(e.confirmedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {result.data.entries.length === 0 && (
            <p className="mt-3 text-sm text-gray-500">
              No confirmed students yet.
            </p>
          )}
        </>
      )}
    </main>
  );
}
