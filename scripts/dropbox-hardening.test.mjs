import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import ts from "typescript";

async function loadTypeScriptModule(relativePath) {
  const sourcePath = fileURLToPath(new URL(relativePath, import.meta.url));
  const source = (await readFile(sourcePath, "utf8"))
    .replace(/^import "server-only";\r?\n\r?\n/u, "")
    .replace(
      /^import \{ formatPhilippineShortTimestampDate \} from "@\/lib\/datetime";\r?\n\r?\n/u,
      "const formatPhilippineShortTimestampDate = (value) => value;\n\n"
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

const validation = await loadTypeScriptModule(
  "../src/lib/dropbox/validation.ts"
);
const storageKeys = await loadTypeScriptModule(
  "../src/lib/dropbox/storage-key.ts"
);
const authorization = await loadTypeScriptModule(
  "../src/lib/dropbox/authorization-rules.ts"
);
const studentOperations = await loadTypeScriptModule(
  "../src/lib/dropbox/student-operation-rules.ts"
);
const downloadHeaders = await loadTypeScriptModule(
  "../src/lib/dropbox/download-headers.ts"
);
const instructorQuery = await loadTypeScriptModule(
  "../src/lib/dropbox/instructor-query.ts"
);
const formatting = await loadTypeScriptModule(
  "../src/lib/dropbox/format.ts"
);

test("zero-byte Dropbox files are rejected with a useful error", () => {
  const result = validation.validateDropboxUpload({
    name: "empty.pdf",
    size: 0,
    type: "application/pdf",
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "EMPTY_FILE");
  assert.equal(result.message, "Empty files cannot be uploaded.");
});

test("the 25 MB boundary is inclusive and one extra byte is rejected", () => {
  const exact = validation.validateDropboxUpload({
    name: "exact.pdf",
    size: validation.MAX_DROPBOX_FILE_SIZE,
    type: "application/pdf",
  });
  const oversized = validation.validateDropboxUpload({
    name: "oversized.pdf",
    size: validation.MAX_DROPBOX_FILE_SIZE + 1,
    type: "application/pdf",
  });

  assert.equal(exact.ok, true);
  assert.equal(oversized.ok, false);
  assert.equal(oversized.code, "FILE_TOO_LARGE");
});

test("duplicate original filenames still receive independent private keys", () => {
  const filename = "Proposal.docx";
  const first = storageKeys.generateDropboxStorageKey(7, 11);
  const second = storageKeys.generateDropboxStorageKey(7, 11);

  assert.notEqual(first, second);
  assert.equal(first.includes(filename), false);
  assert.equal(second.includes(filename), false);
});

test("valid punctuation, Unicode, and multiple-period filenames are accepted", () => {
  const examples = [
    ["Final Proposal (Revised).docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["O'Brien Notes.pdf", "application/pdf"],
    ["Research & Analysis.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ["José Rizal Report.pdf", "application/pdf"],
    ["project.final.v2.pdf", "application/pdf"],
  ];

  for (const [name, type] of examples) {
    assert.equal(
      validation.validateDropboxUpload({ name, size: 1024, type }).ok,
      true,
      name
    );
  }
});

test("overlong filenames are rejected instead of silently truncated", () => {
  const result = validation.validateDropboxUpload({
    name: `${"a".repeat(validation.MAX_DROPBOX_FILENAME_LENGTH)}.pdf`,
    size: 1024,
    type: "application/pdf",
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "INVALID_FILENAME");
});

test("extensions remain authoritative while generic PDF MIME is allowed safely", () => {
  for (const name of ["malware.exe", "page.html"]) {
    assert.equal(
      validation.validateDropboxUpload({
        name,
        size: 1024,
        type: name.endsWith(".exe") ? "application/pdf" : "text/plain",
      }).ok,
      false
    );
  }

  const genericPdf = validation.validateDropboxUpload({
    name: "report.pdf",
    size: 1024,
    type: "application/octet-stream",
  });
  assert.equal(genericPdf.ok, true);
  assert.equal(genericPdf.mimeType, "application/octet-stream");
});

test("download headers preserve safe Unicode and block header or path injection", () => {
  const header = downloadHeaders.createDropboxContentDisposition(
    "../José O'Brien (Final)\r\nInjected: yes.pdf"
  );

  assert.equal(header.includes("\r"), false);
  assert.equal(header.includes("\n"), false);
  assert.equal(header.includes("../"), false);
  assert.match(header, /filename\*=UTF-8''/u);
  assert.match(header, /Jos%C3%A9/u);
  assert.match(header, /O%27Brien/u);
});

test("long Unicode download names remain well-formed after safe truncation", () => {
  const header = downloadHeaders.createDropboxContentDisposition(
    `${"📄".repeat(300)}.pdf`
  );

  assert.match(header, /^attachment; filename="/u);
  assert.match(header, /filename\*=UTF-8''/u);
});

test("control characters are rejected from uploaded metadata", () => {
  const result = validation.validateDropboxUpload({
    name: "report\r\ninjected.pdf",
    size: 1024,
    type: "application/pdf",
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "INVALID_FILENAME");
});

test("cross-class instructor and cross-student delete attempts remain inert", async () => {
  assert.equal(
    authorization.isInstructorDropboxClassFileAccessAllowed({
      managedClassId: 4,
      requestedClassId: 4,
      fileClassId: 5,
    }),
    false
  );

  let deletionCalls = 0;
  const result = await studentOperations.executeAuthorizedDropboxDelete({
    authorizedFile: null,
    deleteFile: async () => {
      deletionCalls += 1;
      return true;
    },
  });
  assert.equal(result, "NOT_FOUND");
  assert.equal(deletionCalls, 0);
});

test("search metacharacters stay literal, bound, and class-scoped", () => {
  const search = "%_O'Brien";
  const where = instructorQuery.buildInstructorDropboxWhereClause({
    classId: 42,
    search,
    studentId: null,
    extensions: [],
  });

  assert.match(where.sql, /^df\.class_id = \?1/u);
  assert.equal(where.sql.includes(search), false);
  assert.deepEqual(where.bindings, [42, "%\\%\\_O'Brien%"]);
});

test("instructor enrollment status selection cannot multiply file rows", () => {
  const selection =
    instructorQuery.INSTRUCTOR_DROPBOX_ENROLLMENT_STATUS_SELECT;

  assert.match(selection, /SELECT e\.status/u);
  assert.match(selection, /e\.class_id = df\.class_id/u);
  assert.match(selection, /e\.student_id = df\.student_id/u);
  assert.match(selection, /LIMIT 1/u);
});

test("Dropbox storage formatting covers bytes through gigabytes", () => {
  assert.equal(formatting.formatDropboxFileSize(0), "0 B");
  assert.equal(formatting.formatDropboxFileSize(842 * 1024), "842 KB");
  assert.equal(
    formatting.formatDropboxFileSize(Math.round(1.2 * 1024 ** 3)),
    "1.2 GB"
  );
});
