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
const studentSessionCookies = await loadTypeScriptModule(
  "../src/lib/auth/student-session-cookie.ts"
);
const studentDropboxRouteSources = await Promise.all(
  [
    "../src/app/api/student/dropbox/route.ts",
    "../src/app/api/student/dropbox/[fileId]/route.ts",
    "../src/app/api/student/dropbox/[fileId]/download/route.ts",
  ].map((relativePath) =>
    readFile(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8")
  )
);
const studentLoginActionSource = await readFile(
  fileURLToPath(new URL("../src/app/student/login/actions.ts", import.meta.url)),
  "utf8"
);
const studentLoginCompletionSource = await readFile(
  fileURLToPath(
    new URL("../src/app/student/login/complete/route.ts", import.meta.url)
  ),
  "utf8"
);
const studentLogoutActionSource = await readFile(
  fileURLToPath(new URL("../src/app/student/logout/actions.ts", import.meta.url)),
  "utf8"
);
const studentLogoutCompletionSource = await readFile(
  fileURLToPath(new URL("../src/app/student/logout/route.ts", import.meta.url)),
  "utf8"
);

test("student session creation issues the canonical root-scoped cookie", () => {
  const expiresAt = new Date("2030-01-02T03:04:05.000Z");
  const cookie = studentSessionCookies.createStudentSessionCookie(
    "session-token",
    expiresAt,
    true
  );

  assert.equal(cookie.name, "class_pilot_student_session");
  assert.equal(cookie.value, "session-token");
  assert.equal(cookie.path, "/");
  assert.equal(cookie.httpOnly, true);
  assert.equal(cookie.sameSite, "lax");
  assert.equal(cookie.secure, true);
  assert.equal(cookie.maxAge, 60 * 60 * 24 * 7);
  assert.equal(cookie.expires, expiresAt);
});

test("student login completion expires the legacy path cookie", () => {
  const cookie =
    studentSessionCookies.expireLegacyStudentSessionCookie(true);

  assert.equal(cookie.path, "/student");
  assert.equal(cookie.value, "");
  assert.equal(cookie.maxAge, 0);
  assert.equal(cookie.expires.getTime(), 0);
  assert.match(
    studentLoginActionSource,
    /redirect\("\/student\/login\/complete"\)/u
  );
  assert.match(
    studentLoginCompletionSource,
    /await clearLegacyStudentSessionCookie\(\)/u
  );
});

test("student logout clears canonical and legacy path cookies", () => {
  const canonicalCookie =
    studentSessionCookies.expireCanonicalStudentSessionCookie(false);
  const legacyCookie =
    studentSessionCookies.expireLegacyStudentSessionCookie(false);

  assert.equal(canonicalCookie.path, "/");
  assert.equal(canonicalCookie.maxAge, 0);
  assert.equal(legacyCookie.path, "/student");
  assert.equal(legacyCookie.maxAge, 0);
  assert.match(studentLogoutActionSource, /await destroyStudentSession\(\)/u);
  assert.match(studentLogoutActionSource, /redirect\("\/student\/logout"\)/u);
  assert.match(
    studentLogoutCompletionSource,
    /await destroyLegacyStudentSession\(\)/u
  );
});

test("all student Dropbox routes use the canonical student session resolver", () => {
  for (const source of studentDropboxRouteSources) {
    assert.match(
      source,
      /import \{ getStudentSession \} from "@\/lib\/auth\/student-session";/u
    );
    assert.match(source, /await getStudentSession\(\)/u);
  }
});

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
