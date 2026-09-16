import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import ts from "typescript";

async function load(relativePath) {
  const source = (await readFile(new URL(relativePath, import.meta.url), "utf8"))
    .replace(/^import "server-only";\r?\n\r?\n/u, "");
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
}
const rules = await load("../src/lib/class-files/validation.ts");
const keys = await load("../src/lib/class-files/storage-key.ts");

test("all required academic formats are accepted, including reliable MIME types", () => {
  const formats = {
    pdf: "application/pdf", doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    csv: "text/csv", txt: "text/plain; charset=utf-8", rtf: "application/rtf",
    odt: "application/vnd.oasis.opendocument.text",
    ods: "application/vnd.oasis.opendocument.spreadsheet",
    odp: "application/vnd.oasis.opendocument.presentation",
    zip: "application/zip", jpg: "image/jpeg", jpeg: "image/jpeg",
    png: "image/png", webp: "image/webp",
  };
  for (const [extension, type] of Object.entries(formats)) {
    assert.equal(rules.validateClassFileUpload({ name: `æ•™æ.${extension}`, size: 10, type }).ok,
      true, extension);
  }
});

test("allowlist rejects scripts, executables, unsupported and spoofed MIME types", () => {
  for (const ext of ["exe", "msi", "bat", "cmd", "com", "scr", "ps1", "vbs", "js", "jar", "sh", "html", "rar", "toString", "__proto__"]) {
    assert.equal(rules.validateClassFileUpload({ name: `payload.${ext}`, size: 10, type: "application/pdf" }).ok, false, ext);
  }
  assert.equal(rules.validateClassFileUpload({ name: "a.pdf", size: 10, type: "text/javascript" }).code, "MIME_TYPE_MISMATCH");
});

test("size and filename boundaries are enforced; generic MIME has a safe default", () => {
  const file = { name: "a.pdf", size: rules.MAX_CLASS_FILE_SIZE };
  assert.equal(rules.validateClassFileUpload(file).ok, true);
  for (const size of [0, -1, 1.2, NaN, Infinity, file.size + 1]) {
    assert.equal(rules.validateClassFileUpload({ ...file, size }).ok, false);
  }
  for (const name of ["../a.pdf", "a\\b.pdf", "a\u0000.pdf", "a".repeat(256) + ".pdf", ""]) {
    assert.equal(rules.validateClassFileUpload({ ...file, name }).ok, false);
  }
  assert.equal(rules.validateClassFileUpload({ ...file, type: "application/octet-stream" }).mimeType, "application/pdf");
});

test("storage namespace binds class and UUID with distinct objects for replacements", () => {
  const id = crypto.randomUUID();
  const first = keys.generateClassFileStorageKey(12, id);
  assert.equal(keys.isClassFileStorageKey(first), true);
  assert.ok(first.startsWith(`class-files/12/${id}/`));
  assert.notEqual(first, keys.generateClassFileStorageKey(12, id));
  for (const key of [first + "/../payload", first.replace("class-files/", "dropbox/"), first.replace("/12/", "/9007199254740992/")]) {
    assert.equal(keys.isClassFileStorageKey(key), false);
  }
  for (const classId of [0, -1, 1.2, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => keys.generateClassFileStorageKey(classId, id), TypeError);
  }
  assert.throws(() => keys.generateClassFileStorageKey(1, "../bad"), TypeError);
});

test("migration enforces defaults, constraints, historical version isolation and view cascades", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("PRAGMA foreign_keys = ON");
    const migrations = new URL("../migrations/", import.meta.url);
    for (const name of (await readdir(migrations)).filter((name) => name.endsWith(".sql")).sort()) {
      db.exec(await readFile(new URL(name, migrations), "utf8"));
    }
    db.exec(`INSERT INTO users (email, display_name) VALUES ('a@test', 'Instructor');
      INSERT INTO classes (instructor_id, subject_code, subject_name, section, school_year, term)
      VALUES (1, 'A', 'A', 'A', '2026', '1ST_SEMESTER');
      INSERT INTO students (student_number, first_name, last_name) VALUES ('1', 'A', 'B');`);
    const insert = db.prepare(`INSERT INTO class_files
      (id, class_id, title, original_filename, storage_key, mime_type, file_size, uploaded_by)
      VALUES (?, ?, ?, 'a.pdf', ?, 'application/pdf', ?, ?)`);
    insert.run("file", 1, "Title", "class-files/1/file/object", 10, 1);
    const row = db.prepare("SELECT * FROM class_files").get();
    assert.equal(row.version, 1);
    assert.equal(row.description, null);
    assert.match(row.created_at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    for (const [classId, title, size, uploader] of [[2, "T", 10, 1], [1, " ", 10, 1], [1, "T", 0, 1], [1, "T", 26214401, 1], [1, "T", 10, 2]]) {
      assert.throws(() => insert.run(crypto.randomUUID(), classId, title, `class-files/${crypto.randomUUID()}`, size, uploader));
    }
    db.exec("INSERT INTO class_file_views (class_file_id, student_id, version) VALUES ('file', 1, 1)");
    assert.throws(() => db.exec("INSERT INTO class_file_views (class_file_id, student_id, version) VALUES ('file', 1, 1)"));
    assert.throws(() => db.exec("INSERT INTO class_file_views (class_file_id, student_id, version) VALUES ('missing', 1, 1)"));
    assert.throws(() => db.exec("UPDATE class_files SET version = 0"));
    db.exec("UPDATE class_files SET version = 2");
    assert.equal(db.prepare(`SELECT COUNT(*) AS count FROM class_file_views v JOIN class_files f
      ON f.id = v.class_file_id AND f.version = v.version`).get().count, 0);
    db.exec("INSERT INTO class_file_views (class_file_id, student_id, version) VALUES ('file', 1, 2)");
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM class_file_views").get().count, 2);
    db.exec("DELETE FROM class_files");
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM class_file_views").get().count, 0);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally { db.close(); }
});
