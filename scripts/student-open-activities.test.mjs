import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const sourcePaths = {
  dashboardPage: "../src/app/student/(portal)/page.tsx",
  laboratoriesPage: "../src/app/student/(portal)/laboratories/page.tsx",
  studentPortal: "../src/lib/db/student-portal.ts",
};

const sources = Object.fromEntries(
  await Promise.all(
    Object.entries(sourcePaths).map(async ([key, relativePath]) => [
      key,
      await readFile(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8"),
    ])
  )
);

test("student dashboard renders compact Open Activities above recent activity", () => {
  assert.match(sources.dashboardPage, /function OpenActivitiesSection/u);
  assert.match(sources.dashboardPage, /Open Activities/u);
  assert.match(sources.dashboardPage, /activities=\{openActivities\}/u);
  assert.match(sources.dashboardPage, /hasMore=\{hasMoreOpenActivities\}/u);
  assert.match(
    sources.dashboardPage,
    /<OpenActivitiesSection[\s\S]*<section[\s\S]*Recent activity/u
  );
});

test("open activities query is selected-class scoped, open-only, sorted, and capped", () => {
  assert.match(sources.studentPortal, /export async function getStudentOpenActivities/u);
  assert.match(sources.studentPortal, /WHERE l\.class_id = \?2[\s\S]*AND l\.status = 'open'/u);
  assert.match(sources.studentPortal, /l\.lab_type = 'individual'/u);
  assert.match(sources.studentPortal, /l\.lab_type = 'group'[\s\S]*LABORATORY_EFFECTIVE_LOCK_SQL[\s\S]*sgs\.group_id IS NOT NULL/u);
  assert.match(sources.studentPortal, /CASE WHEN l\.due_date IS NULL THEN 1 ELSE 0 END ASC/u);
  assert.match(sources.studentPortal, /l\.due_date ASC/u);
  assert.match(sources.studentPortal, /l\.lab_no ASC/u);
  assert.match(sources.studentPortal, /LIMIT \?3/u);
  assert.match(sources.studentPortal, /previewLimit \+ 1/u);
  assert.match(sources.studentPortal, /hasMore: rows\.length > previewLimit/u);
});

test("group open activity status reuses official group and submission timing semantics", () => {
  assert.match(sources.studentPortal, /WITH student_groups AS/u);
  assert.match(sources.studentPortal, /lgm\.student_id = \?1/u);
  assert.match(sources.studentPortal, /LEFT JOIN laboratory_group_submissions lgsub/u);
  assert.match(sources.studentPortal, /lgsub\.group_id = sgs\.group_id/u);
  assert.match(sources.studentPortal, /getLaboratorySubmissionTiming/u);
  assert.match(sources.studentPortal, /"Not submitted"/u);
  assert.match(sources.studentPortal, /"Submitted"/u);
  assert.match(sources.studentPortal, /"Late"/u);
});

test("open activities dashboard links to stable laboratory anchors", () => {
  assert.match(sources.dashboardPage, /href=\{`\/student\/laboratories#laboratory-\$\{activity\.laboratory_id\}`\}/u);
  assert.match(sources.dashboardPage, /aria-label=\{`View Laboratory \$\{activity\.lab_no\}: \$\{activity\.title\}`\}/u);
  assert.match(sources.laboratoriesPage, /id=\{`laboratory-\$\{laboratory\.laboratory_id\}`\}/u);
  assert.match(sources.laboratoriesPage, /scroll-mt-24/u);
});

test("open activities avoid scores, member lists, and raw storage fields", () => {
  const openActivityType = sources.studentPortal.match(
    /export type StudentOpenActivity = \{[\s\S]*?\};/u
  )?.[0] ?? "";
  const openActivityFunction = sources.studentPortal.match(
    /export async function getStudentOpenActivities[\s\S]*?^\}/mu
  )?.[0] ?? "";

  assert.doesNotMatch(openActivityType, /score|member|r2|storage/u);
  assert.doesNotMatch(openActivityFunction, /individual_score|group_members|r2_key|r2Key|storageKey/u);
  assert.doesNotMatch(sources.dashboardPage, /Your Score|score=|individual_score|group_score|r2Key|storageKey/u);
});

test("open activities include empty, overdue, and view-all states", () => {
  assert.match(sources.dashboardPage, /No open activities right now\./u);
  assert.match(sources.dashboardPage, /You&apos;re all caught up for this class\./u);
  assert.match(sources.dashboardPage, /Due \$\{formatActivityDate\(value\)\}/u);
  assert.match(sources.dashboardPage, /activity\.due_date < currentClassroomDate/u);
  assert.match(sources.dashboardPage, /Overdue/u);
  assert.match(sources.dashboardPage, /View all laboratories/u);
});
