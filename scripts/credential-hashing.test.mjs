import assert from "node:assert/strict";
import { pbkdf2 } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const CURRENT_ITERATIONS = 100_000;
const LEGACY_ITERATIONS = 310_000;
const DERIVED_KEY_BYTES = 32;
const SEPARATOR = "$";

async function loadApplicationCredentialModules() {
  const passwordPath = fileURLToPath(
    new URL("../src/lib/auth/password.ts", import.meta.url)
  );
  const studentPinPath = fileURLToPath(
    new URL("../src/lib/auth/student-pin.ts", import.meta.url)
  );
  const passwordSource = (await readFile(passwordPath, "utf8")).replace(
    /^import "server-only";\r?\n\r?\n/u,
    ""
  );
  const passwordJavaScript = ts.transpileModule(passwordSource, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const passwordModuleUrl = `data:text/javascript;base64,${Buffer.from(
    passwordJavaScript
  ).toString("base64")}`;
  const passwordModule = await import(passwordModuleUrl);

  const studentPinSource = await readFile(studentPinPath, "utf8");
  const studentPinJavaScript = ts
    .transpileModule(studentPinSource, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    })
    .outputText.replace(
      'from "./password"',
      `from ${JSON.stringify(passwordModuleUrl)}`
    );
  const studentPinModule = await import(
    `data:text/javascript;base64,${Buffer.from(studentPinJavaScript).toString(
      "base64"
    )}`
  );

  return { passwordModule, studentPinModule };
}

function deriveLegacyKey(value, salt) {
  return new Promise((resolve, reject) => {
    pbkdf2(
      value,
      salt,
      LEGACY_ITERATIONS,
      DERIVED_KEY_BYTES,
      "sha256",
      (error, key) => {
        if (error) reject(error);
        else resolve(key);
      }
    );
  });
}

async function createLegacyHash(value) {
  const salt = Uint8Array.from({ length: 16 }, (_, index) => index + 1);
  const key = await deriveLegacyKey(value, salt);
  return [
    "pbkdf2_sha256",
    LEGACY_ITERATIONS,
    Buffer.from(salt).toString("base64url"),
    Buffer.from(key).toString("base64url"),
  ].join(SEPARATOR);
}

const { passwordModule, studentPinModule } =
  await loadApplicationCredentialModules();

test("new instructor hashes use the current cost and verify safely", async () => {
  const hash = await passwordModule.hashPassword("Disposable-password-42");
  assert.equal(hash.split(SEPARATOR)[1], String(CURRENT_ITERATIONS));
  assert.equal(
    await passwordModule.verifyPassword("Disposable-password-42", hash),
    true
  );
  assert.equal(await passwordModule.verifyPassword("wrong-password", hash), false);
});

test("new student PIN hashes use the current cost and verify safely", async () => {
  const hash = await studentPinModule.hashStudentPin("482915");
  assert.equal(hash.split(SEPARATOR)[1], String(CURRENT_ITERATIONS));
  assert.equal(await studentPinModule.verifyStudentPin("482915", hash), true);
  assert.equal(await studentPinModule.verifyStudentPin("000000", hash), false);
});

test("legacy 310000 hashes remain verifiable in supporting Node runtimes", async () => {
  const hash = await createLegacyHash("Disposable-legacy-password");
  assert.equal(
    await passwordModule.verifyPassword("Disposable-legacy-password", hash),
    true
  );
  assert.equal(await passwordModule.verifyPassword("wrong-password", hash), false);
});

test("unrecognized iteration counts are rejected before derivation", async () => {
  const hash = await passwordModule.hashPassword("Disposable-password-42");
  const parts = hash.split(SEPARATOR);
  parts[1] = "200000";
  assert.equal(
    await passwordModule.verifyPassword(
      "Disposable-password-42",
      parts.join(SEPARATOR)
    ),
    false
  );
});
