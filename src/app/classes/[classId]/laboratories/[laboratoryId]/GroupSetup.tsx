import GroupScoreModal from "./GroupScoreModal";
import RandomGrouping from "./RandomGrouping";
import InstructorGroupSubmission, {
  getInstructorSubmissionStatusLabel,
  type InstructorGroupSubmissionView,
} from "./InstructorGroupSubmission";

import {
  addStudentToGroup,
  createLaboratoryGroup,
  deleteLaboratoryGroup,
  removeStudentFromGroup,
} from "./actions";

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

type Group = {
  id: number;
  name: string;
  group_score: number | null;
};

type Membership = {
  id: number;
  laboratory_group_id: number;
  student_id: number;
};

type GroupSetupProps = {
  classId: string;
  laboratoryId: string;

  groups: Group[];
  memberships: Membership[];
  students: Student[];
  submissions: InstructorGroupSubmissionView[];

  studentScores: StudentScore[];

  totalPoints: number;
  groupPoints: number;
  individualPoints: number;

  locked: boolean;
  scoringEnabled: boolean;
  readOnly: boolean;
};

const inputClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-500";

export default function GroupSetup({
  classId,
  laboratoryId,
  groups,
  memberships,
  students,
  submissions,
  studentScores,
  totalPoints,
  groupPoints,
  individualPoints,
  locked,
  scoringEnabled,
  readOnly,
}: GroupSetupProps) {
  const assignedStudentIds = new Set(
    memberships.map((membership) => membership.student_id)
  );

  const activeStudents = students.filter((student) => student.active);
  const unassignedStudents = activeStudents.filter(
    (student) => !assignedStudentIds.has(student.id)
  );
  const activeAssignedCount = activeStudents.filter((student) =>
    assignedStudentIds.has(student.id)
  ).length;
  const submissionsByGroup = new Map(
    submissions.map((submission) => [submission.groupId, submission])
  );

  const createGroupAction = createLaboratoryGroup.bind(
    null,
    classId,
    laboratoryId
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Groups
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Create groups and assign students to each group.
          </p>
        </div>
        {locked && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-sm font-medium text-slate-800">
              Group assignments are locked
            </div>

            <p className="mt-1 text-sm text-slate-500">
              These groups are read-only. Unlocking is available only
              before scoring begins and while the laboratory is open.
            </p>
          </div>
        )}
        {!locked && (
          <form
            action={createGroupAction}
            className="flex items-center gap-2"
          >
            <input
              name="name"
              type="text"
              placeholder={`Group ${groups.length + 1}`}
              required
              className={inputClass}
            />

            <button
              type="submit"
              className="rounded-lg bg-blue-600 shadow-sm px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              + Add Group
            </button>
          </form>
        )}
      </div>

      {/* Progress */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">
            Groups
          </div>

          <div className="mt-1 text-xl font-semibold text-slate-900">
            {groups.length}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">
            Assigned
          </div>

          <div className="mt-1 text-xl font-semibold text-slate-900">
            {activeAssignedCount}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">
            Unassigned
          </div>

          <div className="mt-1 text-xl font-semibold text-slate-900">
            {unassignedStudents.length}
          </div>
        </div>
      </div>
        {!locked && (
          <RandomGrouping
            classId={classId}
            laboratoryId={laboratoryId}
            studentCount={activeStudents.length}
            existingGroupCount={groups.length}
            assignedCount={activeAssignedCount}
          />
        )}


      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <h3 className="font-medium text-slate-900">
            No groups yet
          </h3>

          <p className="mt-2 text-sm text-slate-500">
            Add your first group to start assigning students.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((group) => {
            const groupMemberships = memberships.filter(
              (membership) =>
                membership.laboratory_group_id === group.id
            );

            const groupMembers = groupMemberships
            .map((membership) =>
                students.find(
                (student) =>
                    student.id === membership.student_id
                )
            )
            .filter(
                (student): student is Student =>
                Boolean(student)
            );

            const addStudentAction = addStudentToGroup.bind(
              null,
              classId,
              laboratoryId,
              String(group.id)
            );

            const deleteGroupAction =
              deleteLaboratoryGroup.bind(
                null,
                classId,
                laboratoryId,
                String(group.id)
              );
            const submission = submissionsByGroup.get(group.id) ?? null;

            return (
              <div
                key={group.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white"
              >
                {/* Group header */}
              <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
                {/* Left */}
                <div>
                  <h3 className="font-semibold text-slate-900">
                    {group.name}
                  </h3>

                  <p className="mt-0.5 text-xs text-slate-500">
                    {groupMemberships.length}{" "}
                    {groupMemberships.length === 1
                      ? "member"
                      : "members"}
                    <span className="mx-1 text-slate-300">&bull;</span>
                    {getInstructorSubmissionStatusLabel(submission)}
                  </p>
                </div>

                {/* Right */}
                <div className="flex items-center gap-2">
                  <GroupScoreModal
                    classId={classId}
                    laboratoryId={laboratoryId}
                    groupId={group.id}
                    groupName={group.name}
                    savedGroupScore={group.group_score}
                    members={groupMembers}
                    studentScores={studentScores}
                    totalPoints={totalPoints}
                    groupPoints={groupPoints}
                    individualPoints={individualPoints}
                    disabled={!scoringEnabled}
                    readOnly={readOnly}
                  />

                  {!locked && (
                    <form action={deleteGroupAction}>
                      <button
                        type="submit"
                        className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </form>
                  )}
                </div>
              </div>

                {/* Members */}
                <div>
                  {groupMemberships.length === 0 ? (
                    <div className="px-5 py-6 text-center text-sm text-slate-400">
                      No students assigned yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {groupMemberships.map((membership) => {
                        const student = students.find(
                          (student) =>
                            student.id === membership.student_id
                        );

                        if (!student) {
                          return null;
                        }

                        const removeAction =
                          removeStudentFromGroup.bind(
                            null,
                            classId,
                            laboratoryId,
                            String(membership.id)
                          );

                        return (
                          <div
                            key={membership.id}
                            className="flex items-center justify-between gap-4 px-5 py-3"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-slate-900">
                                {student.name}
                              </div>

                              {student.studentNumber && (
                                <div className="mt-0.5 text-xs text-slate-400">
                                  {student.studentNumber}
                                </div>
                              )}
                            </div>

                            {!locked && student.active && (
                              <form action={removeAction}>
                                <button
                                  type="submit"
                                  className="text-xs font-medium text-slate-500 hover:text-red-600"
                                >
                                  Remove
                                </button>
                              </form>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <InstructorGroupSubmission
                  classId={classId}
                  laboratoryId={laboratoryId}
                  groupId={group.id}
                  submission={submission}
                />

                {/* Add student */}
                {!locked && unassignedStudents.length > 0 && (
                  <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
                      <form
                        action={addStudentAction}
                        className="flex gap-2"
                      >
                        <select
                          name="student_id"
                          required
                          defaultValue=""
                          className={`min-w-0 flex-1 ${inputClass}`}
                        >
                          <option value="" disabled>
                            Select student...
                          </option>

                          {unassignedStudents.map((student) => (
                            <option
                              key={student.id}
                              value={student.id}
                              className="text-slate-900"
                            >
                              {student.name}
                              {student.studentNumber
                                ? ` — ${student.studentNumber}`
                                : ""}
                            </option>
                          ))}
                        </select>

                        <button
                          type="submit"
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
                        >
                          Add
                        </button>
                      </form>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {unassignedStudents.length > 0 && groups.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm font-medium text-amber-800">
            {unassignedStudents.length}{" "}
            {unassignedStudents.length === 1
              ? "student is"
              : "students are"}{" "}
            still unassigned.
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {unassignedStudents.map((student) => (
              <span
                key={student.id}
                className="rounded-full bg-white px-2.5 py-1 text-xs text-amber-700"
              >
                {student.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
