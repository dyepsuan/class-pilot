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
  "next/link": encodedModule("import { jsx } from " + JSON.stringify(pathToFileURL(createRequire(import.meta.url).resolve("react/jsx-runtime")).href) + "; export default function Link(props) { return jsx('a', props); }"),
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

const replacementRoute=await load("../src/app/api/classes/[classId]/class-files/[fileId]/replace/route.ts");
const mutationRoute=await load("../src/app/api/classes/[classId]/class-files/[fileId]/route.ts");
const attention=(await load("../src/components/student-class-files-attention.tsx")).default;
const cards=(await load("../src/components/student-class-files.tsx")).default;
const count=(classId=1,studentId=1)=>dbHelpers.countUnreadClassFilesForActiveStudentClass(classId,studentId);
const render=count=>renderToStaticMarkup(attention({unreadCount:count}));
async function dashboardFixture() {const f=await studentFixture(); f.state.user=instructor; return f;}
async function addFile(classId) {assert.equal((await uploadRoute.POST(request("POST",form(String(classId))),props(String(classId)))).status,200);}

test("zero unread files omit attention card and link", async()=>{
  const f=await dashboardFixture();
  try {f.sqlite.exec("DELETE FROM class_files WHERE class_id=1"); assert.equal(await count(),0); assert.equal(render(await count()),"");}
  finally {f.close();}
});
test("one unread file shows singular copy, descriptive link and visible focus treatment", async()=>{
  const f=await dashboardFixture();
  try {assert.equal(await count(),1); const html=render(await count()); assert.match(html,/1 new class file</); assert.ok(!html.includes('1 new class files'));
    assert.match(html,/href="\/student\/dropbox\?section=class"/); assert.match(html,/aria-label="View 1 new class file in Dropbox"/); assert.match(html,/focus-visible:ring-2/);}
  finally {f.close();}
});
test("multiple unread files show plural copy", async()=>{
  const f=await dashboardFixture();
  try {await addFile(1); assert.equal(await count(),2); assert.match(render(await count()),/2 new class files</);}
  finally {f.close();}
});
test("selected class counts switch between one and three without combining classes", async()=>{
  const f=await dashboardFixture();
  try {await addFile(2); await addFile(2); assert.equal(await count(1),1); assert.equal(await count(2),3); assert.equal(await count(1),1);}
  finally {f.close();}
});
for(const [name,route] of [["View",studentView],["Download",studentDownload]]) {
  test(`${name} decreases dashboard count and all-read indicator disappears`,async()=>{
    const f=await dashboardFixture();
    try {await addFile(1); assert.equal(await count(),2); assert.equal((await get(route,f.rows[0].id)).status,200); assert.equal(await count(),1);
      const other=(await dbHelpers.listClassFilesForActiveStudentClass(1,1)).find(x=>!x.isViewed);
      await get(route,other.id); assert.equal(await count(),0); assert.equal(render(await count()),""); assert.ok(f.state.refreshed.includes('/student'));}
    finally {f.close();}
  });
}
test("replacement restores dashboard unread and Dropbox NEW; replacement access clears both",async()=>{
  const f=await dashboardFixture();
  try {await get(studentView,f.rows[0].id); assert.equal(await count(),0);
    assert.equal((await replacementRoute.POST(request('POST',form('1',pdf('replacement.pdf'))),props('1',f.rows[0].id))).status,200);
    assert.equal(await count(),1); const files=await dbHelpers.listClassFilesForActiveStudentClass(1,1); assert.equal(files[0].isViewed,0); assert.match(renderToStaticMarkup(cards({files})),/>NEW</);
    await get(studentDownload,f.rows[0].id); assert.equal(await count(),0);
    assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM class_file_views').get().n,2);}
  finally {f.close();}
});
test("title/description metadata edits do not increase dashboard unread",async()=>{
  const f=await dashboardFixture();
  try {await get(studentView,f.rows[0].id); const first=f.sqlite.prepare('SELECT * FROM class_file_views').get();
    assert.equal((await mutationRoute.PATCH(request('PATCH',JSON.stringify({title:'Updated title',description:'Updated description'})),props('1',f.rows[0].id))).status,200);
    assert.equal(await count(),0); assert.equal((await dbHelpers.getClassFileById(f.rows[0].id)).version,1); assert.deepEqual(f.sqlite.prepare('SELECT * FROM class_file_views').get(),first);}
  finally {f.close();}
});
test("DROPPED selected class contributes no unread while other active class stays scoped",async()=>{
  const f=await dashboardFixture();
  try {assert.equal(await count(1),1); f.sqlite.exec("UPDATE enrollments SET status='DROPPED' WHERE class_id=1 AND student_id=1");
    assert.equal(await count(1),0); assert.equal(await count(2),1); assert.equal((await get(studentView,f.rows[0].id)).status,404);}
  finally {f.close();}
});
test("never-enrolled class and another student without enrollment cannot contribute files",async()=>{
  const f=await dashboardFixture();
  try {assert.equal(await count(3),0); assert.equal(await count(1,999),0); assert.equal(await count(2,999),0);}
  finally {f.close();}
});
test("another student's read row cannot clear authenticated student's dashboard unread",async()=>{
  const f=await dashboardFixture();
  try {f.sqlite.exec("INSERT INTO students(id,student_number,first_name,last_name) VALUES(2,'2','Other','Student'); INSERT INTO enrollments(student_id,class_id) VALUES(2,1)");
    f.state.student={id:2}; await get(studentView,f.rows[0].id); assert.equal(await count(1,2),0); assert.equal(await count(1,1),1);}
  finally {f.close();}
});
test("All Classes copies contribute only to their selected class and read independently",async()=>{
  const f=await dashboardFixture();
  try {assert.equal((await uploadRoute.POST(request('POST',form('all')),props('1'))).status,200);
    assert.equal(await count(1),2); assert.equal(await count(2),2);
    const copy=(await dbHelpers.listClassFilesForActiveStudentClass(1,1)).find(x=>x.id!==f.rows[0].id);
    await get(studentView,copy.id); assert.equal(await count(1),1); assert.equal(await count(2),2);}
  finally {f.close();}
});
test("dashboard count equals Dropbox NEW badges across classes and current read states",async()=>{
  const f=await dashboardFixture();
  try {await addFile(1); await addFile(2); await get(studentView,f.rows[0].id);
    for(const classId of [1,2]) {const files=await dbHelpers.listClassFilesForActiveStudentClass(classId,1); const html=renderToStaticMarkup(cards({files}));
      assert.equal(await count(classId),(html.match(/>NEW</g)||[]).length);}
    assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM class_file_views').get().n,1);}
  finally {f.close();}
});
test("unread count is one aggregate operation with no list loading or tracking writes",async()=>{
  const f=await dashboardFixture();
  try {const prepare=f.state.env.DB.prepare; let calls=0;
    f.state.env.DB.prepare=sql=>{calls++; assert.match(sql,/COUNT\(\*\)/); return prepare(sql);};
    assert.equal(await count(),1); assert.equal(calls,1); assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM class_file_views').get().n,0);}
  finally {f.close();}
});
test("archived class is excluded from unread count",async()=>{
  const f=await dashboardFixture();
  try {f.sqlite.exec("UPDATE classes SET status='ARCHIVED' WHERE id=1"); assert.equal(await count(),0);}
  finally {f.close();}
});
test("deletion removes dashboard unread and tracking through existing cascade",async()=>{
  const f=await dashboardFixture();
  try {await get(studentView,f.rows[0].id); await replacementRoute.POST(request('POST',form('1')),props('1',f.rows[0].id)); assert.equal(await count(),1);
    assert.equal((await mutationRoute.DELETE(request('DELETE'),props('1',f.rows[0].id))).status,200); assert.equal(await count(),0); assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM class_file_views').get().n,0);}
  finally {f.close();}
});
test("dashboard wires authenticated identity and portal scope separately from Open Activities",async()=>{
  const source=await readFile(new URL('../src/app/student/(portal)/page.tsx',import.meta.url),'utf8');
  assert.match(source,/await requireStudent\(\)/); assert.match(source,/countUnreadClassFilesForActiveStudentClass\(selectedClass.id, authenticatedStudent.id\)/);
  assert.match(source,/<StudentClassFilesAttention unreadCount=\{unreadClassFileCount\} \/>[\s\S]*<OpenActivitiesSection/);
  assert.ok(!source.includes('searchParams')); assert.ok(!source.includes('studentId='));
});

test("D1 cascade change counts still report a successful Class File CAS delete", async()=>{
  const f=await dashboardFixture();
  try {
    const file=await dbHelpers.getClassFileById(f.rows[0].id);
    const prepare=f.state.env.DB.prepare;
    f.state.env.DB.prepare=sql=>{
      const statement=prepare(sql);
      if(sql.startsWith("DELETE FROM class_files")) statement.run=async()=>({success:true,meta:{changes:3}});
      return statement;
    };
    assert.equal(await dbHelpers.deleteClassFileMetadata(file,instructor.id),true);
  } finally {f.close();}
});
