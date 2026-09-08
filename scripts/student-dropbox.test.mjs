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

const uploadRules = await loadTypeScriptModule(
  "../src/lib/dropbox/upload-rules.ts"
);
const validation = await loadTypeScriptModule(
  "../src/lib/dropbox/validation.ts"
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

test("student upload context requires the selected active class", () => {
  assert.equal(
    uploadRules.isStudentDropboxUploadContextAllowed({
      selectedClassId: 7,
      hasActiveClassAccess: true,
    }),
    true
  );
  assert.equal(
    uploadRules.isStudentDropboxUploadContextAllowed({
      selectedClassId: 7,
      hasActiveClassAccess: false,
    }),
    false
  );
  assert.equal(
    uploadRules.isStudentDropboxUploadContextAllowed({
      selectedClassId: null,
      hasActiveClassAccess: false,
    }),
    false
  );
});

test("student upload batches reject more than 10 files", () => {
  assert.equal(uploadRules.isDropboxBatchSizeAllowed(10), true);
  assert.equal(uploadRules.isDropboxBatchSizeAllowed(11), false);
});

test("student upload server validation rejects oversized and dangerous files", () => {
  const oversized = validation.validateDropboxUpload({
    name: "large.pdf",
    size: validation.MAX_DROPBOX_FILE_SIZE + 1,
    type: "application/pdf",
  });
  const dangerous = validation.validateDropboxUpload({
    name: "malware.exe",
    size: 100,
    type: "application/pdf",
  });

  assert.equal(oversized.ok, false);
  assert.equal(oversized.code, "FILE_TOO_LARGE");
  assert.equal(dangerous.ok, false);
  assert.equal(dangerous.code, "DANGEROUS_FILE_TYPE");
});

test("download authorization allows the owner and hides other or missing files", () => {
  const ownerAllowed = authorization.isStudentDropboxAccessAllowed({
    authenticatedStudentId: 25,
    fileStudentId: 25,
    hasActiveEnrollment: true,
  });
  const otherStudentAllowed = authorization.isStudentDropboxAccessAllowed({
    authenticatedStudentId: 26,
    fileStudentId: 25,
    hasActiveEnrollment: true,
  });

  assert.equal(ownerAllowed, true);
  assert.equal(otherStudentAllowed, false);
  assert.equal(studentOperations.hasAuthorizedDropboxFile({ id: "file" }), true);
  assert.equal(studentOperations.hasAuthorizedDropboxFile(null), false);
});

test("authorized delete runs once for the owner", async () => {
  let deletionCalls = 0;
  const result = await studentOperations.executeAuthorizedDropboxDelete({
    authorizedFile: { id: "owned-file" },
    deleteFile: async () => {
      deletionCalls += 1;
      return true;
    },
  });

  assert.equal(result, "DELETED");
  assert.equal(deletionCalls, 1);
});

test("unauthorized delete returns not found without touching storage", async () => {
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

test("download filenames cannot inject headers or paths", () => {
  const header = downloadHeaders.createDropboxContentDisposition(
    "../report\r\nX-Fake: injected.pdf"
  );

  assert.match(header, /^attachment; filename="/u);
  assert.equal(header.includes("\r"), false);
  assert.equal(header.includes("\n"), false);
  assert.equal(header.includes("../"), false);
});
