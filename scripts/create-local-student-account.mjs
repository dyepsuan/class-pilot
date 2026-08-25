import { randomUUID, webcrypto } from "node:crypto";
import process from "node:process";
import readline from "node:readline/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PBKDF2_ITERATIONS = 310_000;
const SALT_BYTES = 16;
const DERIVED_KEY_BYTES = 32;
const wranglerPath = fileURLToPath(
  new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url)
);

function readHidden(prompt) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error("PIN entry requires an interactive terminal.");
  }

  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  return new Promise((resolve, reject) => {
    let value = "";

    function cleanup() {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }

    function onData(chunk) {
      for (const character of chunk.toString("utf8")) {
        if (character === "\u0003") {
          cleanup();
          process.stdout.write("\n");
          reject(new Error("Cancelled."));
          return;
        }

        if (character === "\r" || character === "\n") {
          cleanup();
          process.stdout.write("\n");
          resolve(value);
          return;
        }

        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
          continue;
        }

        if (character >= " ") {
          value += character;
        }
      }
    }

    process.stdin.on("data", onData);
  });
}

function sqlText(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function runWrangler(args, stdio = "pipe") {
  const result = spawnSync(process.execPath, [wranglerPath, ...args], {
    encoding: "utf8",
    shell: false,
    stdio,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || "Wrangler command failed.");
  }

  return result.stdout ?? "";
}

async function hashPin(pin) {
  const salt = webcrypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const pinKey = await webcrypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await webcrypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: PBKDF2_ITERATIONS,
    },
    pinKey,
    DERIVED_KEY_BYTES * 8
  );

  return [
    "pbkdf2_sha256",
    PBKDF2_ITERATIONS,
    Buffer.from(salt).toString("base64url"),
    Buffer.from(bits).toString("base64url"),
  ].join("$");
}

async function main() {
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  const studentNumber = (await prompt.question("Student number: "))
    .trim()
    .toUpperCase();
  prompt.close();

  if (!studentNumber) {
    throw new Error("Student number is required.");
  }

  const lookupSql = `
    SELECT s.id
    FROM students s
    WHERE s.student_number = ${sqlText(studentNumber)} COLLATE NOCASE
      AND EXISTS (
        SELECT 1
        FROM enrollments e
        INNER JOIN classes c ON c.id = e.class_id
        WHERE e.student_id = s.id
          AND e.status = 'ACTIVE'
          AND c.status = 'ACTIVE'
      )
    LIMIT 1;
  `;
  const output = runWrangler([
    "d1", "execute", "db_classpilot", "--local", "--command", lookupSql, "--json",
  ]);
  const payload = JSON.parse(output);
  const row = payload?.[0]?.results?.[0];

  if (!row?.id) {
    throw new Error(
      "No student with that number has an active enrollment in an active class."
    );
  }

  const pin = await readHidden("PIN (4-12 digits): ");

  if (!/^\d{4,12}$/u.test(pin)) {
    throw new Error("PIN must contain 4-12 digits.");
  }

  const pinHash = await hashPin(pin);
  const upsertSql = `
    INSERT INTO student_accounts (id, student_id, pin_hash, updated_at)
    VALUES (${sqlText(randomUUID())}, ${Number(row.id)}, ${sqlText(pinHash)}, CURRENT_TIMESTAMP)
    ON CONFLICT(student_id) DO UPDATE SET
      pin_hash = excluded.pin_hash,
      updated_at = CURRENT_TIMESTAMP;

    DELETE FROM student_sessions WHERE student_id = ${Number(row.id)};
  `;

  runWrangler(
    ["d1", "execute", "db_classpilot", "--local", "--command", upsertSql],
    "inherit"
  );

  console.log(`Local student portal account ready for ${studentNumber}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Could not create the account.");
  process.exitCode = 1;
});
