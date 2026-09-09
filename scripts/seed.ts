import './env';
import type postgres from 'postgres';
import { sql } from '../lib/db';

// Fixed UUIDs so tests and the docs can refer to fixtures by name.
export const IDS = {
  students: {
    emmaTan: '00000000-0000-0000-0000-0000000000a1', // parent: Alice Tan
    ethanTan: '00000000-0000-0000-0000-0000000000a2', // parent: Alice Tan
    noahLim: '00000000-0000-0000-0000-0000000000a3', // parent: Bob Lim
    oliviaLim: '00000000-0000-0000-0000-0000000000a4', // parent: Bob Lim
    liamNg: '00000000-0000-0000-0000-0000000000a5', // parent: Carol Ng
    miaNg: '00000000-0000-0000-0000-0000000000a6', // parent: Carol Ng
  },
  classes: {
    empty: '00000000-0000-0000-0000-0000000000b1', // Class A — 0 confirmed
    threeConfirmed: '00000000-0000-0000-0000-0000000000b2', // Class B — 3 confirmed (race fixture)
    full: '00000000-0000-0000-0000-0000000000b3', // Class C — 4 confirmed (overbooking fixture)
  },
} as const;

const STUDENTS = [
  { id: IDS.students.emmaTan, parent_name: 'Alice Tan', name: 'Emma Tan' },
  { id: IDS.students.ethanTan, parent_name: 'Alice Tan', name: 'Ethan Tan' },
  { id: IDS.students.noahLim, parent_name: 'Bob Lim', name: 'Noah Lim' },
  { id: IDS.students.oliviaLim, parent_name: 'Bob Lim', name: 'Olivia Lim' },
  { id: IDS.students.liamNg, parent_name: 'Carol Ng', name: 'Liam Ng' },
  { id: IDS.students.miaNg, parent_name: 'Carol Ng', name: 'Mia Ng' },
];

const CLASSES = [
  {
    id: IDS.classes.empty,
    name: 'Robotics Trial — Monday 4pm',
    starts_at: '2026-10-05T08:00:00Z',
  },
  {
    id: IDS.classes.threeConfirmed,
    name: 'Robotics Trial — Wednesday 4pm',
    starts_at: '2026-10-07T08:00:00Z',
  },
  {
    id: IDS.classes.full,
    name: 'Robotics Trial — Friday 4pm',
    starts_at: '2026-10-09T08:00:00Z',
  },
];

// (class, [students]) confirmed at seed time.
const CONFIRMED: Array<[string, string[]]> = [
  [
    IDS.classes.threeConfirmed,
    [IDS.students.emmaTan, IDS.students.ethanTan, IDS.students.noahLim],
  ],
  [
    IDS.classes.full,
    [
      IDS.students.emmaTan,
      IDS.students.ethanTan,
      IDS.students.noahLim,
      IDS.students.oliviaLim,
    ],
  ],
];

// Insert all fixtures on the given transaction handle. Shared by the
// `db:seed` script and the test helper's resetDb().
export async function seedInto(tx: postgres.TransactionSql) {
  await tx`INSERT INTO students ${tx(STUDENTS, 'id', 'parent_name', 'name')}`;
  await tx`INSERT INTO classes ${tx(CLASSES, 'id', 'name', 'starts_at')}`;

  for (const [classId, studentIds] of CONFIRMED) {
    for (const studentId of studentIds) {
      const [booking] = await tx`
        INSERT INTO bookings (class_id, student_id, status)
        VALUES (${classId}, ${studentId}, 'CONFIRMED')
        RETURNING id
      `;
      await tx`
        INSERT INTO payments (booking_id, amount, status)
        VALUES (${booking.id}, 50.00, 'SETTLED')
      `;
    }
  }
}

async function seed() {
  await sql.begin(seedInto);

  console.log(
    `seeded ${STUDENTS.length} students, ${CLASSES.length} classes, ` +
      `${CONFIRMED.reduce((n, [, s]) => n + s.length, 0)} confirmed bookings`,
  );
}

// Only run when invoked directly (`pnpm db:seed`), not when imported by tests.
if (process.argv[1]?.endsWith('seed.ts')) {
  seed()
    .then(() => sql.end())
    .catch(async (err) => {
      console.error(err);
      await sql.end();
      process.exit(1);
    });
}
