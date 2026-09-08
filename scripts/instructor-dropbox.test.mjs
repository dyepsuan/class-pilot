import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import ts from "typescript";

async function loadTypeScriptModule(relativePath) {
  const sourcePath = fileURLToPath(new URL(relativePath, import.meta.url));
  const source = (await readFile(sourcePath, "utf8")).replace(
    /^import "server-only";\r?\n\r?\n/u,
    ""
  );
  const javascript = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  return import(
    `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`
  );
}

const authorization = await loadTypeScriptModule(
  "../src/lib/dropbox/authorization-rules.ts"
);
const instructorQuery = await loadTypeScriptModule(
  "../src/lib/dropbox/instructor-query.ts"
);

test("owning instructor can download a file from the requested class", () => {
  assert.equal(
    authorization.isInstructorDropboxClassFileAccessAllowed({
      managedClassId: 30,
      requestedClassId: 30,
      fileClassId: 30,
    }),
    true
  );
});

test("unrelated instructor and missing files resolve as not found", () => {
  assert.equal(
    authorization.isInstructorDropboxClassFileAccessAllowed({
      managedClassId: null,
      requestedClassId: 30,
      fileClassId: 30,
    }),
    false
  );
  assert.equal(
    authorization.isInstructorDropboxClassFileAccessAllowed({
      managedClassId: 30,
      requestedClassId: 30,
      fileClassId: null,
    }),
    false
  );
});

test("Class A instructor cannot download a Class B file through Class A", () => {
  assert.equal(
    authorization.isInstructorDropboxClassFileAccessAllowed({
      managedClassId: 30,
      requestedClassId: 30,
      fileClassId: 31,
    }),
    false
  );
});

test("historical dropped-student files remain available to the class instructor", () => {
  const historicalFile = {
    classId: 30,
    enrollmentStatus: "DROPPED",
  };

  assert.equal(
    authorization.isInstructorDropboxClassFileAccessAllowed({
      managedClassId: 30,
      requestedClassId: 30,
      fileClassId: historicalFile.classId,
    }),
    true
  );
  assert.equal(
    authorization.isInstructorDropboxClassFileAccessAllowed({
      managedClassId: null,
      requestedClassId: 30,
      fileClassId: historicalFile.classId,
    }),
    false
  );
});

test("instructor listing query is always scoped to the requested class", () => {
  const where = instructorQuery.buildInstructorDropboxWhereClause({
    classId: 44,
    search: null,
    studentId: null,
    extensions: [],
  });

  assert.match(where.sql, /^df\.class_id = \?1/u);
  assert.deepEqual(where.bindings, [44]);
});

test("search and student filters retain class scope and parameter bindings", () => {
  const searchWhere = instructorQuery.buildInstructorDropboxWhereClause({
    classId: 44,
    search: "proposal",
    studentId: null,
    extensions: [],
  });
  const studentWhere = instructorQuery.buildInstructorDropboxWhereClause({
    classId: 44,
    search: null,
    studentId: 91,
    extensions: [],
  });

  assert.match(searchWhere.sql, /^df\.class_id = \?1/u);
  assert.deepEqual(searchWhere.bindings, [44, "%proposal%"]);
  assert.match(studentWhere.sql, /^df\.class_id = \?1/u);
  assert.deepEqual(studentWhere.bindings, [44, 91]);
});

test("file-type filtering is parameterized and ordering stays newest first", () => {
  const where = instructorQuery.buildInstructorDropboxWhereClause({
    classId: 44,
    search: null,
    studentId: null,
    extensions: ["doc", "docx"],
  });

  assert.deepEqual(where.bindings, [44, "%.doc", "%.docx"]);
  assert.equal(where.sql.includes("%.doc"), false);
  assert.equal(
    instructorQuery.INSTRUCTOR_DROPBOX_ORDER_BY,
    "df.created_at DESC, df.id DESC"
  );
});
