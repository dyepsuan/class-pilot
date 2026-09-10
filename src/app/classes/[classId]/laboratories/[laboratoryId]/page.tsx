import EditLaboratoryModal from "./EditLaboratoryModal";
import ReopenLaboratoryButton from "./ReopenLaboratoryButton";
import CompleteLaboratoryButton from "./CompleteLaboratoryButton";
import IndividualScoring from "./IndividualScoring";
import CollapsibleGroupScores from "./CollapsibleGroupScores";
import GroupScoring from "./GroupScoring";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireUser } from "@/lib/auth/session";
import { getInstructorManagedClass } from "@/lib/auth/instructor-class";
import { getAuthorizedInstructorLaboratorySubmissionSummaries } from "@/lib/auth/laboratory-submissions";
import { getLaboratoryGroupingLifecycleState } from "@/lib/db/laboratory-grouping";
import { getLaboratorySubmissionTiming } from "@/lib/laboratory-submissions/deadline";

import GroupSetup from "./GroupSetup";
import GroupLockControls from "./GroupLockControls";

type PageProps = {
  params: Promise<{
    classId: string;
    laboratoryId: string;
  }>;
};

type Laboratory = {
  id: number;
  class_id: number;
  lab_no: number;
  title: string;
  description: string | null;
  lab_type: "individual" | "group";
  total_points: number;
  group_points: number;
  individual_points: number;
  start_date: string | null;
  due_date: string | null;
  status: "open" | "completed";
  groups_locked_at: string | null;
};

type LaboratoryGroup = {
  id: number;
  name: string;
  group_score: number | null;
};

type Membership = {
  id: number;
  laboratory_group_id: number;
  student_id: number;
};

type Student = {
  id: number;
  name: string;
  studentNumber?: string | null;
  active: boolean;
};

type StudentScore = {
  student_id: number;
  individual_score: number | null;
};

function formatDate(date: string | null) {
  if (!date) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(new Date(`${date}T00:00:00+08:00`));
}

export default async function LaboratoryDetailsPage({
  params,
}: PageProps) {
  const { classId, laboratoryId } = await params;

  const numericClassId = Number(classId);
  const numericLaboratoryId = Number(laboratoryId);

  const instructor = await requireUser();
  const managedClass = await getInstructorManagedClass(
    numericClassId,
    instructor
  );

  if (!managedClass) {
    notFound();
  }

  const { env } = getCloudflareContext();

  const laboratory = await env.DB.prepare(
    `
    SELECT
      id,
      class_id,
      lab_no,
      title,
      description,
      lab_type,
      total_points,
      group_points,
      individual_points,
      start_date,
      due_date,
      status,
      groups_locked_at

      FROM laboratories

      WHERE id = ?
        AND class_id = ?

      LIMIT 1
    `
  )
    .bind(numericLaboratoryId, numericClassId)
    .first<Laboratory>();

  if (!laboratory) {
    notFound();
  }

  const submissionSummaries = laboratory.lab_type === "group"
    ? await getAuthorizedInstructorLaboratorySubmissionSummaries(
        instructor,
        numericClassId,
        numericLaboratoryId
      )
    : [];

  if (laboratory.lab_type === "group" && submissionSummaries === null) {
    notFound();
  }

  const groupSubmissions = (submissionSummaries ?? []).map((submission) => ({
    groupId: submission.groupId,
    originalFilename: submission.originalFilename,
    fileSize: submission.fileSize,
    uploadedByName: submission.uploadedByName,
    submittedAt: submission.submittedAt,
    updatedAt: submission.updatedAt,
    timing: getLaboratorySubmissionTiming(
      submission.updatedAt,
      laboratory.due_date
    ),
  }));

  const groupResult = await env.DB.prepare(
    `
      SELECT
        id,
        name,
        group_score

      FROM laboratory_groups

      WHERE laboratory_id = ?

      ORDER BY id ASC
    `
  )
    .bind(numericLaboratoryId)
    .all<LaboratoryGroup>();

  const groups = groupResult.results ?? [];

  const membershipResult = await env.DB.prepare(
    `
      SELECT
        lgm.id,
        lgm.laboratory_group_id,
        lgm.student_id

      FROM laboratory_group_members lgm

      INNER JOIN laboratory_groups lg
        ON lg.id = lgm.laboratory_group_id

      WHERE lg.laboratory_id = ?

      ORDER BY lgm.id ASC
    `
  )
    .bind(numericLaboratoryId)
    .all<Membership>();

  const memberships = membershipResult.results ?? [];

    const studentScoreResult = await env.DB.prepare(
    `
        SELECT
        student_id,
        individual_score

        FROM laboratory_scores

        WHERE laboratory_id = ?
    `
    )
    .bind(numericLaboratoryId)
    .all<StudentScore>();

    const studentScores =
    studentScoreResult.results ?? [];
  

    const lifecycle = await getLaboratoryGroupingLifecycleState(
      env.DB,
      numericLaboratoryId
    );
    const hasScores = lifecycle.hasScores;
    const hasSubmissions = lifecycle.hasSubmissions;
    const groupingLocked =
      Boolean(laboratory.groups_locked_at) ||
      hasScores ||
      hasSubmissions;
    const groupMutationLocked = laboratory.status === "completed" || groupingLocked;
  /*
   * =====================================================
   * STUDENT ROSTER
   * =====================================================
   *
   * Use the SAME student query you're already using on
   * your working Quiz scoring page.
   *
   * The only requirement is to transform the result to:
   *
   * {
   *   id: number,
   *   name: string,
   *   studentNumber?: string | null
   * }
   *
   */

    const studentResult = await env.DB.prepare(
    `
        SELECT
        e.id AS enrollment_id,
        s.id AS student_id,
        s.student_number,
        s.first_name,
        s.middle_name,
        s.last_name,
        s.suffix,
        s.email,
        e.status AS enrollment_status

        FROM enrollments e

        INNER JOIN students s
        ON s.id = e.student_id

        WHERE e.class_id = ?1
        AND (
          e.status = 'ACTIVE'
          OR EXISTS (
            SELECT 1
            FROM laboratory_scores historical_score
            WHERE historical_score.laboratory_id = ?2
              AND historical_score.student_id = s.id
          )
          OR EXISTS (
            SELECT 1
            FROM laboratory_group_members historical_membership
            INNER JOIN laboratory_groups historical_group
              ON historical_group.id = historical_membership.laboratory_group_id
            WHERE historical_group.laboratory_id = ?2
              AND historical_membership.student_id = s.id
          )
        )

        ORDER BY
        s.last_name ASC,
        s.first_name ASC
    `
    )
    .bind(numericClassId, numericLaboratoryId)
    .all<{
        enrollment_id: number;
        student_id: number;
        student_number: string | null;
        first_name: string;
        middle_name: string | null;
        last_name: string;
        suffix: string | null;
        email: string | null;
        enrollment_status: string;
    }>();


    const students: Student[] = (studentResult.results ?? []).map(
    (student) => {
        const fullName = [
        student.last_name + ",",
        student.first_name,
        student.middle_name,
        student.suffix,
        ]
        .filter(Boolean)
        .join(" ");

        return {
        id: student.student_id,
        name: fullName,
        studentNumber: student.student_number,
        active: student.enrollment_status === "ACTIVE",
        };
    }
    );

    const activeStudents = students.filter(
      (student) => student.active
    );

  /*
   * DELETE the line above once you paste your existing
   * quiz student query here.
   *
   * Example of the final mapping:
   *
   * const students: Student[] = studentResult.results.map(
   *   (student) => ({
   *     id: student.id,
   *     name: `${student.last_name}, ${student.first_name}`,
   *     studentNumber: student.student_no,
   *   })
   * );
   */

  const studentScoreMap = new Map(
    studentScores.map((score) => [
      score.student_id,
      score.individual_score,
    ])
  );

  let canComplete = false;
  let incompleteMessage = "";

  if (laboratory.lab_type === "individual") {
    const ungradedStudents = activeStudents.filter(
      (student) => {
        const score = studentScoreMap.get(
          student.id
        );

        return (
          score === null ||
          score === undefined
        );
      }
    );

    canComplete =
      activeStudents.length > 0 &&
      ungradedStudents.length === 0;

    if (activeStudents.length === 0) {
      incompleteMessage =
        "There are no active students in this class.";
    } else if (ungradedStudents.length > 0) {
      incompleteMessage = `${ungradedStudents.length} ${
        ungradedStudents.length === 1
          ? "student still needs"
          : "students still need"
      } a score.`;
    }
  } else {
    const assignedStudentIds = new Set(
      memberships.map(
        (membership) =>
          membership.student_id
      )
    );

    const unassignedStudents = activeStudents.filter(
      (student) =>
        !assignedStudentIds.has(student.id)
    );

    const unscoredGroups = groups.filter(
      (group) =>
        group.group_score === null
    );

    const ungradedStudents = activeStudents.filter(
      (student) => {
        const score = studentScoreMap.get(
          student.id
        );

        return (
          score === null ||
          score === undefined
        );
      }
    );

    canComplete =
      activeStudents.length > 0 &&
      groups.length > 0 &&
      unassignedStudents.length === 0 &&
      unscoredGroups.length === 0 &&
      ungradedStudents.length === 0;

    if (groups.length === 0) {
      incompleteMessage =
        "Create your groups first.";
    } else if (unassignedStudents.length > 0) {
      incompleteMessage = `${unassignedStudents.length} ${
        unassignedStudents.length === 1
          ? "student is"
          : "students are"
      } still unassigned.`;
    } else if (unscoredGroups.length > 0) {
      incompleteMessage = `${unscoredGroups.length} ${
        unscoredGroups.length === 1
          ? "group still needs"
          : "groups still need"
      } scoring.`;
    } else if (ungradedStudents.length > 0) {
      incompleteMessage = `${ungradedStudents.length} ${
        ungradedStudents.length === 1
          ? "student still needs"
          : "students still need"
      } an individual contribution score.`;
    }
  }

  
  return (
    <div>
      {/* Back */}
      <Link
        href={`/classes/${classId}/laboratories`}
        className="text-sm text-slate-500 transition hover:text-slate-900"
      >
        ← Laboratories
      </Link>

      {/* Header */}
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {/* Left side */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-500">
              Laboratory {laboratory.lab_no}
            </span>

            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-600">
              {laboratory.lab_type}
            </span>

            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                laboratory.status === "completed"
                  ? "bg-green-100 text-green-700"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {laboratory.status === "completed"
                ? "Completed"
                : "Open"}
            </span>
          </div>

          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            {laboratory.title}
          </h1>

          {laboratory.description && (
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              {laboratory.description}
            </p>
          )}
        </div>

        {/* Right side */}
        <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto sm:flex-row sm:items-start sm:pt-1">
          <EditLaboratoryModal
            classId={classId}
            laboratoryId={laboratoryId}
            laboratory={{
              labNo: laboratory.lab_no,
              title: laboratory.title,
              description: laboratory.description,
              labType: laboratory.lab_type,
              totalPoints: laboratory.total_points,
              groupPoints: laboratory.group_points,
              individualPoints: laboratory.individual_points,
              startDate: laboratory.start_date,
              dueDate: laboratory.due_date,
            }}
            scoringLocked={groupMutationLocked}
          />

          <div className="w-full sm:w-auto">
            {laboratory.status === "open" ? (
              <CompleteLaboratoryButton
                classId={classId}
                laboratoryId={laboratoryId}
                canComplete={canComplete}
                incompleteMessage={incompleteMessage}
              />
            ) : (
              <ReopenLaboratoryButton
                classId={classId}
                laboratoryId={laboratoryId}
              />
            )}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Points */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-sm text-slate-500">
            Total Points
          </div>

          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {laboratory.total_points}
          </div>
        </div>

        {/* Scoring */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-sm text-slate-500">
            Scoring
          </div>

          {laboratory.lab_type === "group" ? (
            <div className="mt-2">
              <div className="text-base font-semibold text-slate-900">
                {laboratory.group_points} Group
                <span className="mx-1.5 text-slate-300">+</span>
                {laboratory.individual_points} Individual
              </div>
            </div>
          ) : (
            <div className="mt-2 text-lg font-semibold text-slate-900">
              Individual
            </div>
          )}
        </div>

        {/* Start Date */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-sm text-slate-500">
            Start Date
          </div>

          <div className="mt-2 text-base font-semibold text-slate-900">
            {formatDate(laboratory.start_date)}
          </div>
        </div>

        {/* Due Date */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-sm text-slate-500">
            Due Date
          </div>

          <div className="mt-2 text-base font-semibold text-slate-900">
            {formatDate(laboratory.due_date)}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mt-8">
            {laboratory.lab_type === "group" ? (
            <div className="space-y-8">
                <GroupLockControls
                classId={classId}
                laboratoryId={laboratoryId}
                locked={groupingLocked}
                hasScores={hasScores}
                hasSubmissions={hasSubmissions}
                hasGroups={groups.length > 0}
                />

                <GroupSetup
                classId={classId}
                laboratoryId={laboratoryId}
                groups={groups}
                memberships={memberships}
                students={students}
                submissions={groupSubmissions}
                studentScores={studentScores}
                totalPoints={laboratory.total_points}
                groupPoints={laboratory.group_points}
                individualPoints={laboratory.individual_points}
                locked={groupMutationLocked}
                scoringEnabled={groupingLocked}
                readOnly={laboratory.status === "completed"}
                />

                <CollapsibleGroupScores>
                    <GroupScoring
                        classId={classId}
                        totalPoints={laboratory.total_points}
                        groupPoints={laboratory.group_points}
                        individualPoints={laboratory.individual_points}
                        groups={groups}
                        memberships={memberships}
                        students={students}
                        studentScores={studentScores}
                    />
                </CollapsibleGroupScores>
            </div>

  // individual laboratory...
            ) : (
              <IndividualScoring
                classId={classId}
                laboratoryId={laboratoryId}
                totalPoints={laboratory.total_points}
                students={students}
                studentScores={studentScores}
                readOnly={laboratory.status === "completed"}
              />
            )}
      </div>
    </div>
  );
}
