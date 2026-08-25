"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";

function requiredString(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name} is required.`);
  }

  return value.trim();
}

function optionalString(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed === "" ? null : trimmed;
}

export type UpdateStudentValues = {
  student_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  email: string | null;
};

type UpdateStudentField = keyof UpdateStudentValues;

export type UpdateStudentState = {
  success?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<UpdateStudentField, string>>;
  student?: UpdateStudentValues;
};

function trimmedFormString(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isDuplicateStudentNumberError(error: unknown) {
  return /unique constraint failed:\s*students\.student_number|constraint_unique/i.test(
    String(error)
  );
}

export type EnrollmentActionResult = {
  success?: boolean;
  error?: string;
};

function revalidateEnrollmentRoutes(
  classId: number,
  studentId: number
) {
  revalidatePath(`/classes/${classId}`);
  revalidatePath(`/classes/${classId}/students`);
  revalidatePath(`/classes/${classId}/students/${studentId}`);
  revalidatePath(`/classes/${classId}/students/${studentId}/qr`);
  revalidatePath(`/classes/${classId}/attendance`);
  revalidatePath(`/classes/${classId}/quizzes`);
  revalidatePath(`/classes/${classId}/laboratories`);
}

export async function archiveStudentEnrollment(
  classId: number,
  studentId: number
): Promise<EnrollmentActionResult> {
  await requireUser();

  if (!Number.isInteger(classId) || classId <= 0) {
    return { error: "Invalid class." };
  }

  if (!Number.isInteger(studentId) || studentId <= 0) {
    return { error: "Invalid student." };
  }

  const { env } = getCloudflareContext();
  const [classRecord, studentRecord, enrollment] = await Promise.all([
    env.DB.prepare("SELECT id FROM classes WHERE id = ?1 LIMIT 1")
      .bind(classId)
      .first<{ id: number }>(),
    env.DB.prepare("SELECT id FROM students WHERE id = ?1 LIMIT 1")
      .bind(studentId)
      .first<{ id: number }>(),
    env.DB.prepare(
      `
        SELECT id, status
        FROM enrollments
        WHERE class_id = ?1
          AND student_id = ?2
        LIMIT 1
      `
    )
      .bind(classId, studentId)
      .first<{ id: number; status: string }>(),
  ]);

  if (!classRecord) {
    return { error: "Class not found." };
  }

  if (!studentRecord) {
    return { error: "Student not found." };
  }

  if (!enrollment) {
    return { error: "Student is not enrolled in this class." };
  }

  if (enrollment.status !== "ACTIVE") {
    return { error: "This student is already archived from this class." };
  }

  const result = await env.DB.prepare(
    `
      UPDATE enrollments
      SET
        status = 'DROPPED',
        left_on = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?1
        AND status = 'ACTIVE'
    `
  )
    .bind(enrollment.id)
    .run();

  if (!result.success || result.meta.changes !== 1) {
    return { error: "Could not remove the student from this class." };
  }

  revalidateEnrollmentRoutes(classId, studentId);

  return { success: true };
}

export async function restoreStudentEnrollment(
  classId: number,
  studentId: number
): Promise<EnrollmentActionResult> {
  await requireUser();

  if (!Number.isInteger(classId) || classId <= 0) {
    return { error: "Invalid class." };
  }

  if (!Number.isInteger(studentId) || studentId <= 0) {
    return { error: "Invalid student." };
  }

  const { env } = getCloudflareContext();
  const [classRecord, studentRecord, enrollment] = await Promise.all([
    env.DB.prepare("SELECT id FROM classes WHERE id = ?1 LIMIT 1")
      .bind(classId)
      .first<{ id: number }>(),
    env.DB.prepare("SELECT id FROM students WHERE id = ?1 LIMIT 1")
      .bind(studentId)
      .first<{ id: number }>(),
    env.DB.prepare(
      `
        SELECT id, status
        FROM enrollments
        WHERE class_id = ?1
          AND student_id = ?2
        LIMIT 1
      `
    )
      .bind(classId, studentId)
      .first<{ id: number; status: string }>(),
  ]);

  if (!classRecord) {
    return { error: "Class not found." };
  }

  if (!studentRecord) {
    return { error: "Student not found." };
  }

  if (!enrollment) {
    return { error: "Student is not enrolled in this class." };
  }

  if (enrollment.status === "ACTIVE") {
    return { error: "This student is already active in this class." };
  }

  const result = await env.DB.prepare(
    `
      UPDATE enrollments
      SET
        status = 'ACTIVE',
        left_on = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?1
        AND status <> 'ACTIVE'
    `
  )
    .bind(enrollment.id)
    .run();

  if (!result.success || result.meta.changes !== 1) {
    return { error: "Could not restore the student to this class." };
  }

  revalidateEnrollmentRoutes(classId, studentId);

  return { success: true };
}

export async function updateStudent(
  classId: number,
  studentId: number,
  previousState: UpdateStudentState,
  formData: FormData
): Promise<UpdateStudentState> {
  await requireUser();

  void previousState;

  if (!Number.isInteger(classId) || classId <= 0) {
    return { error: "Invalid class." };
  }

  if (!Number.isInteger(studentId) || studentId <= 0) {
    return { error: "Invalid student." };
  }

  const studentNumber = trimmedFormString(
    formData,
    "student_number"
  );
  const firstName = trimmedFormString(formData, "first_name");
  const lastName = trimmedFormString(formData, "last_name");
  const middleName = optionalString(formData, "middle_name");
  const suffix = optionalString(formData, "suffix");
  const email = optionalString(formData, "email");
  const fieldErrors: UpdateStudentState["fieldErrors"] = {};

  if (!studentNumber) {
    fieldErrors.student_number = "Student number is required.";
  }

  if (!firstName) {
    fieldErrors.first_name = "First name is required.";
  }

  if (!lastName) {
    fieldErrors.last_name = "Last name is required.";
  }

  if (email && !isValidEmail(email)) {
    fieldErrors.email = "Enter a valid email address.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      error: "Review the highlighted fields.",
      fieldErrors,
    };
  }

  const { env } = getCloudflareContext();

  try {
    const classExists = await env.DB.prepare(
      `
        SELECT id
        FROM classes
        WHERE id = ?1
        LIMIT 1
      `
    )
      .bind(classId)
      .first<{ id: number }>();

    if (!classExists) {
      return { error: "Class not found." };
    }

    const studentInClass = await env.DB.prepare(
      `
        SELECT s.id
        FROM students s
        INNER JOIN enrollments e
          ON e.student_id = s.id
        WHERE s.id = ?1
          AND e.class_id = ?2
        LIMIT 1
      `
    )
      .bind(studentId, classId)
      .first<{ id: number }>();

    if (!studentInClass) {
      return { error: "Student not found in this class." };
    }

    const duplicateStudent = await env.DB.prepare(
      `
        SELECT id
        FROM students
        WHERE student_number = ?1
          AND id <> ?2
        LIMIT 1
      `
    )
      .bind(studentNumber, studentId)
      .first<{ id: number }>();

    if (duplicateStudent) {
      return {
        error: "A student with this student number already exists.",
        fieldErrors: {
          student_number:
            "A student with this student number already exists.",
        },
      };
    }

    const result = await env.DB.prepare(
      `
        UPDATE students
        SET
          student_number = ?1,
          first_name = ?2,
          middle_name = ?3,
          last_name = ?4,
          suffix = ?5,
          email = ?6,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?7
          AND EXISTS (
            SELECT 1
            FROM enrollments e
            WHERE e.class_id = ?8
              AND e.student_id = students.id
          )
      `
    )
      .bind(
        studentNumber,
        firstName,
        middleName,
        lastName,
        suffix,
        email,
        studentId,
        classId
      )
      .run();

    if (!result.success || result.meta.changes !== 1) {
      return { error: "Could not update the student. Please try again." };
    }
  } catch (error) {
    if (isDuplicateStudentNumberError(error)) {
      return {
        error: "A student with this student number already exists.",
        fieldErrors: {
          student_number:
            "A student with this student number already exists.",
        },
      };
    }

    return { error: "Could not update the student. Please try again." };
  }

  const updatedStudent: UpdateStudentValues = {
    student_number: studentNumber,
    first_name: firstName,
    middle_name: middleName,
    last_name: lastName,
    suffix,
    email,
  };

  revalidatePath(`/classes/${classId}/students`);
  revalidatePath(`/classes/${classId}/students/${studentId}`);
  revalidatePath(`/classes/${classId}/students/${studentId}/qr`);

  return {
    success: true,
    student: updatedStudent,
  };
}

export async function addStudentToClass(
  classId: number,
  formData: FormData
) {
  await requireUser();

  if (!Number.isInteger(classId) || classId <= 0) {
    throw new Error("Invalid class.");
  }

  const studentNumber = requiredString(
    formData,
    "student_number"
  );

  const firstName = requiredString(
    formData,
    "first_name"
  );

  const lastName = requiredString(
    formData,
    "last_name"
  );

  const middleName = optionalString(
    formData,
    "middle_name"
  );

  const suffix = optionalString(
    formData,
    "suffix"
  );

  const email = optionalString(
    formData,
    "email"
  );

  const { env } = getCloudflareContext();

  const classExists = await env.DB.prepare(
    `
      SELECT id
      FROM classes
      WHERE id = ?1
      LIMIT 1
    `
  )
    .bind(classId)
    .first<{ id: number }>();

  if (!classExists) {
    throw new Error("Class not found.");
  }

  const existingStudent = await env.DB.prepare(
    `
      SELECT id
      FROM students
      WHERE student_number = ?1
      LIMIT 1
    `
  )
    .bind(studentNumber)
    .first<{ id: number }>();

  let studentId: number;
  let restoredEnrollment = false;

  if (existingStudent) {
    studentId = existingStudent.id;

    const existingEnrollment = await env.DB.prepare(
      `
        SELECT status
        FROM enrollments
        WHERE class_id = ?1
          AND student_id = ?2
        LIMIT 1
      `
    )
      .bind(classId, studentId)
      .first<{ status: string }>();

    restoredEnrollment =
      Boolean(existingEnrollment) &&
      existingEnrollment?.status !== "ACTIVE";
  } else {
    const result = await env.DB.prepare(
      `
        INSERT INTO students (
          student_number,
          first_name,
          middle_name,
          last_name,
          suffix,
          email
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)
      `
    )
      .bind(
        studentNumber,
        firstName,
        middleName,
        lastName,
        suffix,
        email
      )
      .run();

    studentId = Number(result.meta.last_row_id);
  }

  await env.DB.prepare(
    `
      INSERT INTO enrollments (
        class_id,
        student_id,
        status
      )
      VALUES (?1, ?2, 'ACTIVE')
      ON CONFLICT(class_id, student_id)
      DO UPDATE SET
        status = 'ACTIVE',
        left_on = NULL,
        updated_at = CURRENT_TIMESTAMP
    `
  )
    .bind(classId, studentId)
    .run();

  revalidatePath(`/classes/${classId}`);
  revalidatePath(`/classes/${classId}/students`);

  redirect(
    `/classes/${classId}/students${
      restoredEnrollment ? "?restored=1" : ""
    }`
  );
}
function normalizeCsvHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];

  let row: string[] = [];
  let field = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      if (insideQuotes && text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }

      continue;
    }

    if (char === "," && !insideQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if (
      (char === "\n" || char === "\r") &&
      !insideQuotes
    ) {
      if (char === "\r" && text[i + 1] === "\n") {
        i++;
      }

      row.push(field);

      const hasContent = row.some(
        (cell) => cell.trim() !== ""
      );

      if (hasContent) {
        rows.push(row);
      }

      row = [];
      field = "";

      continue;
    }

    field += char;
  }

  row.push(field);

  const hasContent = row.some(
    (cell) => cell.trim() !== ""
  );

  if (hasContent) {
    rows.push(row);
  }

  return rows;
}

type ImportedStudent = {
  student_number: string;
  last_name: string;
  first_name: string;
  middle_name: string | null;
  suffix: string | null;
  email: string | null;
};

export async function importStudentsFromCsv(
  classId: number,
  formData: FormData
) {
  await requireUser();

  if (!Number.isInteger(classId) || classId <= 0) {
    throw new Error("Invalid class.");
  }

  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Please select a CSV file.");
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    throw new Error("Only CSV files are supported.");
  }

  if (file.size > 1024 * 1024) {
    throw new Error(
      "CSV file is too large. Maximum size is 1 MB."
    );
  }

  const csvText = await file.text();

  const rows = parseCsv(csvText);

  if (rows.length < 2) {
    throw new Error(
      "The CSV does not contain any student records."
    );
  }

  const headers = rows[0].map(normalizeCsvHeader);

  const headerIndexes = new Map<string, number>();

  headers.forEach((header, index) => {
    headerIndexes.set(header, index);
  });

  const requiredHeaders = [
    "student_number",
    "last_name",
    "first_name",
  ];

  for (const header of requiredHeaders) {
    if (!headerIndexes.has(header)) {
      throw new Error(
        `Missing required CSV column: ${header}`
      );
    }
  }

  function getValue(
    row: string[],
    column: string
  ): string | null {
    const index = headerIndexes.get(column);

    if (index === undefined) {
      return null;
    }

    const value = row[index]?.trim();

    return value ? value : null;
  }

  const students: ImportedStudent[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    const studentNumber = getValue(
      row,
      "student_number"
    );

    const lastName = getValue(
      row,
      "last_name"
    );

    const firstName = getValue(
      row,
      "first_name"
    );

    if (
      !studentNumber ||
      !lastName ||
      !firstName
    ) {
      throw new Error(
        `CSV row ${i + 1} is missing a required value.`
      );
    }

    students.push({
      student_number: studentNumber,
      last_name: lastName,
      first_name: firstName,
      middle_name: getValue(
        row,
        "middle_name"
      ),
      suffix: getValue(
        row,
        "suffix"
      ),
      email: getValue(
        row,
        "email"
      ),
    });
  }

  if (students.length > 200) {
    throw new Error(
      "A single import can contain a maximum of 200 students."
    );
  }

  const seenStudentNumbers = new Set<string>();

  for (const student of students) {
    if (
      seenStudentNumbers.has(
        student.student_number
      )
    ) {
      throw new Error(
        `Duplicate student number in CSV: ${student.student_number}`
      );
    }

    seenStudentNumbers.add(
      student.student_number
    );
  }

  const { env } = getCloudflareContext();

  const classExists = await env.DB.prepare(
    `
      SELECT id
      FROM classes
      WHERE id = ?1
      LIMIT 1
    `
  )
    .bind(classId)
    .first<{ id: number }>();

  if (!classExists) {
    throw new Error("Class not found.");
  }

  const statements = students.flatMap(
    (student) => [
      env.DB.prepare(
        `
          INSERT INTO students (
            student_number,
            first_name,
            middle_name,
            last_name,
            suffix,
            email
          )
          VALUES (
            ?1,
            ?2,
            ?3,
            ?4,
            ?5,
            ?6
          )

          ON CONFLICT(student_number)
          DO UPDATE SET

            first_name =
              excluded.first_name,

            middle_name =
              COALESCE(
                excluded.middle_name,
                students.middle_name
              ),

            last_name =
              excluded.last_name,

            suffix =
              COALESCE(
                excluded.suffix,
                students.suffix
              ),

            email =
              COALESCE(
                excluded.email,
                students.email
              ),

            updated_at =
              CURRENT_TIMESTAMP
        `
      ).bind(
        student.student_number,
        student.first_name,
        student.middle_name,
        student.last_name,
        student.suffix,
        student.email
      ),

      env.DB.prepare(
        `
          INSERT INTO enrollments (
            class_id,
            student_id,
            status
          )

          SELECT
            ?1,
            id,
            'ACTIVE'

          FROM students

          WHERE student_number = ?2

          ON CONFLICT(class_id, student_id)
          DO UPDATE SET
            status = 'ACTIVE',
            left_on = NULL,
            updated_at = CURRENT_TIMESTAMP
        `
      ).bind(
        classId,
        student.student_number
      ),
    ]
  );

  await env.DB.batch(statements);

  revalidatePath(
    `/classes/${classId}`
  );

  revalidatePath(
    `/classes/${classId}/students`
  );

  redirect(
    `/classes/${classId}/students?imported=${students.length}`
  );
}
