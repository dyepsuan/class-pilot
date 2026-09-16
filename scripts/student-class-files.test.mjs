import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import ts from "typescript";

const encodedModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const mocks = {
  "@/lib/auth/student-session": encodedModule("export const getStudentSession = async () => globalThis.__classFileTest.student;"),
  "@opennextjs/cloudflare": encodedModule("export const getCloudflareContext = () => ({ env: globalThis.__classFileTest.env });"),
  "@/lib/auth/session": encodedModule("export const getCurrentUser = async () => globalThis.__classFileTest.user;"),
  "next/cache": encodedModule("export const revalidatePath = (path) => globalThis.__classFileTest.refreshed.push(path);"),
};
const cache = new Map();
async function moduleUrl(url) {
  if (cache.has(url.href)) return cache.get(url.href);
  const source = await readFile(url, "utf8");
  let js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
  } }).outputText.replace(/import ["']server-only["'];\r?\n/gu, "");
  for (const match of [...js.matchAll(/from ["']([^"']+)["']/gu)]) {
    const name = match[1];
    let resolved = mocks[name];
    if (!resolved) {
      const dependency = name.startsWith("@/")
        ? new URL("../src/" + name.slice(2) + ".ts", import.meta.url)
        : new URL(name + ".ts", url);
      resolved = await moduleUrl(dependency);
    }
    js = js.replace(match[0], `from "${resolved}"`);
  }
  const result = encodedModule(js);
  cache.set(url.href, result);
  return result;
}
async function load(path) { return import(await moduleUrl(new URL(path, import.meta.url))); }

const studentView = await load("../src/app/api/student/class-files/[fileId]/view/route.ts");
const studentDownload = await load("../src/app/api/student/class-files/[fileId]/download/route.ts");
const dbHelpers = await load("../src/lib/db/class-files.ts");
const uploadRoute = await load("../src/app/api/classes/[classId]/class-files/route.ts");

const instructor = { id: 1, role: "INSTRUCTOR" };
const otherInstructor = { id: 2, role: "INSTRUCTOR" };
const pdf = (name = "教材.pdf") => new File(["%PDF-1.4\nClass material\n%%EOF"], name, { type: "application/pdf" });
const props = (classId = "1", fileId) => ({ params: Promise.resolve({ classId, fileId }) });
const request = (method, body, origin = "http://localhost") => new Request("http://localhost/api", {
  method, body, headers: body instanceof FormData ? { origin } : { origin, "Content-Type": "application/json" },
});
function form(scope = "1", file = pdf(), title = "  Reviewer  ") {
  const data = new FormData();
  data.set("class", scope); data.set("title", title); data.set("description", "  Read this.  ");
  data.set("file", file);
  return data;
}

async function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  const root = new URL("../migrations/", import.meta.url);
  for (const name of (await readdir(root)).filter((name) => name.endsWith(".sql")).sort()) {
    sqlite.exec(await readFile(new URL(name, root), "utf8"));
  }
  sqlite.exec(`INSERT INTO users (id, email, display_name, auth_id) VALUES
    (1, 'owner@test', 'Owner', 'owner'), (2, 'other@test', 'Other', 'other');
    INSERT INTO classes (id, instructor_id, subject_code, subject_name, section, school_year, term)
    VALUES (1, 1, 'A', 'A', 'A', '2026', '1ST_SEMESTER'),
      (2, 1, 'B', 'B', 'B', '2026', '1ST_SEMESTER'),
      (3, 2, 'C', 'C', 'C', '2026', '1ST_SEMESTER');
    INSERT INTO students (id, student_number, first_name, last_name) VALUES (1, '1', 'Juan', 'Cruz');`);
  const objects = new Map();
  const events = [];
  const state = { user: instructor, refreshed: [], env: {
    DB: {
      prepare(sql) {
        return {
          bindings: [],
          bind(...values) { this.bindings = values; return this; },
          statement() {
            const statement = sqlite.prepare(sql);
            const params = Object.fromEntries(this.bindings.map((value, index) => ["?" + (index + 1), value]));
            return { statement, params };
          },
          async run() {
            const { statement, params } = this.statement();
            const result = statement.run(params);
            events.push("db");
            return { success: true, meta: { changes: Number(result.changes) } };
          },
          async first() { const { statement, params } = this.statement(); return statement.get(params) || null; },
          async all() { const { statement, params } = this.statement(); return { results: statement.all(params) }; },
        };
      },
      async batch(statements) {
        sqlite.exec("BEGIN");
        try {
          const results = [];
          for (const statement of statements) results.push(await statement.run());
          sqlite.exec("COMMIT");
          return results;
        } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
      },
    },
    DROPBOX_BUCKET: {
      async put(key, body, options) { events.push("put:" + key); objects.set(key, { body, type: options.httpMetadata.contentType }); return {}; },
      async get(key) {
        const object = objects.get(key);
        return object ? { body: object.body, size: object.body.byteLength } : null;
      },
      async delete(key) { events.push("delete:" + key); objects.delete(key); },
    },
  }};
  globalThis.__classFileTest = state;
  return { sqlite, objects, events, state, close: () => sqlite.close() };
}

async function studentFixture() {
  const f = await fixture();
  f.state.student = { id: 1 };
  f.sqlite.exec("INSERT INTO enrollments (class_id, student_id, status) VALUES (1, 1, 'ACTIVE'), (2, 1, 'ACTIVE')");
  for (const classId of [1, 2, 3]) {
    assert.equal((await uploadRoute.POST(request("POST", form(String(classId))), props(String(classId)))).status, classId === 3 ? 404 : 200);
  }
  f.state.user = otherInstructor;
  await uploadRoute.POST(request("POST", form("3")), props("3"));
  f.rows = f.sqlite.prepare("SELECT * FROM class_files ORDER BY class_id").all();
  return f;
}
const studentProps = (fileId) => ({ params: Promise.resolve({ fileId }) });
const get = (route, id, query = "") => route.GET(new Request("http://localhost/api/student/class-files/" + id + query), studentProps(id));

test("selected active class listing is isolated, key-free and excludes implementation details", async () => {
  const f = await studentFixture();
  try {
    for (const id of [1, 2]) {
      const files = await dbHelpers.listClassFilesForActiveStudentClass(id, 1);
      assert.deepEqual(files.map(file => file.classId), [id]);
      for (const key of ["storageKey", "version", "uploadedBy"]) assert.equal(key in files[0], false);
    }
    assert.deepEqual(await dbHelpers.listClassFilesForActiveStudentClass(3, 1), []);
    assert.deepEqual(await dbHelpers.listClassFilesForActiveStudentClass(1, 999), []);
  } finally { f.close(); }
});

test("listing sorts newest first with deterministic ID tie ordering", async () => {
  const f = await studentFixture();
  try {
    f.state.user = instructor;
    await uploadRoute.POST(request("POST", form("1")), props("1"));
    f.state.user = instructor;
    await uploadRoute.POST(request("POST", form("1")), props("1"));
    const rows = f.sqlite.prepare("SELECT id FROM class_files WHERE class_id=1 ORDER BY id").all();
    f.sqlite.prepare("UPDATE class_files SET created_at='2026-09-16 01:00:00' WHERE class_id=1").run();
    f.sqlite.prepare("UPDATE class_files SET created_at='2026-09-15 01:00:00' WHERE id=?").run(rows[2].id);
    assert.deepEqual((await dbHelpers.listClassFilesForActiveStudentClass(1, 1)).map(x=>x.id), [rows[1].id, rows[0].id, rows[2].id]);
  } finally { f.close(); }
});

for (const [name, route] of [["View", studentView], ["Download", studentDownload]]) {
  test(`${name} permits active student, preserves Unicode filename and safe headers`, async () => {
    const f = await studentFixture();
    try {
      const response = await get(route, f.rows[0].id);
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-disposition"), name === "View" ? /^inline;/ : /^attachment;/);
      assert.ok(response.headers.get("content-disposition").includes("filename*=UTF-8''" + encodeURIComponent(f.rows[0].original_filename)));
      assert.equal(response.headers.get("content-type"), "application/pdf");
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.match(response.headers.get("cache-control"), /private, no-store/);
      assert.match(response.headers.get("content-security-policy"), /sandbox/);
      assert.equal(await response.text(), await pdf().text());
      assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM class_file_views").get().n, 1);
    } finally { f.close(); }
  });
  test(`${name} denies old URL immediately after ACTIVE becomes DROPPED`, async () => {
    const f = await studentFixture();
    try {
      assert.equal((await get(route, f.rows[0].id)).status, 200);
      f.sqlite.exec("UPDATE enrollments SET status='DROPPED' WHERE class_id=1 AND student_id=1");
      assert.deepEqual(await dbHelpers.listClassFilesForActiveStudentClass(1, 1), []);
      let reads = 0; f.state.env.DROPBOX_BUCKET.get = async () => { reads++; throw Error("must not read"); };
      assert.equal((await get(route, f.rows[0].id)).status, 404);
      assert.equal(reads, 0);
      assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM class_file_views").get().n, 1);
    } finally { f.close(); }
  });
  test(`${name} rejects another class, unauthenticated student and manipulated ID before R2`, async () => {
    const f = await studentFixture();
    try {
      let reads = 0; f.state.env.DROPBOX_BUCKET.get = async () => { reads++; return null; };
      assert.equal((await get(route, f.rows[2].id, "?classId=1&studentId=1")).status, 404);
      assert.equal((await get(route, "../../arbitrary-key")).status, 404);
      f.state.student = null;
      assert.equal((await get(route, f.rows[0].id)).status, 404);
      assert.equal(reads, 0);
    } finally { f.close(); }
  });
  test(`${name} resolves R2 key solely from authorized DB row`, async () => {
    const f = await studentFixture();
    try {
      const originalGet = f.state.env.DROPBOX_BUCKET.get;
      const keys = []; f.state.env.DROPBOX_BUCKET.get = async key => { keys.push(key); return originalGet(key); };
      assert.equal((await get(route, f.rows[0].id, "?storageKey=arbitrary&classId=3&studentId=999")).status, 200);
      assert.deepEqual(keys, [f.rows[0].storage_key]);
    } finally { f.close(); }
  });
  test(`${name} denies archived class and missing R2 object`, async () => {
    const f = await studentFixture();
    try {
      f.objects.clear(); assert.equal((await get(route, f.rows[0].id)).status, 404);
      f.sqlite.exec("UPDATE classes SET status='ARCHIVED' WHERE id=1");
      assert.deepEqual(await dbHelpers.listClassFilesForActiveStudentClass(1, 1), []);
      assert.equal((await get(route, f.rows[0].id)).status, 404);
    } finally { f.close(); }
  });
}

test("View falls back to attachment for Office content and sanitizes hostile filenames", async () => {
  const f = await studentFixture();
  try {
    f.sqlite.prepare("UPDATE class_files SET mime_type=?, original_filename=? WHERE id=?").run(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "../report\r\nInjected.docx", f.rows[0].id);
    const response = await get(studentView, f.rows[0].id);
    const header = response.headers.get("content-disposition");
    assert.match(header, /^attachment;/); assert.equal(/[\r\n]/.test(header), false); assert.equal(header.includes("../"), false);
  } finally { f.close(); }
});

const studentFilesDb = await load("../src/lib/db/dropbox.ts");
const studentFilesDownload = await load("../src/app/api/student/dropbox/[fileId]/download/route.ts");
const studentFilesDelete = await load("../src/app/api/student/dropbox/[fileId]/route.ts");

test("Student Files listing, Unicode download and owner-only delete retain existing behavior", async () => {
  const f = await studentFixture();
  try {
    const id = crypto.randomUUID(), key = `dropbox/1/1/${crypto.randomUUID()}`;
    const bytes = new TextEncoder().encode("Student file contents");
    f.sqlite.prepare(`INSERT INTO dropbox_files (id, class_id, student_id, storage_key,
      original_filename, display_name, mime_type, file_size) VALUES (?, 1, 1, ?, ?, ?, 'application/pdf', ?)`)
      .run(id, key, "学生.pdf", "My file.pdf", bytes.byteLength);
    f.objects.set(key, { body: bytes });
    const files = await studentFilesDb.listDropboxFilesForStudent(1, 1);
    assert.equal(files[0].displayName, "My file.pdf");
    assert.equal(files[0].originalFilename, "学生.pdf");
    assert.deepEqual(await studentFilesDb.listDropboxFilesForStudent(2, 1), []);
    const response = await get(studentFilesDownload, id);
    assert.equal(response.status, 200); assert.equal(await response.text(), "Student file contents");
    assert.ok(response.headers.get("content-disposition").includes(encodeURIComponent("学生.pdf")));
    f.state.student = { id: 999 };
    assert.equal((await studentFilesDelete.DELETE(request("DELETE"), studentProps(id))).status, 404);
    assert.ok(f.objects.has(key));
    f.state.student = { id: 1 };
    assert.equal((await studentFilesDelete.DELETE(request("DELETE"), studentProps(id))).status, 200);
    assert.equal(f.objects.has(key), false);
    assert.equal(f.sqlite.prepare("SELECT id FROM dropbox_files WHERE id=?").get(id), undefined);
    const page = await readFile(new URL("../src/app/student/(portal)/dropbox/page.tsx", import.meta.url), "utf8");
    assert.match(page, /section === "student" \? "student" : "class"/);
    assert.match(page, /StudentDropboxUploader/); assert.match(page, /initialFiles=\{files\}/);
  } finally { f.close(); }
});
