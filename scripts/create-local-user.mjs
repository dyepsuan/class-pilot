import { randomUUID, webcrypto } from "node:crypto";
import process from "node:process";
import readline from "node:readline/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const DERIVED_KEY_BYTES = 32;

let executionLabel = "Local";

function readHidden(prompt) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error("Password entry requires an interactive terminal.");
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
      const input = chunk.toString("utf8");

      for (const character of input) {
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
  if (!value) {
    return "NULL";
  }

  return `'${value.replaceAll("'", "''")}'`;
}

async function hashPassword(password) {
  const salt = webcrypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const passwordKey = await webcrypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
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
    passwordKey,
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
  const cliArguments = process.argv.slice(2);
  const isRemote = cliArguments.length === 1 && cliArguments[0] === "--remote";

  if (cliArguments.length > 0 && !isRemote) {
    throw new Error("Usage: node scripts/create-local-user.mjs [--remote]");
  }

  executionLabel = isRemote ? "Remote" : "Local";
  const databaseFlag = isRemote ? "--remote" : "--local";

  const prompt = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  if (isRemote) {
    console.warn(
      "WARNING: This will create or update an instructor account in the REMOTE db_classpilot database."
    );
    const confirmation = await prompt.question("Type YES to continue: ");
    if (confirmation !== "YES") {
      prompt.close();
      console.log("Remote instructor account creation cancelled.");
      return;
    }
  }
  const email = (await prompt.question("Email: ")).trim().toLowerCase();
  const firstName = (await prompt.question("First name: ")).trim();
  const lastName = (await prompt.question("Last name: ")).trim();
  prompt.close();

  if (!/^\S+@\S+\.\S+$/u.test(email)) {
    throw new Error("Enter a valid email address.");
  }

  const password = await readHidden("Password: ");

  if (password.length < 8) {
    throw new Error("Password must contain at least 8 characters.");
  }

  const authId = randomUUID();
  const passwordHash = await hashPassword(password);
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || email;
  const sql = `
    INSERT INTO users (
      auth_id, email, display_name, password_hash,
      first_name, last_name, role, updated_at
    )
    VALUES (
      ${sqlText(authId)}, ${sqlText(email)}, ${sqlText(displayName)},
      ${sqlText(passwordHash)}, ${sqlText(firstName)}, ${sqlText(lastName)},
      'INSTRUCTOR', CURRENT_TIMESTAMP
    )
    ON CONFLICT DO UPDATE SET
      auth_id = COALESCE(users.auth_id, excluded.auth_id),
      display_name = excluded.display_name,
      password_hash = excluded.password_hash,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      role = 'INSTRUCTOR',
      updated_at = CURRENT_TIMESTAMP;
  `;
  const wranglerPath = fileURLToPath(
    new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url)
  );
  const result = spawnSync(
    process.execPath,
    [
      wranglerPath,
      "d1",
      "execute",
      "db_classpilot",
      databaseFlag,
      "--command",
      sql,
    ],
    { stdio: "inherit", shell: false }
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Wrangler could not create the ${executionLabel.toLowerCase()} instructor account.`);
  }

  console.log(`${executionLabel} instructor account ready for ${email}.`);
}

main().catch((error) => {
  const message =
    error instanceof Error ? error.message : "Could not create the account.";
  console.error(`${executionLabel} instructor account creation failed: ${message}`);
  process.exitCode = 1;
});
