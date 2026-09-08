import "server-only";

export const INSTRUCTOR_DROPBOX_ORDER_BY =
  "df.created_at DESC, df.id DESC";

export const INSTRUCTOR_DROPBOX_ENROLLMENT_STATUS_SELECT = `(
  SELECT e.status
  FROM enrollments e
  WHERE e.class_id = df.class_id
    AND e.student_id = df.student_id
  ORDER BY
    CASE WHEN e.status = 'ACTIVE' THEN 0 ELSE 1 END,
    datetime(e.updated_at) DESC,
    e.id DESC
  LIMIT 1
)`;

export type InstructorDropboxWhereInput = {
  classId: number;
  search: string | null;
  studentId: number | null;
  extensions: readonly string[];
};

export type InstructorDropboxWhereClause = {
  sql: string;
  bindings: Array<string | number>;
};

function escapeLikeValue(value: string): string {
  return value.replace(/[\\%_]/gu, "\\$&");
}

export function buildInstructorDropboxWhereClause({
  classId,
  search,
  studentId,
  extensions,
}: InstructorDropboxWhereInput): InstructorDropboxWhereClause {
  const conditions = ["df.class_id = ?1"];
  const bindings: Array<string | number> = [classId];

  if (search) {
    bindings.push(`%${escapeLikeValue(search)}%`);
    const placeholder = `?${bindings.length}`;
    conditions.push(`(
      df.display_name LIKE ${placeholder} ESCAPE '\\'
      OR df.original_filename LIKE ${placeholder} ESCAPE '\\'
      OR s.first_name LIKE ${placeholder} ESCAPE '\\'
      OR s.last_name LIKE ${placeholder} ESCAPE '\\'
      OR s.student_number LIKE ${placeholder} ESCAPE '\\'
      OR (s.first_name || ' ' || s.last_name) LIKE ${placeholder} ESCAPE '\\'
      OR (s.last_name || ', ' || s.first_name) LIKE ${placeholder} ESCAPE '\\'
    )`);
  }

  if (studentId !== null) {
    bindings.push(studentId);
    conditions.push(`df.student_id = ?${bindings.length}`);
  }

  if (extensions.length > 0) {
    const extensionConditions = extensions.map((extension) => {
      bindings.push(`%.${extension}`);
      return `lower(df.original_filename) LIKE ?${bindings.length}`;
    });
    conditions.push(`(${extensionConditions.join(" OR ")})`);
  }

  return {
    sql: conditions.join("\n        AND "),
    bindings,
  };
}
