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

const validation = await loadTypeScriptModule(
  "../src/lib/dropbox/validation.ts"
);
const storageKeys = await loadTypeScriptModule(
  "../src/lib/dropbox/storage-key.ts"
);
const authorization = await loadTypeScriptModule(
  "../src/lib/dropbox/authorization-rules.ts"
);

test("Dropbox validation accepts supported PDF, DOCX, and image files", () => {
  assert.equal(
    validation.validateDropboxUpload({
      name: "syllabus.pdf",
      size: 1_024,
      type: "application/pdf",
    }).ok,
    true
  );
  assert.equal(
    validation.validateDropboxUpload({
      name: "paper.docx",
      size: 2_048,
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }).ok,
    true
  );
  assert.equal(
    validation.validateDropboxUpload({
      name: "diagram.PNG",
      size: 4_096,
      type: "image/png",
    }).ok,
    true
  );
});

test("Dropbox validation rejects files above 25 MB", () => {
  const result = validation.validateDropboxUpload({
    name: "oversized.pdf",
    size: validation.MAX_DROPBOX_FILE_SIZE + 1,
    type: "application/pdf",
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "FILE_TOO_LARGE");
});

test("Dropbox validation rejects executable and HTML files", () => {
  for (const name of ["payload.exe", "page.html"]) {
    const result = validation.validateDropboxUpload({
      name,
      size: 100,
      type: "application/pdf",
    });

    assert.equal(result.ok, false);
    assert.equal(result.code, "DANGEROUS_FILE_TYPE");
  }
});

test("Dropbox validation rejects unsupported extensions", () => {
  const result = validation.validateDropboxUpload({
    name: "archive.rar",
    size: 100,
    type: "application/octet-stream",
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "UNSUPPORTED_FILE_TYPE");
});

test("a misleading allowed MIME type cannot bypass a dangerous extension", () => {
  const result = validation.validateDropboxUpload({
    name: "definitely-not-a-document.exe",
    size: 100,
    type: "application/pdf",
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "DANGEROUS_FILE_TYPE");
});

test("Dropbox storage keys are contextual, private, and unique", () => {
  const originalFilename = "private-assignment.pdf";
  const first = storageKeys.generateDropboxStorageKey(12, 34);
  const second = storageKeys.generateDropboxStorageKey(12, 34);

  assert.match(first, /^dropbox\/12\/34\//u);
  assert.equal(first.includes(originalFilename), false);
  assert.equal(storageKeys.isDropboxStorageKey(first), true);
  assert.notEqual(first, second);
});

test("Dropbox student authorization requires ownership and active enrollment", () => {
  assert.equal(
    authorization.isStudentDropboxAccessAllowed({
      authenticatedStudentId: 10,
      fileStudentId: 10,
      hasActiveEnrollment: true,
    }),
    true
  );
  assert.equal(
    authorization.isStudentDropboxAccessAllowed({
      authenticatedStudentId: 11,
      fileStudentId: 10,
      hasActiveEnrollment: true,
    }),
    false
  );
  assert.equal(
    authorization.isStudentDropboxAccessAllowed({
      authenticatedStudentId: 10,
      fileStudentId: 10,
      hasActiveEnrollment: false,
    }),
    false
  );
});

test("Dropbox instructor authorization requires the file's managed class", () => {
  assert.equal(
    authorization.isInstructorDropboxAccessAllowed({
      fileClassId: 20,
      managedClassId: 20,
    }),
    true
  );
  assert.equal(
    authorization.isInstructorDropboxAccessAllowed({
      fileClassId: 20,
      managedClassId: 21,
    }),
    false
  );
});
