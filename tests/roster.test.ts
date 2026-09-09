import { beforeEach, describe, expect, it } from 'vitest';
import { sql } from '../lib/db';
import { getClassRoster, listAvailableClasses } from '../app/actions/roster';
import { IDS, resetDb } from './helpers';

beforeEach(resetDb);

describe('listAvailableClasses', () => {
  it('returns every OPEN class with a live CONFIRMED count matching the DB', async () => {
    const result = await listAvailableClasses();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const byId = new Map(result.data.map((c) => [c.id, c]));

    // Seed: A empty, B 3 confirmed, C 4 confirmed — all OPEN.
    expect([...byId.keys()].sort()).toEqual(
      [IDS.classes.empty, IDS.classes.threeConfirmed, IDS.classes.full].sort(),
    );
    expect(byId.get(IDS.classes.empty)?.confirmedCount).toBe(0);
    expect(byId.get(IDS.classes.threeConfirmed)?.confirmedCount).toBe(3);
    expect(byId.get(IDS.classes.full)?.confirmedCount).toBe(4);
    for (const c of result.data) expect(c.capacity).toBe(4);

    // Cross-check each count against an independent aggregate query.
    const rows = await sql`
      SELECT c.id,
             COUNT(b.id) FILTER (WHERE b.status = 'CONFIRMED')::int AS confirmed
      FROM classes c
      LEFT JOIN bookings b ON b.class_id = c.id
      WHERE c.status = 'OPEN'
      GROUP BY c.id
    `;
    for (const row of rows) {
      expect(byId.get(row.id)?.confirmedCount).toBe(row.confirmed);
    }
  });
});

describe('getClassRoster', () => {
  it('returns exactly the CONFIRMED students for the class', async () => {
    const result = await getClassRoster(IDS.classes.threeConfirmed);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toMatchObject({
      classId: IDS.classes.threeConfirmed,
      capacity: 4,
      confirmedCount: 3,
    });
    expect(result.data.entries).toHaveLength(3);

    const actual = result.data.entries
      .map((e) => `${e.studentName} / ${e.parentName}`)
      .sort();
    const [expected] = [
      await sql`
        SELECT s.name, s.parent_name
        FROM bookings b
        JOIN students s ON s.id = b.student_id
        WHERE b.class_id = ${IDS.classes.threeConfirmed} AND b.status = 'CONFIRMED'
      `,
    ];
    expect(actual).toEqual(
      expected.map((r) => `${r.name} / ${r.parent_name}`).sort(),
    );
  });

  it('excludes non-CONFIRMED bookings and reports an empty roster for Class A', async () => {
    const result = await getClassRoster(IDS.classes.empty);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.confirmedCount).toBe(0);
    expect(result.data.entries).toEqual([]);

    const [{ count }] = await sql`
      SELECT COUNT(*)::int AS count FROM bookings
      WHERE class_id = ${IDS.classes.empty} AND status = 'CONFIRMED'
    `;
    expect(count).toBe(0);
  });
});
