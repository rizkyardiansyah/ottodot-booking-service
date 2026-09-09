import Link from 'next/link';
import { listAllClasses } from '../actions/roster';

export const dynamic = 'force-dynamic';

function formatStart(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'UTC',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default async function AdminClassesPage() {
  const result = await listAllClasses();

  if (!result.ok) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          Could not load classes.
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-xl font-semibold">Classes</h1>

      <ul className="divide-y divide-gray-200 rounded border border-gray-200 bg-white">
        {result.data.map((c) => {
          const full = c.confirmedCount >= c.capacity;
          return (
            <li
              key={c.id}
              className="flex items-center justify-between gap-4 p-4"
            >
              <div>
                <p className="font-medium">
                  {c.name}
                  {c.status !== 'OPEN' && (
                    <span className="ml-2 text-xs uppercase text-gray-400">
                      {c.status}
                    </span>
                  )}
                </p>
                <p className="text-sm text-gray-500">
                  {formatStart(c.startsAt)} UTC
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`tabular-nums ${full ? 'font-semibold text-red-700' : 'text-gray-700'}`}
                >
                  {c.confirmedCount} / {c.capacity}
                </span>
                {full && (
                  <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                    FULL
                  </span>
                )}
                <Link
                  href={`/admin/${c.id}`}
                  className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100"
                >
                  See participants
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
