import Link from 'next/link';
import { ParentFlow } from './_components/parent-flow';
import { listAvailableClasses } from './actions/roster';
import { listStudents } from './actions/students';

// Reads live DB state on every request; router.refresh() re-runs this.
export const dynamic = 'force-dynamic';

export default async function Home() {
  const [students, classes] = await Promise.all([
    listStudents(),
    listAvailableClasses(),
  ]);

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="mb-6 text-xl font-semibold">Book a trial class</h1>

      {students.ok && classes.ok ? (
        <ParentFlow students={students.data} classes={classes.data} />
      ) : (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          Could not load students or classes. Is the database seeded?
        </div>
      )}

      <p className="mt-8 text-sm text-gray-500">
        Admin:{' '}
        <Link href="/admin" className="underline">
          class list
        </Link>
      </p>
    </main>
  );
}
