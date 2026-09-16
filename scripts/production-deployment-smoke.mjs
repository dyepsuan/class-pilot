import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { resolve } from "node:path";

if (!process.argv.includes("--production")) {
  throw new Error("Refusing to run without the explicit --production flag.");
}

const base = "https://class-pilot.jeffacedillo97.workers.dev";
const database = "db_classpilot";
const databaseId = "84daf3b6-8a6c-4971-a51f-6de463fb2a39";
const bucket = "class-pilot-dropbox";
const namespace = `deploy-smoke-${randomUUID()}`;
const instructorToken = randomUUID();
const otherInstructorToken = randomUUID();
const studentToken = randomUUID();
const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const hash = (value) => createHash("sha256").update(value).digest("base64url");
const sqlString = (value) => `'${String(value).replaceAll("'", "''")}'`;
const uuidPattern =
  "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const storageKeyPattern = new RegExp(
  `^(?:class-files/[1-9]\\d*/${uuidPattern}/${uuidPattern}|dropbox/[1-9]\\d*/[1-9]\\d*/${uuidPattern})$`,
  "iu",
);

let instructorId;
let otherInstructorId;
let studentId;
let classId;
let otherClassId;
let classFileId;
let otherClassFileId;
let studentFileId;

function wrangler(args) {
  return execFileSync(process.execPath, [resolve("node_modules/wrangler/bin/wrangler.js"), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  });
}

function d1(command) {
  const output = wrangler([
    "d1",
    "execute",
    database,
    "--remote",
    "--json",
    "--command",
    command,
  ]);
  return JSON.parse(output);
}

function rows(command, resultIndex = 0) {
  return d1(command)[resultIndex]?.results ?? [];
}

function first(command, resultIndex = 0) {
  return rows(command, resultIndex)[0] ?? null;
}

function unreadCount(fileId, targetStudentId) {
  return first(`
    SELECT COUNT(*) AS count
    FROM class_files cf
    INNER JOIN classes c ON c.id = cf.class_id
    INNER JOIN enrollments e ON e.class_id = cf.class_id
    WHERE cf.id = ${sqlString(fileId)}
      AND e.student_id = ${targetStudentId}
      AND e.status = 'ACTIVE'
      AND c.status = 'ACTIVE'
      AND NOT EXISTS (
        SELECT 1 FROM class_file_views v
        WHERE v.class_file_id = cf.id
          AND v.student_id = e.student_id
          AND v.version = cf.version
      );
  `).count;
}

function deleteR2Object(storageKey) {
  if (!storageKeyPattern.test(storageKey)) {
    throw new Error("Refusing to delete an invalid smoke-test storage key.");
  }
  wrangler(["r2", "object", "delete", `${bucket}/${storageKey}`, "--remote", "--force"]);
}

async function expectStatus(response, status, label) {
  const body = await response.clone().text();
  assert.equal(response.status, status, `${label}: ${body}`);
  return body;
}

async function fetchPage(path, cookie, label) {
  const response = await fetch(`${base}${path}`, { headers: { cookie } });
  await expectStatus(response, 200, label);
}

const instructorCookie = `class_pilot_session=${instructorToken}`;
const otherInstructorCookie = `class_pilot_session=${otherInstructorToken}`;
const studentCookie = () =>
  `class_pilot_student_session=${studentToken}; class_pilot_student_class=${classId}`;

try {
  const info = JSON.parse(wrangler(["d1", "info", database, "--json"]));
  assert.equal(info.uuid, databaseId, "Wrangler is targeting the wrong production D1 database.");

  d1(`
    INSERT INTO users (email, display_name, auth_id)
    VALUES (${sqlString(`${namespace}-instructor@example.invalid`)}, 'Deployment smoke instructor', ${sqlString(instructorToken)});
    INSERT INTO users (email, display_name, auth_id)
    VALUES (${sqlString(`${namespace}-other@example.invalid`)}, 'Deployment smoke other instructor', ${sqlString(otherInstructorToken)});
    INSERT INTO students (student_number, first_name, last_name, email)
    VALUES (${sqlString(namespace)}, 'Deployment', 'Smoke', ${sqlString(`${namespace}-student@example.invalid`)});
  `);

  const fixtureIds = first(`
    SELECT
      (SELECT id FROM users WHERE auth_id = ${sqlString(instructorToken)}) AS instructor_id,
      (SELECT id FROM users WHERE auth_id = ${sqlString(otherInstructorToken)}) AS other_instructor_id,
      (SELECT id FROM students WHERE student_number = ${sqlString(namespace)}) AS student_id;
  `);
  assert.ok(fixtureIds?.instructor_id && fixtureIds.other_instructor_id && fixtureIds.student_id);
  instructorId = fixtureIds.instructor_id;
  otherInstructorId = fixtureIds.other_instructor_id;
  studentId = fixtureIds.student_id;

  d1(`
    INSERT INTO classes (instructor_id, subject_code, subject_name, section, school_year, term)
    VALUES (${instructorId}, 'SMOKE', 'Deployment verification', ${sqlString(namespace)}, '2026-2027', '1ST_SEMESTER');
    INSERT INTO classes (instructor_id, subject_code, subject_name, section, school_year, term)
    VALUES (${otherInstructorId}, 'OTHER', 'Authorization verification', ${sqlString(namespace)}, '2026-2027', '1ST_SEMESTER');
  `);
  const classIds = first(`
    SELECT
      (SELECT id FROM classes WHERE instructor_id = ${instructorId} AND section = ${sqlString(namespace)}) AS class_id,
      (SELECT id FROM classes WHERE instructor_id = ${otherInstructorId} AND section = ${sqlString(namespace)}) AS other_class_id;
  `);
  assert.ok(classIds?.class_id && classIds.other_class_id);
  classId = classIds.class_id;
  otherClassId = classIds.other_class_id;

  d1(`
    INSERT INTO enrollments (class_id, student_id, status)
    VALUES (${classId}, ${studentId}, 'ACTIVE');
    INSERT INTO auth_sessions (id, user_id, token_hash, expires_at)
    VALUES (${sqlString(randomUUID())}, ${sqlString(instructorToken)}, ${sqlString(hash(instructorToken))}, ${sqlString(expiresAt)});
    INSERT INTO auth_sessions (id, user_id, token_hash, expires_at)
    VALUES (${sqlString(randomUUID())}, ${sqlString(otherInstructorToken)}, ${sqlString(hash(otherInstructorToken))}, ${sqlString(expiresAt)});
    INSERT INTO student_sessions (id, student_id, session_token_hash, expires_at)
    VALUES (${sqlString(randomUUID())}, ${studentId}, ${sqlString(hash(studentToken))}, ${sqlString(expiresAt)});
  `);

  const authProof = first(`
    SELECT s.id AS session_id, u.id AS user_id, u.role, c.id AS class_id
    FROM auth_sessions s
    INNER JOIN users u ON u.auth_id = s.user_id
    INNER JOIN classes c ON c.instructor_id = u.id
    WHERE s.token_hash = ${sqlString(hash(instructorToken))}
      AND s.expires_at > CURRENT_TIMESTAMP
      AND c.id = ${classId};
  `);
  assert.ok(authProof?.session_id);
  assert.equal(authProof.user_id, instructorId);
  assert.equal(authProof.role, "INSTRUCTOR");
  assert.equal(authProof.class_id, classId);
  console.log(`AUTH PROOF remote D1: user ${instructorId} manages class ${classId}.`);

  await fetchPage(`/classes/${classId}/dropbox`, instructorCookie, "instructor Dropbox");
  await fetchPage(
    `/classes/${classId}/dropbox?section=student`,
    instructorCookie,
    "instructor Student Files tab",
  );

  const classContent = "%PDF-1.4\nProduction Class Files smoke\n%%EOF";
  const classTitle = `Deployment smoke ${namespace}`;
  const classForm = new FormData();
  classForm.set("class", String(classId));
  classForm.set("title", classTitle);
  classForm.set("description", "Temporary production deployment verification");
  classForm.set(
    "file",
    new File([classContent], "production-class-smoke.pdf", { type: "application/pdf" }),
  );
  const upload = await fetch(`${base}/api/classes/${classId}/class-files`, {
    method: "POST",
    body: classForm,
    headers: { cookie: instructorCookie, origin: base },
  });
  await expectStatus(upload, 200, "Class File upload");
  const classRow = first(
    `SELECT * FROM class_files WHERE class_id = ${classId} AND title = ${sqlString(classTitle)};`,
  );
  assert.ok(classRow);
  classFileId = classRow.id;
  assert.equal(unreadCount(classFileId, studentId), 1);

  for (const action of ["view", "download"]) {
    const response = await fetch(
      `${base}/api/classes/${classId}/class-files/${classFileId}/${action}`,
      { headers: { cookie: instructorCookie } },
    );
    assert.equal(await expectStatus(response, 200, `instructor ${action}`), classContent);
  }

  await fetchPage("/student/dropbox", studentCookie(), "student Dropbox default");
  await fetchPage("/student", studentCookie(), "student dashboard unread");
  assert.equal(
    first(
      `SELECT COUNT(*) AS count FROM class_file_views WHERE class_file_id = ${sqlString(classFileId)};`,
    ).count,
    0,
  );
  const studentView = await fetch(`${base}/api/student/class-files/${classFileId}/view`, {
    headers: { cookie: studentCookie() },
  });
  assert.equal(await expectStatus(studentView, 200, "student Class File view"), classContent);
  assert.deepEqual(
    rows(
      `SELECT version FROM class_file_views WHERE class_file_id = ${sqlString(classFileId)} ORDER BY version;`,
    ).map((row) => row.version),
    [1],
  );
  assert.equal(unreadCount(classFileId, studentId), 0);
  await fetchPage(
    "/student/dropbox?section=class",
    studentCookie(),
    "student Class Files deep link",
  );
  await fetchPage("/student", studentCookie(), "student dashboard read state");

  const editedTitle = `Deployment smoke edited ${namespace}`;
  const edit = await fetch(`${base}/api/classes/${classId}/class-files/${classFileId}`, {
    method: "PATCH",
    headers: {
      cookie: instructorCookie,
      origin: base,
      "content-type": "application/json",
    },
    body: JSON.stringify({ title: editedTitle, description: "Temporary edited description" }),
  });
  await expectStatus(edit, 200, "Class File edit");
  assert.deepEqual(
    first(`SELECT title, version FROM class_files WHERE id = ${sqlString(classFileId)};`),
    { title: editedTitle, version: 1 },
  );

  const replacementContent = "%PDF-1.4\nProduction replacement smoke\n%%EOF";
  const replacement = new FormData();
  replacement.set(
    "file",
    new File([replacementContent], "production-class-replacement.pdf", {
      type: "application/pdf",
    }),
  );
  const replaced = await fetch(
    `${base}/api/classes/${classId}/class-files/${classFileId}/replace`,
    {
      method: "POST",
      body: replacement,
      headers: { cookie: instructorCookie, origin: base },
    },
  );
  await expectStatus(replaced, 200, "Class File replacement");
  assert.equal(
    first(`SELECT version FROM class_files WHERE id = ${sqlString(classFileId)};`).version,
    2,
  );
  assert.deepEqual(
    rows(
      `SELECT version FROM class_file_views WHERE class_file_id = ${sqlString(classFileId)} ORDER BY version;`,
    ).map((row) => row.version),
    [1],
  );
  assert.equal(unreadCount(classFileId, studentId), 1);
  await fetchPage("/student", studentCookie(), "replacement dashboard unread");
  const replacementDownload = await fetch(
    `${base}/api/student/class-files/${classFileId}/download`,
    { headers: { cookie: studentCookie() } },
  );
  assert.equal(
    await expectStatus(replacementDownload, 200, "student replacement download"),
    replacementContent,
  );
  assert.match(
    replacementDownload.headers.get("content-disposition") ?? "",
    /production-class-replacement\.pdf/,
  );
  assert.deepEqual(
    rows(
      `SELECT version FROM class_file_views WHERE class_file_id = ${sqlString(classFileId)} ORDER BY version;`,
    ).map((row) => row.version),
    [1, 2],
  );
  assert.equal(unreadCount(classFileId, studentId), 0);
  await fetchPage("/student", studentCookie(), "replacement dashboard read state");

  const unauthorizedInstructor = await fetch(
    `${base}/api/classes/${classId}/class-files/${classFileId}/download`,
    { headers: { cookie: otherInstructorCookie } },
  );
  assert.equal(unauthorizedInstructor.status, 404);

  const otherClassTitle = `Other class smoke ${namespace}`;
  const otherClassForm = new FormData();
  otherClassForm.set("class", String(otherClassId));
  otherClassForm.set("title", otherClassTitle);
  otherClassForm.set("description", "Temporary authorization verification");
  otherClassForm.set(
    "file",
    new File([classContent], "other-class-smoke.pdf", { type: "application/pdf" }),
  );
  const otherUpload = await fetch(`${base}/api/classes/${otherClassId}/class-files`, {
    method: "POST",
    body: otherClassForm,
    headers: { cookie: otherInstructorCookie, origin: base },
  });
  await expectStatus(otherUpload, 200, "other-class fixture upload");
  const otherRow = first(
    `SELECT * FROM class_files WHERE class_id = ${otherClassId} AND title = ${sqlString(otherClassTitle)};`,
  );
  assert.ok(otherRow);
  otherClassFileId = otherRow.id;
  const otherClassAccess = await fetch(
    `${base}/api/student/class-files/${otherClassFileId}/download`,
    { headers: { cookie: studentCookie() } },
  );
  assert.equal(otherClassAccess.status, 404);

  d1(
    `UPDATE enrollments SET status = 'DROPPED' WHERE class_id = ${classId} AND student_id = ${studentId};`,
  );
  const droppedAccess = await fetch(
    `${base}/api/student/class-files/${classFileId}/download`,
    { headers: { cookie: studentCookie() } },
  );
  assert.equal(droppedAccess.status, 404);
  d1(
    `UPDATE enrollments SET status = 'ACTIVE' WHERE class_id = ${classId} AND student_id = ${studentId};`,
  );

  const studentContent = "%PDF-1.4\nProduction Student Files known length\n%%EOF";
  const studentForm = new FormData();
  studentForm.set(
    "files",
    new File([studentContent], "student-production-smoke.pdf", {
      type: "application/pdf",
    }),
  );
  const studentUpload = await fetch(`${base}/api/student/dropbox`, {
    method: "POST",
    body: studentForm,
    headers: { cookie: studentCookie(), origin: base },
  });
  const studentUploadJson = await studentUpload.json();
  assert.equal(studentUpload.status, 200, JSON.stringify(studentUploadJson));
  assert.equal(studentUploadJson.uploadedCount, 1);
  assert.equal(studentUploadJson.failedCount, 0);
  const studentRow = first(
    `SELECT * FROM dropbox_files WHERE class_id = ${classId} AND student_id = ${studentId};`,
  );
  assert.ok(studentRow);
  studentFileId = studentRow.id;
  await fetchPage(
    "/student/dropbox?section=student",
    studentCookie(),
    "student Student Files tab",
  );
  const studentDownload = await fetch(
    `${base}/api/student/dropbox/${studentFileId}/download`,
    { headers: { cookie: studentCookie() } },
  );
  assert.equal(
    await expectStatus(studentDownload, 200, "Student File download"),
    studentContent,
  );
  assert.match(
    studentDownload.headers.get("content-disposition") ?? "",
    /student-production-smoke\.pdf/,
  );
  const studentDelete = await fetch(`${base}/api/student/dropbox/${studentFileId}`, {
    method: "DELETE",
    headers: { cookie: studentCookie(), origin: base },
  });
  await expectStatus(studentDelete, 200, "Student File delete");
  assert.equal(
    first(`SELECT COUNT(*) AS count FROM dropbox_files WHERE id = ${sqlString(studentFileId)};`)
      .count,
    0,
  );
  studentFileId = undefined;

  for (const [targetClassId, targetFileId, cookie] of [
    [classId, classFileId, instructorCookie],
    [otherClassId, otherClassFileId, otherInstructorCookie],
  ]) {
    const response = await fetch(
      `${base}/api/classes/${targetClassId}/class-files/${targetFileId}`,
      { method: "DELETE", headers: { cookie, origin: base } },
    );
    await expectStatus(response, 200, "Class File delete");
  }
  classFileId = undefined;
  otherClassFileId = undefined;

  console.log(
    "PASS production smoke: instructor Class Files upload/list route/View/Download/Edit/Replace/Delete; student Class Files route/NEW tracking/View/Download/dashboard routes; Student Files upload/download/delete; unmanaged, other-class, and dropped access denial.",
  );
} finally {
  try {
    const fixtureClassIds = [classId, otherClassId].filter(Number.isInteger);
    if (fixtureClassIds.length > 0) {
      const fileRows = rows(`
        SELECT storage_key FROM class_files WHERE class_id IN (${fixtureClassIds.join(",")})
        UNION ALL
        SELECT storage_key FROM dropbox_files WHERE class_id IN (${fixtureClassIds.join(",")});
      `);
      for (const row of fileRows) deleteR2Object(row.storage_key);
      d1(`
        DELETE FROM class_files WHERE class_id IN (${fixtureClassIds.join(",")});
        DELETE FROM dropbox_files WHERE class_id IN (${fixtureClassIds.join(",")});
      `);
    }
    if (studentId) {
      d1(`
        DELETE FROM student_sessions WHERE student_id = ${studentId};
        DELETE FROM enrollments WHERE student_id = ${studentId};
        DELETE FROM students WHERE id = ${studentId};
      `);
    }
    if (classId || otherClassId) {
      d1(
        `DELETE FROM classes WHERE id IN (${[classId, otherClassId].filter(Number.isInteger).join(",")});`,
      );
    }
    d1(`
      DELETE FROM auth_sessions WHERE user_id IN (${sqlString(instructorToken)}, ${sqlString(otherInstructorToken)});
      DELETE FROM users WHERE auth_id IN (${sqlString(instructorToken)}, ${sqlString(otherInstructorToken)});
    `);
    const remaining = first(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE email LIKE ${sqlString(`${namespace}-%`)}) AS users,
        (SELECT COUNT(*) FROM students WHERE student_number = ${sqlString(namespace)}) AS students,
        (SELECT COUNT(*) FROM classes WHERE section = ${sqlString(namespace)}) AS classes;
    `);
    assert.deepEqual(remaining, { users: 0, students: 0, classes: 0 });
    console.log(`CLEANUP production smoke fixtures: ${namespace}`);
  } catch (cleanupError) {
    console.error(`CLEANUP FAILED for namespace ${namespace}:`, cleanupError);
    throw cleanupError;
  }
}
