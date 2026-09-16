import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import ts from "typescript";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";

const encodedModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const mocks = {
  "react/jsx-runtime": pathToFileURL(createRequire(import.meta.url).resolve("react/jsx-runtime")).href,
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
    module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
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

const viewsRoute = await load("../src/app/api/classes/[classId]/class-files/[fileId]/views/route.ts");
const replacementRoute = await load("../src/app/api/classes/[classId]/class-files/[fileId]/replace/route.ts");
const mutationRoute = await load("../src/app/api/classes/[classId]/class-files/[fileId]/route.ts");
const studentCards = (await load("../src/components/student-class-files.tsx")).default;
const datetime = await load("../src/lib/datetime.ts");
const viewRows = f => f.sqlite.prepare("SELECT * FROM class_file_views ORDER BY version").all();
const stats = () => dbHelpers.listClassFilesWithViewStatsForInstructorClass(1, instructor);
const details = id => viewsRoute.GET(new Request("http://localhost"), props("1", id));
const current = () => dbHelpers.listClassFilesForActiveStudentClass(1, 1);
async function trackingFixture() {
  const f = await studentFixture(); f.state.user = instructor;
  f.sqlite.exec(`INSERT INTO students (id,student_number,first_name,last_name) VALUES
    (2,'2','Maria','Alpha'),(3,'3','Dropped','Beta'),(4,'4','Other','Class');
    INSERT INTO enrollments (student_id,class_id,status) VALUES (2,1,'ACTIVE'),(3,1,'DROPPED'),(4,2,'ACTIVE');`);
  return f;
}

test("never-viewed files show NEW and list rendering/class switching does not write tracking", async () => {
  const f = await trackingFixture();
  try {
    const files = await current(); assert.equal(files[0].isViewed, 0);
    assert.match(renderToStaticMarkup(studentCards({ files })), />NEW</);
    await dbHelpers.listClassFilesForActiveStudentClass(2, 1); await current();
    assert.equal(viewRows(f).length, 0);
  } finally { f.close(); }
});
for (const [action, route] of [["View", studentView], ["Download", studentDownload]]) {
  test(`${action} marks current version and NEW disappears on server reload`, async () => {
    const f = await trackingFixture();
    try {
      assert.equal((await get(route, f.rows[0].id, "?version=99&studentId=2")).status, 200);
      const [row] = viewRows(f);
      assert.equal(row.student_id, 1); assert.equal(row.version, 1);
      assert.match(row.first_viewed_at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      assert.equal(row.first_viewed_at, row.last_viewed_at);
      const files = await current(); assert.equal(files[0].isViewed, 1);
      assert.ok(!renderToStaticMarkup(studentCards({ files })).includes('>NEW<'));
      assert.deepEqual(f.state.refreshed.slice(-2), ["/student/dropbox", "/classes/1/dropbox"]);
    } finally { f.close(); }
  });
  test(`${action} failure before file availability creates no view row`, async () => {
    const f = await trackingFixture();
    try {
      assert.equal((await get(route, f.rows[2].id)).status, 404);
      f.state.student = null; assert.equal((await get(route, f.rows[0].id)).status, 404);
      f.state.student = { id: 1 }; f.objects.clear();
      assert.equal((await get(route, f.rows[0].id)).status, 404);
      assert.equal(viewRows(f).length, 0);
    } finally { f.close(); }
  });
}

test("repeat access preserves first timestamp and advances last timestamp", async () => {
  const f = await trackingFixture();
  try {
    await get(studentView, f.rows[0].id);
    f.sqlite.prepare("UPDATE class_file_views SET first_viewed_at='2026-01-01 00:00:00', last_viewed_at='2026-01-02 00:00:00'").run();
    await get(studentDownload, f.rows[0].id);
    const [row] = viewRows(f); assert.equal(viewRows(f).length, 1);
    assert.equal(row.first_viewed_at, "2026-01-01 00:00:00"); assert.ok(row.last_viewed_at > "2026-01-02 00:00:00");
  } finally { f.close(); }
});

test("simultaneous View/Download upserts create one row and preserve first access", async () => {
  const f = await trackingFixture();
  try {
    const responses = await Promise.all(Array.from({length:12}, (_,i)=>get(i%2 ? studentView : studentDownload, f.rows[0].id)));
    assert.ok(responses.every(r=>r.status===200)); assert.equal(viewRows(f).length, 1);
    const first = viewRows(f)[0].first_viewed_at;
    await get(studentView, f.rows[0].id); assert.equal(viewRows(f)[0].first_viewed_at, first);
  } finally { f.close(); }
});

test("replacement resets NEW/current-version statistics and retains historical rows", async () => {
  const f = await trackingFixture();
  try {
    await get(studentView, f.rows[0].id);
    assert.equal((await stats())[0].viewedCount, 1);
    assert.equal((await (await details(f.rows[0].id)).json()).students.find(s=>s.studentId===1).isViewed, 1);
    const response = await replacementRoute.POST(request("POST", form("1", pdf("replacement.pdf"))), props("1", f.rows[0].id));
    assert.equal(response.status, 200); assert.equal((await dbHelpers.getClassFileById(f.rows[0].id)).version, 2);
    assert.equal((await current())[0].isViewed, 0); assert.equal((await stats())[0].viewedCount, 0);
    const student = (await (await details(f.rows[0].id)).json()).students.find(s=>s.studentId===1);
    assert.equal(student.isViewed, 0); assert.equal(student.lastViewedAt, null);
    assert.equal(viewRows(f)[0].version, 1);
    await get(studentDownload, f.rows[0].id);
    assert.equal((await current())[0].isViewed, 1); assert.equal((await stats())[0].viewedCount, 1);
    assert.deepEqual(viewRows(f).map(v=>v.version), [1,2]);
  } finally { f.close(); }
});

test("metadata edit keeps version, read state, timestamps and statistics", async () => {
  const f = await trackingFixture();
  try {
    await get(studentView, f.rows[0].id); const before = viewRows(f);
    assert.equal((await mutationRoute.PATCH(request("PATCH", JSON.stringify({title:"Edited",description:"Changed"})), props("1",f.rows[0].id))).status, 200);
    assert.equal((await dbHelpers.getClassFileById(f.rows[0].id)).version, 1);
    assert.equal((await current())[0].isViewed, 1); assert.equal((await stats())[0].viewedCount, 1);
    assert.deepEqual(viewRows(f), before);
  } finally { f.close(); }
});

test("counts and details include only active students and current-version views", async () => {
  const f = await trackingFixture();
  try {
    await get(studentView, f.rows[0].id);
    for (const [studentId,version] of [[2,9],[3,1],[4,1]]) f.sqlite.prepare("INSERT INTO class_file_views (class_file_id,student_id,version) VALUES (?,?,?)").run(f.rows[0].id,studentId,version);
    const [file] = await stats(); assert.equal(file.viewedCount, 1); assert.equal(file.activeStudentCount, 2);
    const response = await details(file.id); assert.equal(response.status, 200); assert.match(response.headers.get("cache-control"), /no-store/);
    const students = (await response.json()).students;
    assert.deepEqual(students.map(s=>s.studentId), [2,1]);
    assert.equal(students[0].isViewed, 0); assert.equal(students[0].lastViewedAt, null);
    assert.equal(students[1].isViewed, 1);
    for (const row of students) for (const key of ["version","classFileId","firstViewedAt","storageKey"]) assert.ok(!(key in row));
  } finally { f.close(); }
});

test("dropping a viewed student removes numerator/denominator and details without deleting history", async () => {
  const f = await trackingFixture();
  try {
    await get(studentView, f.rows[0].id);
    f.sqlite.exec("UPDATE enrollments SET status='DROPPED' WHERE class_id=1 AND student_id=1");
    const [file] = await stats(); assert.equal(file.viewedCount, 0); assert.equal(file.activeStudentCount, 1);
    assert.deepEqual((await (await details(file.id)).json()).students.map(s=>s.studentId), [2]);
    assert.equal(viewRows(f).length, 1);
    assert.equal((await get(studentView,file.id)).status, 404); assert.equal((await get(studentDownload,file.id)).status, 404);
  } finally { f.close(); }
});

test("All Classes copies and multiple active student classes track independently", async () => {
  const f = await trackingFixture();
  try {
    assert.equal((await uploadRoute.POST(request("POST",form("all")),props("1"))).status, 200);
    const files = f.sqlite.prepare("SELECT * FROM class_files WHERE id NOT IN (?, ?, ?) ORDER BY class_id").all(...f.rows.map(r=>r.id));
    assert.equal(files.length, 2);
    await get(studentView, files[0].id);
    assert.equal((await current()).find(x=>x.id===files[0].id).isViewed, 1);
    assert.equal((await dbHelpers.listClassFilesForActiveStudentClass(2,1)).find(x=>x.id===files[1].id).isViewed, 0);
    assert.equal((await dbHelpers.listClassFilesWithViewStatsForInstructorClass(2,instructor)).find(x=>x.id===files[1].id).viewedCount, 0);
    assert.equal(viewRows(f).length, 1);
  } finally { f.close(); }
});

test("statistics/detail helpers and route reject another instructor, changed file/class and client identity", async () => {
  const f = await trackingFixture();
  try {
    f.state.user = otherInstructor;
    assert.equal((await details(f.rows[0].id)).status, 404);
    assert.deepEqual(await dbHelpers.listClassFilesWithViewStatsForInstructorClass(1,otherInstructor), []);
    assert.deepEqual(await dbHelpers.listClassFileStudentViewDetails(f.rows[0].id,1,otherInstructor), []);
    f.state.user = instructor;
    assert.equal((await details(f.rows[2].id)).status, 404);
    assert.equal((await viewsRoute.GET(new Request("http://localhost?instructorId=2"),props("3",f.rows[2].id))).status, 404);
    assert.equal((await viewsRoute.GET(new Request("http://localhost"),props("2",f.rows[0].id))).status, 404);
  } finally { f.close(); }
});

test("student role and unauthenticated requests cannot access instructor statistics", async () => {
  const f = await trackingFixture();
  try {
    for (const user of [null,{id:1,role:"STUDENT"}]) {
      f.state.user = user; assert.equal((await details(f.rows[0].id)).status, 404);
    }
    assert.deepEqual(await dbHelpers.listClassFilesWithViewStatsForInstructorClass(1,{id:1,role:"STUDENT"}), []);
  } finally { f.close(); }
});

for (const [name, fail] of [["throws", ()=>{throw Error("tracking database unavailable");}], ["returns unsuccessful result", ()=>({success:false,meta:{changes:0}})]]) {
  test(`analytics write ${name} but file response remains successful`, async () => {
    const f = await trackingFixture(), savedLog = console.error;
    try {
      let logs=0; console.error=()=>{logs++;};
      const prepare=f.state.env.DB.prepare;
      f.state.env.DB.prepare=sql=> { const stmt=prepare(sql); if(sql.includes("INSERT INTO class_file_views")) stmt.run=async()=>fail(); return stmt; };
      for(const route of [studentView,studentDownload]) {
        const response=await get(route,f.rows[0].id); assert.equal(response.status,200); assert.equal(await response.text(),await pdf().text());
      }
      assert.equal(logs,2); assert.equal(viewRows(f).length,0);
    } finally {console.error=savedLog; f.close();}
  });
}

test("replacement during R2 retrieval cannot mark the undelivered new version viewed", async () => {
  const f = await trackingFixture();
  try {
    const oldGet=f.state.env.DROPBOX_BUCKET.get;
    f.state.env.DROPBOX_BUCKET.get=async key=> {
      const object=await oldGet(key);
      f.sqlite.prepare("UPDATE class_files SET version=version+1, storage_key=? WHERE id=?").run(key+"-new",f.rows[0].id);
      return object;
    };
    assert.equal((await get(studentView,f.rows[0].id)).status,200);
    assert.equal(viewRows(f).length,0); assert.equal((await current())[0].isViewed,0);
  } finally { f.close(); }
});

test("tracking upsert rechecks active enrollment at write time", async () => {
  const f = await trackingFixture();
  try {
    const file=await dbHelpers.getClassFileById(f.rows[0].id);
    f.sqlite.exec("UPDATE enrollments SET status='DROPPED' WHERE student_id=1 AND class_id=1");
    assert.equal(await dbHelpers.markClassFileVersionViewed(file,1),false); assert.equal(viewRows(f).length,0);
  } finally { f.close(); }
});

test("empty active roster produces 0 / 0 viewed and empty details", async () => {
  const f = await trackingFixture();
  try {
    f.sqlite.exec("UPDATE enrollments SET status='DROPPED' WHERE class_id=1");
    const [file]=await stats(); assert.equal(file.activeStudentCount,0); assert.equal(file.viewedCount,0);
    assert.deepEqual((await (await details(file.id)).json()).students,[]);
  } finally { f.close(); }
});

test("student unread, instructor aggregates and details each use a single DB query", async () => {
  const f = await trackingFixture();
  try {
    const prepare=f.state.env.DB.prepare; let queries=0;
    f.state.env.DB.prepare=sql=>{queries++; return prepare(sql);};
    await current(); assert.equal(queries,1);
    queries=0; await stats(); assert.equal(queries,1);
    queries=0; await dbHelpers.listClassFileStudentViewDetails(f.rows[0].id,1,instructor); assert.equal(queries,1);
  } finally { f.close(); }
});

test("instructor last-viewed timestamps interpret D1 UTC in Philippine time", async () => {
  const f = await trackingFixture();
  try {
    await get(studentView,f.rows[0].id);
    f.sqlite.exec("UPDATE class_file_views SET last_viewed_at='2026-09-16 02:32:00'");
    const students=(await (await details(f.rows[0].id)).json()).students;
    assert.match(datetime.formatPhilippineDateTime(students.find(s=>s.studentId===1).lastViewedAt),/10:32/);
    const source=await readFile(new URL("../src/components/class-file-view-details.tsx",import.meta.url),"utf8");
    assert.match(source,/formatPhilippineDateTime\(student.lastViewedAt\)/);
  } finally { f.close(); }
});

test("deleting a Class File retains existing cascading view cleanup", async () => {
  const f = await trackingFixture();
  try {
    await get(studentView,f.rows[0].id);
    assert.equal((await mutationRoute.DELETE(request("DELETE"),props("1",f.rows[0].id))).status,200);
    assert.equal(viewRows(f).length,0);
  } finally { f.close(); }
});
