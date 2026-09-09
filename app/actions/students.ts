'use server';

import { sql } from '@/lib/db';
import type { ActionResult, StudentOption } from './types';

/** Every student, for the parent's "choose a child" dropdown. No auth — a
 *  real system would scope this to the signed-in parent. */
export async function listStudents(): Promise<ActionResult<StudentOption[]>> {
  const rows = await sql`
    SELECT id, name, parent_name
    FROM students
    ORDER BY parent_name, name
  `;

  return {
    ok: true,
    data: rows.map((r) => ({
      id: r.id,
      name: r.name,
      parentName: r.parent_name,
    })),
  };
}
