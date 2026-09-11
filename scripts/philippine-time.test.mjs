import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import ts from "typescript";

async function loadTypeScriptModule(relativePath) {
  const sourcePath = fileURLToPath(new URL(relativePath, import.meta.url));
  const source = await readFile(sourcePath, "utf8");
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

const datetime = await loadTypeScriptModule("../src/lib/datetime.ts");
const finalAttendancePage = await readFile(
  fileURLToPath(
    new URL(
      "../src/app/classes/[classId]/attendance/[sessionId]/page.tsx",
      import.meta.url
    )
  ),
  "utf8"
);

test("Philippine time formatter converts SQLite UTC timestamps", () => {
  assert.equal(
    datetime.formatPhilippineTime("2026-09-10 08:42:00"),
    "4:42 PM"
  );
  assert.equal(
    datetime.formatPhilippineTime("2026-09-10 14:30:00"),
    "10:30 PM"
  );
});

test("Philippine time formatter converts ISO Z timestamps", () => {
  assert.equal(
    datetime.formatPhilippineTime("2026-09-10T15:42:00Z"),
    "11:42 PM"
  );
});

test("Philippine timestamp date handles the midnight boundary", () => {
  assert.equal(
    datetime.formatPhilippineTimestampDate("2026-09-10 16:30:00"),
    "September 11, 2026"
  );
  assert.equal(
    datetime.formatPhilippineTime("2026-09-10 16:30:00"),
    "12:30 AM"
  );
});

test("Philippine time formatter handles 12 AM and 12 PM", () => {
  assert.equal(
    datetime.formatPhilippineTime("2026-09-10 16:00:00"),
    "12:00 AM"
  );
  assert.equal(
    datetime.formatPhilippineTime("2026-09-10 04:00:00"),
    "12:00 PM"
  );
});

test("Philippine display helpers preserve null and invalid placeholders", () => {
  assert.equal(datetime.formatPhilippineTime(null), "-");
  assert.equal(datetime.formatPhilippineTime(undefined, "Missing"), "Missing");
  assert.equal(datetime.formatPhilippineTime("", "No time"), "No time");
  assert.equal(datetime.formatPhilippineTime("not a timestamp", "Invalid"), "Invalid");
});

test("Philippine date-only formatter does not timezone-shift date-only values", () => {
  assert.equal(
    datetime.formatPhilippineDateOnly("2026-09-10"),
    "September 10, 2026"
  );
});

test("Final Attendance Status uses the shared Philippine time formatter", () => {
  assert.match(finalAttendancePage, /formatPhilippineTime/u);
  assert.match(finalAttendancePage, /item\.recorded_at/u);
  assert.doesNotMatch(finalAttendancePage, /toLocaleTimeString/u);
  assert.doesNotMatch(finalAttendancePage, /toLocaleString/u);
});
