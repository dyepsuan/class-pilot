import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import ts from "typescript";

const encodedModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const mocks = {
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

const operationsModule = await load("../src/lib/class-files/operations.ts");
const dbHelpers = await load("../src/lib/db/class-files.ts");
const auth = await load("../src/lib/auth/class-files.ts");
const management = await load("../src/lib/auth/instructor-class.ts");
const uploadRoute = await load("../src/app/api/classes/[classId]/class-files/route.ts");
const mutationRoute = await load("../src/app/api/classes/[classId]/class-files/[fileId]/route.ts");
const replacementRoute = await load("../src/app/api/classes/[classId]/class-files/[fileId]/replace/route.ts");
const viewRoute = await load("../src/app/api/classes/[classId]/class-files/[fileId]/view/route.ts");
const downloadRoute = await load("../src/app/api/classes/[classId]/class-files/[fileId]/download/route.ts");

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

test("owning instructor uploads a validated PDF and reads a safe, key-free listing", async () => {
  const f = await fixture();
  try {
    const result = await uploadRoute.POST(request("POST", form()), props());
    assert.equal(result.status, 200);
    const files = await dbHelpers.listClassFilesForInstructorClass(1);
    assert.equal(files.length, 1);
    assert.equal(files[0].title, "Reviewer");
    assert.equal(files[0].description, "Read this.");
    assert.equal(files[0].version, 1);
    assert.equal("storageKey" in files[0], false);
    assert.equal(f.objects.size, 1);
    assert.deepEqual(f.state.refreshed, ["/classes/1/dropbox"]);
  } finally { f.close(); }
});

test("upload rejects unmanaged class scope and a tampered class route before storage", async () => {
  const f = await fixture();
  try {
    assert.equal((await uploadRoute.POST(request("POST", form("3")), props())).status, 404);
    assert.equal((await uploadRoute.POST(request("POST", form("1")), props("3"))).status, 404);
    assert.equal((await uploadRoute.POST(request("POST", form("../1")), props())).status, 400);
    assert.equal(f.objects.size, 0);
  } finally { f.close(); }
});

test("All Classes creates independent IDs and keys only for managed classes", async () => {
  const f = await fixture();
  try {
    const response = await uploadRoute.POST(request("POST", form("all")), props());
    assert.equal(response.status, 200);
    assert.equal((await response.json()).count, 2);
    const rows = f.sqlite.prepare("SELECT * FROM class_files ORDER BY class_id").all();
    assert.deepEqual(rows.map((row) => row.class_id), [1, 2]);
    assert.equal(new Set(rows.map((row) => row.id)).size, 2);
    assert.equal(new Set(rows.map((row) => row.storage_key)).size, 2);
    assert.ok(rows.every((row) => row.version === 1 && row.uploaded_by === 1));
    assert.equal(f.objects.size, 2);
  } finally { f.close(); }
});

test("route validation rejects invalid type, zero bytes, oversized files and blank titles", async () => {
  const f = await fixture();
  try {
    for (const file of [new File(["x"], "a.exe"), new File([], "a.pdf"),
      new File([new Uint8Array(25 * 1024 * 1024 + 1)], "a.pdf")]) {
      assert.equal((await uploadRoute.POST(request("POST", form("1", file)), props())).status, 400);
    }
    assert.equal((await uploadRoute.POST(request("POST", form("1", pdf(), "  ")), props())).status, 400);
    assert.equal(f.objects.size, 0);
  } finally { f.close(); }
});

test("metadata edit trims details, keeps version and ignores attempted class/key changes", async () => {
  const f = await fixture();
  try {
    await uploadRoute.POST(request("POST", form()), props());
    const before = f.sqlite.prepare("SELECT * FROM class_files").get();
    const response = await mutationRoute.PATCH(request("PATCH", JSON.stringify({
      title: "  Updated  ", description: "  New details  ", classId: 3, storageKey: "arbitrary",
    })), props("1", before.id));
    assert.equal(response.status, 200);
    const after = f.sqlite.prepare("SELECT * FROM class_files").get();
    assert.equal(after.title, "Updated"); assert.equal(after.description, "New details");
    assert.equal(after.class_id, before.class_id); assert.equal(after.storage_key, before.storage_key);
    assert.equal(after.version, 1);
  } finally { f.close(); }
});

test("replacement preserves ID/history, increments version and removes the old object after D1", async () => {
  const f = await fixture();
  try {
    await uploadRoute.POST(request("POST", form()), props());
    const before = f.sqlite.prepare("SELECT * FROM class_files").get();
    f.sqlite.prepare("INSERT INTO class_file_views (class_file_id, student_id, version) VALUES (?, 1, 1)").run(before.id);
    f.events.length = 0;
    const response = await replacementRoute.POST(request("POST", form("1", pdf("新版.pdf"))), props("1", before.id));
    assert.equal(response.status, 200);
    const after = f.sqlite.prepare("SELECT * FROM class_files").get();
    assert.equal(after.id, before.id); assert.equal(after.version, 2);
    assert.equal(after.original_filename, "新版.pdf");
    assert.notEqual(after.storage_key, before.storage_key);
    assert.ok(f.objects.has(after.storage_key)); assert.ok(!f.objects.has(before.storage_key));
    assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM class_file_views").get().n, 1);
    assert.equal(f.events[1], "db");
    assert.equal(f.events[2], "delete:" + before.storage_key);
  } finally { f.close(); }
});

test("delete cascades views and targets the authorized DB object, ignoring client keys", async () => {
  const f = await fixture();
  try {
    await uploadRoute.POST(request("POST", form()), props());
    const row = f.sqlite.prepare("SELECT * FROM class_files").get();
    f.sqlite.prepare("INSERT INTO class_file_views (class_file_id, student_id, version) VALUES (?, 1, 1)").run(row.id);
    f.objects.set("do-not-delete", {});
    f.state.user = otherInstructor;
    assert.equal((await mutationRoute.DELETE(request("DELETE"), props("1", row.id))).status, 404);
    f.state.user = instructor;
    const response = await mutationRoute.DELETE(request("DELETE", JSON.stringify({ storageKey: "do-not-delete" })), props("1", row.id));
    assert.equal(response.status, 200);
    assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM class_files").get().n, 0);
    assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM class_file_views").get().n, 0);
    assert.ok(!f.objects.has(row.storage_key)); assert.ok(f.objects.has("do-not-delete"));
  } finally { f.close(); }
});

test("View/Download enforce instructor and route class scope, safe Unicode and no caching", async () => {
  const f = await fixture();
  try {
    await uploadRoute.POST(request("POST", form()), props());
    const row = f.sqlite.prepare("SELECT * FROM class_files").get();
    const view = await viewRoute.GET(new Request("http://localhost"), props("1", row.id));
    const download = await downloadRoute.GET(new Request("http://localhost"), props("1", row.id));
    assert.equal(view.status, 200); assert.match(view.headers.get("content-disposition"), /^inline;/);
    assert.match(download.headers.get("content-disposition"), /^attachment;.*filename\*=UTF-8''/);
    assert.equal(download.headers.get("x-content-type-options"), "nosniff");
    assert.match(download.headers.get("cache-control"), /no-store/);
    assert.equal(await download.text(), await pdf().text());
    assert.equal((await viewRoute.GET(new Request("http://localhost"), props("2", row.id))).status, 404);
    f.state.user = otherInstructor;
    for (const route of [viewRoute, downloadRoute]) {
      assert.equal((await route.GET(new Request("http://localhost"), props("1", row.id))).status, 404);
    }
    assert.equal(await auth.getAuthorizedInstructorClassFile(row.id, 1, otherInstructor), null);
    f.state.user = null;
    assert.equal((await downloadRoute.GET(new Request("http://localhost"), props("1", row.id))).status, 404);
  } finally { f.close(); }
});

test("foreign-origin mutations and student sessions are rejected", async () => {
  const f = await fixture();
  try {
    assert.equal((await uploadRoute.POST(request("POST", form(), "https://evil.test"), props())).status, 403);
    f.state.user = { id: 1, role: "STUDENT" };
    assert.equal((await uploadRoute.POST(request("POST", form()), props())).status, 404);
    assert.equal(f.objects.size, 0);
  } finally { f.close(); }
});

test("legacy single-instructor managed-class rule remains compatible", async () => {
  const f = await fixture();
  try {
    f.sqlite.exec("UPDATE users SET auth_id = NULL WHERE id = 2");
    assert.deepEqual((await management.listInstructorManagedClasses(instructor)).map((item) => item.id), [1, 2, 3]);
  } finally { f.close(); }
});

function serviceFixture(overrides = {}) {
  const objects = new Set();
  const calls = [];
  const file = { id: crypto.randomUUID(), classId: 1, storageKey: "old-object", version: 1 };
  const ports = {
    managedClasses: async () => [{ id: 1 }, { id: 2 }],
    authorizedFile: async () => file,
    put: async ({ storageKey }) => { calls.push("put"); objects.add(storageKey); },
    removeObject: async (key) => { calls.push("remove:" + key); objects.delete(key); },
    insert: async () => { calls.push("insert"); },
    rollback: async () => { calls.push("rollback"); },
    edit: async () => true,
    replace: async () => { calls.push("replace"); return true; },
    removeMetadata: async () => { calls.push("delete-db"); return true; },
    log: () => { calls.push("log"); },
    ...overrides,
  };
  return { service: operationsModule.createClassFileOperations(ports), objects, calls, file };
}

test("All Classes storage failure compensates every object attempted before metadata insert", async () => {
  let puts = 0;
  const f = serviceFixture();
  const g = serviceFixture({ put: async ({ storageKey }) => {
    f.objects.add(storageKey);
    if (++puts === 2) throw new Error("storage failure");
  }, removeObject: async (key) => { f.objects.delete(key); } });
  await assert.rejects(g.service.upload(instructor, "all", "Title", null, pdf()), /No class copies were kept/);
  assert.equal(f.objects.size, 0);
  assert.ok(!g.calls.includes("insert"));
});

test("D1 batch failure rolls back metadata before compensating objects", async () => {
  const f = serviceFixture({ insert: async () => { throw new Error("D1 failed"); } });
  await assert.rejects(f.service.upload(instructor, "all", "Title", null, pdf()), /No class copies were kept/);
  assert.equal(f.objects.size, 0);
  assert.ok(f.calls.indexOf("rollback") < f.calls.findIndex((call) => call.startsWith("remove:")));
});

test("replacement conflict removes the new object and leaves the previous object intact", async () => {
  const f = serviceFixture({ replace: async () => false });
  f.objects.add(f.file.storageKey);
  await assert.rejects(f.service.replace(instructor, 1, f.file.id, pdf()), /file changed/i);
  assert.deepEqual([...f.objects], [f.file.storageKey]);
});

test("persistent old-object cleanup failure keeps a successful replacement and reports it", async () => {
  const f = serviceFixture({ removeObject: async () => { throw new Error("R2 unavailable"); } });
  const result = await f.service.replace(instructor, 1, f.file.id, pdf());
  assert.equal(result.cleanupPending, true);
  assert.equal(f.objects.size, 1);
  assert.ok(f.calls.includes("replace")); assert.ok(f.calls.includes("log"));
});

test("concurrent deletion conflict never deletes a replacement object", async () => {
  const f = serviceFixture({ removeMetadata: async () => false });
  await assert.rejects(f.service.delete(instructor, 1, f.file.id), /file changed/i);
  assert.ok(!f.calls.some((call) => call.startsWith("remove:")));
});

test("DB replacement CAS prevents stale replacements, while metadata edits preserve file state", async () => {
  const f = await fixture();
  try {
    await uploadRoute.POST(request("POST", form()), props());
    const row = f.sqlite.prepare("SELECT id FROM class_files").get();
    const file = await dbHelpers.getClassFileById(row.id);
    const replacement = { storageKey: file.storageKey.replace(/[^/]+$/, crypto.randomUUID()),
      originalFilename: "new.pdf", mimeType: "application/pdf", fileSize: 10 };
    assert.equal(await dbHelpers.replaceClassFileMetadata(file, 1, replacement), true);
    assert.equal(await dbHelpers.replaceClassFileMetadata(file, 1, replacement), false);
    assert.equal(await dbHelpers.deleteClassFileMetadata(file, 1), false);
    assert.equal(await dbHelpers.updateClassFileMetadata(file, 2, { title: "Intruder", description: null }), false);
    assert.equal(await dbHelpers.updateClassFileMetadata(file, 1, { title: "Edited", description: null }), true);
    assert.equal((await dbHelpers.getClassFileById(row.id)).version, 2);
  } finally { f.close(); }
});


test("cross-instructor edit and replacement cannot write metadata or storage", async () => {
  const f = await fixture();
  try {
    await uploadRoute.POST(request("POST", form()), props());
    const row = f.sqlite.prepare("SELECT * FROM class_files").get();
    f.state.user = otherInstructor;
    assert.equal((await mutationRoute.PATCH(request("PATCH", JSON.stringify({ title: "Intruder" })), props("1", row.id))).status, 404);
    assert.equal((await replacementRoute.POST(request("POST", form()), props("1", row.id))).status, 404);
    assert.equal(f.objects.size, 1);
    assert.equal(f.sqlite.prepare("SELECT title FROM class_files").get().title, row.title);
  } finally { f.close(); }
});

test("Office View falls back to attachment instead of unsafe inline rendering", async () => {
  const f = await fixture();
  try {
    const data = form("1", new File(["office file"], "lecture.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }));
    assert.equal((await uploadRoute.POST(request("POST", data), props())).status, 200);
    const row = f.sqlite.prepare("SELECT id FROM class_files").get();
    const response = await viewRoute.GET(new Request("http://localhost"), props("1", row.id));
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-disposition"), /^attachment;/);
  } finally { f.close(); }
});

test("malformed multipart and JSON requests return validation errors", async () => {
  const f = await fixture();
  try {
    assert.equal((await uploadRoute.POST(request("POST", "not multipart"), props())).status, 400);
    assert.equal((await mutationRoute.PATCH(request("PATCH", "{broken"), props("1", crypto.randomUUID()))).status, 400);
  } finally { f.close(); }
});

test("origin checks support Next local Host normalization and still reject foreign sites", async () => {
  const responses = await load("../src/lib/class-files/responses.ts");
  const sameHost = new Request("http://localhost/api", {
    headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
  });
  assert.equal(responses.isClassFileRequestOriginAllowed(sameHost), true);
  assert.equal(responses.isClassFileRequestOriginAllowed(new Request("http://localhost/api", {
    headers: { host: "127.0.0.1:3000", origin: "https://evil.test" },
  })), false);
});

test("replacement DB exception cleans the new object without touching the old object", async () => {
  const f = serviceFixture({ replace: async () => { throw new Error("DB update failed"); } });
  f.objects.add(f.file.storageKey);
  await assert.rejects(f.service.replace(instructor, 1, f.file.id, pdf()), /DB update failed/);
  assert.deepEqual([...f.objects], [f.file.storageKey]);
});

test("upload rollback failure preserves potentially referenced objects and reports partial state", async () => {
  const f = serviceFixture({
    insert: async () => { throw new Error("DB write failed"); },
    rollback: async () => { throw new Error("rollback failed"); },
  });
  await assert.rejects(f.service.upload(instructor, "all", "Title", null, pdf()), /Some class copies may remain/);
  assert.equal(f.objects.size, 2);
  assert.ok(!f.calls.some((call) => call.startsWith("remove:")));
});
