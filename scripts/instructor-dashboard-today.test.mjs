import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const encodedModule = (source) =>
  "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const mocks = {
  "next/link": encodedModule('export default "a";'),
  "next/navigation": encodedModule(
    "export const useRouter = () => ({ refresh() {} });"
  ),
  "react": pathToFileURL(require.resolve("react")).href,
  "react/jsx-runtime": pathToFileURL(require.resolve("react/jsx-runtime")).href,
};
const moduleCache = new Map();

async function moduleUrl(url) {
  if (moduleCache.has(url.href)) return moduleCache.get(url.href);

  let javascript = ts.transpileModule(await readFile(url, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;

  for (const match of [...javascript.matchAll(/from ["']([^"']+)["']/gu)]) {
    const dependency = match[1];
    const dependencyUrl = dependency.startsWith("@/")
      ? new URL("../src/" + dependency.slice(2) + ".ts", import.meta.url)
      : new URL(dependency + ".ts", url);
    const resolved = mocks[dependency] ?? await moduleUrl(dependencyUrl);
    javascript = javascript.replace(match[0], 'from "' + resolved + '"');
  }

  const result = encodedModule(javascript);
  moduleCache.set(url.href, result);
  return result;
}

async function load(relativePath) {
  return import(await moduleUrl(new URL(relativePath, import.meta.url)));
}

const { buildTodaySchedule } = await load("../src/lib/dashboard-today.ts");
const { getClassroomDate } = await load("../src/lib/classroom-time.ts");
const TodaySchedule = (
  await load("../src/components/instructor-today-schedule.tsx")
).default;
const componentSource = await readFile(
  new URL("../src/components/instructor-today-schedule.tsx", import.meta.url),
  "utf8"
);

const classItem = (overrides = {}) => ({
  id: 1,
  subject_code: "IS 106",
  subject_name: "IS Project Management 1",
  section: "BSIS 3B",
  schedule_text: null,
  meetings: [],
  ...overrides,
});

const meetingClass = (id, section, start_time, end_time) => classItem({
  id,
  section,
  meetings: [{ id, weekday: "THURSDAY", start_time, end_time }],
});

const dailyAgenda = () => [
  meetingClass(1, "BSIS 3A", "08:00", "10:00"),
  meetingClass(2, "BSIS 3D", "10:00", "12:00"),
  meetingClass(3, "BSIS 3B", "13:00", "15:00"),
  classItem({ id: 4, section: "BSIS 3C", schedule_text: "Thursday" }),
];

const atTime = (classes, currentMinutes) => buildTodaySchedule(
  classes,
  { weekday: "Thursday", currentMinutes }
);

const renderSchedule = (schedule, initialManilaMinutes) =>
  renderToStaticMarkup(createElement(TodaySchedule, {
    dateLabel: "Thursday, September 17",
    weekday: "Thursday",
    schedule,
    initialManilaMinutes,
  }));

test("classroom date exposes the Philippine date and current minute", () => {
  const date = getClassroomDate(new Date("2026-09-17T00:30:00Z"));
  assert.deepEqual(date, {
    weekday: "Thursday",
    dateLabel: "Thursday, September 17",
    currentMinutes: 8 * 60 + 30,
  });
});

test("today schedule filters weekdays and puts upcoming before completed", () => {
  const schedule = atTime([
    meetingClass(2, "BSIS 3A", "13:00", "15:00"),
    classItem({
      id: 3,
      section: "BSIS 3C",
      meetings: [{ id: 3, weekday: "FRIDAY", start_time: "07:00", end_time: "09:00" }],
    }),
    meetingClass(1, "BSIS 3B", "08:00", "10:00"),
  ], 11 * 60);

  assert.deepEqual(schedule.map((item) => item.classItem.section), ["BSIS 3A", "BSIS 3B"]);
  assert.deepEqual(schedule.map((item) => item.state), ["UPCOMING", "COMPLETED"]);
});

test("upcoming meetings remain neutral and sort by start time ascending", () => {
  const schedule = atTime([
    meetingClass(1, "BSIS 3B", "13:00", "15:00"),
    meetingClass(2, "BSIS 3D", "10:00", "12:00"),
    meetingClass(3, "BSIS 3A", "08:00", "09:00"),
  ], 7 * 60);

  assert.deepEqual(schedule.map((item) => item.classItem.section), [
    "BSIS 3A",
    "BSIS 3D",
    "BSIS 3B",
  ]);
  assert.ok(schedule.every((item) => item.state === "UPCOMING"));
  assert.ok(schedule.every((item) => item.isCurrent === false));
});

test("same-day meetings for one class remain separate schedule rows", () => {
  const schedule = atTime([
    classItem({
      meetings: [
        { id: 1, weekday: "THURSDAY", start_time: "08:00", end_time: "09:00" },
        { id: 2, weekday: "THURSDAY", start_time: "14:00", end_time: "15:00" },
      ],
    }),
  ], 12 * 60);

  assert.equal(schedule.length, 2);
  assert.notEqual(schedule[0].eventKey, schedule[1].eventKey);
});

test("NOW uses inclusive starts and exclusive ends", () => {
  const meeting = meetingClass(1, "BSIS 3B", "08:00", "10:00");
  const statusAt = (currentMinutes) => atTime([meeting], currentMinutes)[0];

  assert.equal(statusAt(7 * 60 + 59).state, "UPCOMING");
  assert.equal(statusAt(8 * 60).state, "CURRENT");
  assert.equal(statusAt(9 * 60 + 59).isCurrent, true);
  assert.equal(statusAt(10 * 60).state, "COMPLETED");
});

test("legacy schedules expand multiple time ranges and prioritize their live state", () => {
  const schedule = atTime([
    classItem({
      schedule_text: "Thursday 1:00 PM - 2:00 PM, 8:00 AM - 9:00 AM",
    }),
  ], 8 * 60 + 30);

  assert.deepEqual(schedule.map((item) => item.meetingTime), [
    "8:00 AM – 9:00 AM",
    "1:00 PM – 2:00 PM",
  ]);
  assert.deepEqual(schedule.map((item) => item.state), ["CURRENT", "UPCOMING"]);
});

test("at 10:30 current, upcoming, unscheduled, and completed use exact priority", () => {
  const schedule = atTime(dailyAgenda(), 10 * 60 + 30);
  assert.deepEqual(schedule.map((item) => item.classItem.section), [
    "BSIS 3D",
    "BSIS 3B",
    "BSIS 3C",
    "BSIS 3A",
  ]);
  assert.deepEqual(schedule.map((item) => item.state), [
    "CURRENT",
    "UPCOMING",
    "UNSCHEDULED",
    "COMPLETED",
  ]);

  const html = renderSchedule(schedule, 10 * 60 + 30);
  assert.match(html, /data-meeting-state="current"/u);
  assert.match(html, /border-blue-300 bg-blue-50\/70 ring-1 ring-blue-100/u);
  assert.equal((html.match(/>NOW</gu) ?? []).length, 1);
});

test("between classes, upcoming stays neutral and completed sorts by newest end", () => {
  const schedule = atTime(dailyAgenda(), 12 * 60 + 15);
  assert.deepEqual(schedule.map((item) => item.classItem.section), [
    "BSIS 3B",
    "BSIS 3C",
    "BSIS 3D",
    "BSIS 3A",
  ]);
  assert.deepEqual(schedule.map((item) => item.state), [
    "UPCOMING",
    "UNSCHEDULED",
    "COMPLETED",
    "COMPLETED",
  ]);

  const html = renderSchedule(schedule, 12 * 60 + 15);
  assert.doesNotMatch(html, /data-meeting-state="current"/u);
  assert.doesNotMatch(html, />NOW</u);
});

test("exact noon and 1 PM boundaries reclassify and reorder meetings", () => {
  const atNoon = atTime(dailyAgenda(), 12 * 60);
  assert.equal(atNoon.find((item) => item.classItem.section === "BSIS 3D").state, "COMPLETED");

  const atOne = atTime(dailyAgenda(), 13 * 60);
  assert.equal(atOne[0].classItem.section, "BSIS 3B");
  assert.equal(atOne[0].state, "CURRENT");
  assert.equal(atOne[0].isCurrent, true);
});

test("overlapping current meetings are both first, highlighted, and ordered by start", () => {
  const schedule = atTime([
    meetingClass(1, "BSIS 3A", "09:00", "11:00"),
    meetingClass(2, "BSIS 3D", "10:00", "12:00"),
    meetingClass(3, "BSIS 3B", "13:00", "15:00"),
  ], 10 * 60 + 30);

  assert.deepEqual(schedule.slice(0, 2).map((item) => item.classItem.section), [
    "BSIS 3A",
    "BSIS 3D",
  ]);
  assert.ok(schedule.slice(0, 2).every((item) => item.state === "CURRENT"));

  const html = renderSchedule(schedule, 10 * 60 + 30);
  assert.equal((html.match(/data-meeting-state="current"/gu) ?? []).length, 2);
  assert.equal((html.match(/>NOW</gu) ?? []).length, 2);
});

test("schedule cards retain layout, routes, and parent panel styling", () => {
  const schedule = atTime([meetingClass(1, "BSIS 3B", "08:00", "10:00")], 9 * 60);
  const html = renderSchedule(schedule, 9 * 60);

  assert.match(html, /Your classes today/u);
  assert.match(html, /Thursday, September 17/u);
  assert.match(html, /href="\/classes\/1"/u);
  assert.match(html, /href="\/classes\/1\/attendance"/u);
  assert.match(html, /rounded-xl border border-slate-200\/80 bg-white\/95 p-5 shadow-sm/u);
  assert.match(html, /grid-cols-1/u);
});

test("client agenda updates by Manila minute and refreshes across Manila midnight", () => {
  assert.match(componentSource, /getClassroomDate\(\)/u);
  assert.match(componentSource, /setInterval\(updateScheduleTime, 60_000\)/u);
  assert.match(componentSource, /classroomDate\.dateLabel !== dateLabel/u);
  assert.match(componentSource, /setCurrentMinutes\(24 \* 60\)/u);
  assert.match(componentSource, /router\.refresh\(\)/u);
  assert.doesNotMatch(componentSource, /setInterval\([^,]+,\s*1_000\)/u);
});

test("empty schedule stays inside the parent panel without fake rows", () => {
  const html = renderSchedule([], 10 * 60 + 30);

  assert.match(html, /rounded-xl border border-slate-200\/80 bg-white\/95 p-5 shadow-sm/u);
  assert.match(html, /No classes today/u);
  assert.match(html, /You don&#x27;t have any scheduled classes for Thursday\./u);
  assert.doesNotMatch(html, /Open Class/u);
  assert.doesNotMatch(html, /Attendance/u);
});