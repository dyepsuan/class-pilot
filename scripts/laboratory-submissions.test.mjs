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
      /^import \{ CLASSROOM_TIME_ZONE \} from "@\/lib\/classroom-time";\r?\n\r?\n/u,
      'const CLASSROOM_TIME_ZONE = "Asia/Manila";\n\n'
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
  "../src/lib/laboratory-submissions/validation.ts"
);
const storageKey = await loadTypeScriptModule(
  "../src/lib/laboratory-submissions/storage-key.ts"
);
const deadline = await loadTypeScriptModule(
  "../src/lib/laboratory-submissions/deadline.ts"
);

const sourcePaths = {
  db: "../src/lib/db/laboratory-submissions.ts",
  migration: "../migrations/0013_add_laboratory_group_submissions.sql",
  lockMigration: "../migrations/0014_harden_laboratory_group_submission_locking.sql",
  uploadRoute: "../src/app/api/student/laboratory-submissions/route.ts",
  downloadRoute:
    "../src/app/api/student/laboratory-submissions/[laboratoryId]/download/route.ts",
  instructorDownloadRoute:
    "../src/app/api/classes/[classId]/laboratories/[laboratoryId]/groups/[groupId]/submission/route.ts",
  component:
    "../src/app/student/(portal)/laboratories/StudentGroupSubmission.tsx",
  studentPage:
    "../src/app/student/(portal)/laboratories/page.tsx",
  instructorComponent:
    "../src/app/classes/[classId]/laboratories/[laboratoryId]/InstructorGroupSubmission.tsx",
  groupSetup:
    "../src/app/classes/[classId]/laboratories/[laboratoryId]/GroupSetup.tsx",
  groupLockControls:
    "../src/app/classes/[classId]/laboratories/[laboratoryId]/GroupLockControls.tsx",
  instructorPage:
    "../src/app/classes/[classId]/laboratories/[laboratoryId]/page.tsx",
  laboratoryActions:
    "../src/app/classes/[classId]/laboratories/[laboratoryId]/actions.ts",
  portal: "../src/lib/db/student-portal.ts",
  auth: "../src/lib/auth/laboratory-submissions.ts",
  headers: "../src/lib/laboratory-submissions/download-headers.ts",
};

const sources = Object.fromEntries(
  await Promise.all(
    Object.entries(sourcePaths).map(async ([key, relativePath]) => [
      key,
      await readFile(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8"),
    ])
  )
);

test("laboratory submission validation accepts only the Phase 2 file set", () => {
  assert.equal(validation.MAX_LABORATORY_SUBMISSION_SIZE, 20 * 1024 * 1024);

  const accepted = validation.validateLaboratorySubmission({
    name: "System-Context-Map.pdf",
    size: 1024,
    type: "application/pdf",
  });

  const badExtension = validation.validateLaboratorySubmission({
    name: "malware.exe",
    size: 1024,
    type: "application/pdf",
  });

  const mismatch = validation.validateLaboratorySubmission({
    name: "slides.pptx",
    size: 1024,
    type: "application/pdf",
  });

  const oversized = validation.validateLaboratorySubmission({
    name: "large.zip",
    size: validation.MAX_LABORATORY_SUBMISSION_SIZE + 1,
    type: "application/zip",
  });

  assert.equal(accepted.ok, true);
  assert.equal(badExtension.ok, false);
  assert.equal(badExtension.code, "UNSUPPORTED_FILE_TYPE");
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.code, "MIME_TYPE_MISMATCH");
  assert.equal(oversized.ok, false);
  assert.equal(oversized.code, "FILE_TOO_LARGE");
});

test("laboratory submission keys never include original filenames", () => {
  const key = storageKey.generateLaboratorySubmissionKey(12, 34);

  assert.match(key, /^laboratories\/12\/groups\/34\//u);
  assert.equal(storageKey.isLaboratorySubmissionKey(key), true);
  assert.equal(key.includes("System-Context-Map"), false);
});

test("deadline classification uses inclusive Manila calendar dates", () => {
  assert.equal(
    deadline.getLaboratorySubmissionTiming(
      "2026-09-10T15:59:59.000Z",
      "2026-09-10"
    ),
    "ON_TIME"
  );
  assert.equal(
    deadline.getLaboratorySubmissionTiming(
      "2026-09-10T16:00:00.000Z",
      "2026-09-10"
    ),
    "LATE"
  );
  assert.equal(deadline.getLaboratorySubmissionTiming(new Date(), null), null);
});

test("student upload route accepts no authoritative group or storage fields", () => {
  assert.match(sources.uploadRoute, /await getStudentSession\(\)/u);
  assert.match(sources.uploadRoute, /resolveStudentOfficialLaboratoryGroup/u);
  assert.match(sources.uploadRoute, /formData\.get\("laboratoryId"\)/u);
  assert.match(sources.uploadRoute, /formData\.get\("file"\)/u);
  assert.doesNotMatch(sources.uploadRoute, /formData\.get\("groupId"\)/u);
  assert.doesNotMatch(sources.uploadRoute, /formData\.get\("studentId"\)/u);
  assert.doesNotMatch(sources.uploadRoute, /formData\.get\("r2Key"\)/u);
  assert.doesNotMatch(sources.uploadRoute, /formData\.get\("submitted_at"\)/u);
});

test("metadata writes protect initial and replacement concurrency", () => {
  assert.match(sources.db, /INSERT OR IGNORE INTO laboratory_group_submissions/u);
  assert.match(sources.migration, /UNIQUE \(laboratory_id, group_id\)/u);
  assert.match(sources.db, /AND r2_key = \?9/u);
  assert.match(sources.db, /AND updated_at = \?10/u);
  assert.match(sources.db, /uploaded_by_student_id = \?1/u);
  assert.match(sources.db, /updated_at = \?6/u);
  assert.doesNotMatch(
    sources.db,
    /submitted_at = excluded\.submitted_at/u
  );
});

test("database hardening keeps submitted groupings locked", () => {
  assert.match(sources.lockMigration, /prevent_group_unlock_after_submission_or_score/u);
  assert.match(sources.lockMigration, /BEFORE UPDATE OF groups_locked_at ON laboratories/u);
  assert.match(sources.lockMigration, /NEW\.groups_locked_at IS NULL/u);
  assert.match(sources.lockMigration, /FROM laboratory_group_submissions lgs/u);
  assert.match(sources.lockMigration, /require_locked_groups_for_submission_insert/u);
  assert.match(sources.lockMigration, /BEFORE INSERT ON laboratory_group_submissions/u);
  assert.match(sources.lockMigration, /l\.groups_locked_at IS NOT NULL/u);
  assert.match(sources.lockMigration, /require_locked_groups_for_submission_update/u);
});

test("unlock controls and server action treat submissions as permanent locks", () => {
  assert.match(sources.instructorPage, /getLaboratoryGroupingLifecycleState/u);
  assert.match(sources.instructorPage, /hasSubmissions=\{hasSubmissions\}/u);
  assert.match(sources.groupLockControls, /hasSubmissions: boolean/u);
  assert.match(sources.groupLockControls, /hasScores \|\| hasSubmissions/u);
  assert.match(sources.groupLockControls, /group submission has already been recorded/u);
  assert.match(sources.laboratoryActions, /getLaboratoryGroupingLifecycleState/u);
  assert.match(sources.laboratoryActions, /!lifecycle\.canUnlock/u);
  assert.match(sources.laboratoryActions, /FROM laboratory_group_submissions/u);
});

test("student download route streams only the authenticated current group object", () => {
  assert.match(sources.downloadRoute, /await getStudentSession\(\)/u);
  assert.match(sources.downloadRoute, /resolveStudentOfficialLaboratoryGroup/u);
  assert.match(sources.downloadRoute, /getAuthorizedStudentGroupSubmission/u);
  assert.match(sources.downloadRoute, /getLaboratorySubmissionObject/u);
  assert.match(sources.downloadRoute, /Cache-Control/u);
  assert.match(sources.downloadRoute, /Content-Disposition/u);
  assert.match(sources.downloadRoute, /X-Content-Type-Options/u);
  assert.doesNotMatch(sources.downloadRoute, /Response\.json\([^)]*r2Key/u);
});

test("student portal only exposes the authenticated student's group submission", () => {
  assert.match(sources.portal, /LEFT JOIN laboratory_group_submissions lgsub/u);
  assert.match(sources.portal, /lgsub\.group_id = sgs\.group_id/u);
  assert.match(sources.portal, /group_submission:/u);
  assert.doesNotMatch(sources.portal, /getLaboratoryGroupSubmissions/u);
});

test("component uses confirmation modal for replacements and no raw storage keys", () => {
  assert.match(sources.component, /ConfirmationModal/u);
  assert.match(sources.component, /Replace group submission\?/u);
  assert.match(sources.component, /expectedSubmissionId/u);
  assert.match(sources.component, /expectedUpdatedAt/u);
  assert.doesNotMatch(sources.component, /r2Key/u);
});

test("student group laboratory heading renders the authenticated student's final score", () => {
  assert.match(sources.studentPage, /function StudentScoreBadge/u);
  assert.match(sources.studentPage, /Your Score:/u);
  assert.match(sources.studentPage, /Not scored/u);
  assert.match(sources.studentPage, /getStudentLaboratoryScore\(laboratory\)/u);
  assert.match(sources.studentPage, /score=\{score\}/u);
  assert.match(sources.studentPage, /possible=\{Number\(laboratory\.total_points\)\}/u);
  assert.match(
    sources.studentPage,
    /<h4[\s\S]*\{laboratory\.group_name\}[\s\S]*<StudentScoreBadge/u
  );
  assert.doesNotMatch(sources.studentPage, /label="Final Score"/u);
  assert.doesNotMatch(sources.studentPage, /label="Individual Contribution"/u);
});

test("student group laboratory payload does not include member score data", () => {
  const groupMemberType = sources.portal.match(/group_members: Array<\{[\s\S]*?\}>;/u)?.[0] ?? "";

  assert.match(sources.portal, /LEFT JOIN laboratory_scores ls[\s\S]*AND ls\.student_id = \?1/u);
  assert.match(sources.portal, /members\.push\(\{ student_id: Number\(member\.student_id\), name: member\.name \}\)/u);
  assert.match(groupMemberType, /student_id: number/u);
  assert.match(groupMemberType, /name: string/u);
  assert.doesNotMatch(sources.portal, /member_score|memberScore|member\.score/u);
  assert.doesNotMatch(groupMemberType, /score|individual_score|group_score/u);
  assert.doesNotMatch(sources.studentPage, /member\.score|individual_score\}.*member/u);
});

test("download headers include RFC 5987 filename support and nosniff route uses them", () => {
  assert.match(sources.headers, /filename\*=UTF-8''/u);
  assert.match(sources.headers, /inline/u);
  assert.match(sources.headers, /attachment/u);
});

test("instructor summaries include uploader names without exposing R2 keys", () => {
  assert.match(sources.db, /getLaboratoryGroupSubmissionSummaries/u);
  assert.match(sources.db, /LaboratoryGroupSubmissionSummary = Omit<[\s\S]*"r2Key"/u);
  assert.match(sources.db, /INNER JOIN students uploader/u);
  assert.match(sources.db, /uploaded_by_name/u);
  assert.match(
    sources.auth,
    /getAuthorizedInstructorLaboratorySubmissionSummaries/u
  );
  assert.match(sources.auth, /getInstructorManagedClass/u);
  assert.match(sources.auth, /lab_type = 'group'/u);
});

test("instructor group cards render read-only submission footers", () => {
  assert.match(sources.instructorPage, /requireUser/u);
  assert.match(
    sources.instructorPage,
    /getAuthorizedInstructorLaboratorySubmissionSummaries/u
  );
  assert.match(sources.instructorPage, /getLaboratorySubmissionTiming/u);
  assert.match(sources.groupSetup, /InstructorGroupSubmission/u);
  assert.match(sources.groupSetup, /getInstructorSubmissionStatusLabel/u);
  assert.match(sources.instructorComponent, /Group Submission/u);
  assert.match(sources.instructorComponent, /Not submitted yet/u);
  assert.match(sources.instructorComponent, /View \/ Download/u);
  assert.doesNotMatch(sources.instructorComponent, /Upload File|Replace File|Delete Submission/u);
  assert.doesNotMatch(sources.instructorComponent, /r2Key/u);
});

test("instructor download route verifies class, lab, group, and private R2 object", () => {
  assert.match(sources.instructorDownloadRoute, /await getCurrentUser\(\)/u);
  assert.match(sources.instructorDownloadRoute, /getInstructorManagedClass/u);
  assert.match(sources.instructorDownloadRoute, /lg\.laboratory_id = \?2/u);
  assert.match(sources.instructorDownloadRoute, /l\.class_id = \?3/u);
  assert.match(sources.instructorDownloadRoute, /l\.lab_type = 'group'/u);
  assert.match(sources.instructorDownloadRoute, /getGroupSubmission/u);
  assert.match(sources.instructorDownloadRoute, /getLaboratorySubmissionObject/u);
  assert.match(sources.instructorDownloadRoute, /Content-Disposition/u);
  assert.match(sources.instructorDownloadRoute, /X-Content-Type-Options/u);
  assert.doesNotMatch(
    sources.instructorDownloadRoute,
    /Response\.json\([^\n]*(r2Key|storageKey)/u
  );
});
