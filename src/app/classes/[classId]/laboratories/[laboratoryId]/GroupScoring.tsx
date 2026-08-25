import Link from "next/link";

type Student = {
  id: number;
  name: string;
  studentNumber?: string | null;
  active: boolean;
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

type StudentScore = {
  student_id: number;
  individual_score: number | null;
};

type GroupScoringProps = {
  classId: string;
  totalPoints: number;
  groupPoints: number;
  individualPoints: number;

  groups: Group[];
  memberships: Membership[];
  students: Student[];
  studentScores: StudentScore[];
};

export default function GroupScoring({
  classId,
  totalPoints,
  groupPoints,
  individualPoints,
  groups,
  memberships,
  students,
  studentScores,
}: GroupScoringProps) {
  const scoreMap = new Map(
    studentScores.map((score) => [
      score.student_id,
      score.individual_score,
    ])
  );

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <p className="text-sm text-slate-500">
          No groups have been created yet.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-6 py-5">
        <h2 className="text-lg font-semibold text-slate-900">
          Group Score Summary
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          {groupPoints} points group output +{" "}
          {individualPoints} points individual contribution.
        </p>
      </div>

      <div className="divide-y divide-slate-200">
        {groups.map((group) => {
          const groupMemberships = memberships.filter(
            (membership) =>
              membership.laboratory_group_id === group.id
          );

          const groupScore = group.group_score;

          const isGroupScored =
            groupScore !== null &&
            groupMemberships.length > 0 &&
            groupMemberships.every((membership) => {
              const score = scoreMap.get(
                membership.student_id
              );

              return score !== null && score !== undefined;
            });

          return (
            <div
              key={group.id}
              className="px-6 py-6"
            >
              {/* Group Header */}
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">
                    {group.name}
                  </h3>

                  <p className="mt-1 text-xs text-slate-500">
                    {groupMemberships.length}{" "}
                    {groupMemberships.length === 1
                      ? "member"
                      : "members"}
                  </p>
                </div>

                {isGroupScored ? (
                  <div className="text-sm">
                    <span className="text-slate-500">
                      Group Output:
                    </span>{" "}
                    <span className="font-semibold text-slate-900">
                      {groupScore} / {groupPoints}
                    </span>
                  </div>
                ) : (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                    Not yet scored
                  </span>
                )}
              </div>

              {/* Score Table */}
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-3">
                          Student
                        </th>

                        <th className="px-4 py-3 text-right">
                          Group
                        </th>

                        <th className="px-4 py-3 text-right">
                          Contribution
                        </th>

                        <th className="px-4 py-3 text-right">
                          Final
                        </th>

                        <th className="px-4 py-3 text-right">
                          %
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {groupMemberships.map(
                        (membership) => {
                          const student = students.find(
                            (student) =>
                              student.id ===
                              membership.student_id
                          );

                          if (!student) {
                            return null;
                          }

                          const individualScore =
                            scoreMap.get(student.id);

                          const hasScore =
                            groupScore !== null &&
                            individualScore !== null &&
                            individualScore !== undefined;

                          const finalScore = hasScore
                            ? Number(groupScore) +
                              Number(individualScore)
                            : null;

                          const percentage =
                            finalScore !== null &&
                            totalPoints > 0
                              ? (finalScore /
                                  totalPoints) *
                                100
                              : null;

                          return (
                            <tr
                              key={membership.id}
                              className="text-slate-700"
                            >
                              <td className="px-4 py-3">
                                <Link
                                  href={`/classes/${classId}/students/${student.id}`}
                                  className="font-medium text-slate-900 transition hover:text-slate-600"
                                >
                                  {student.name}
                                </Link>
                                {!student.active && (
                                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                                    Archived
                                  </span>
                                )}

                                {student.studentNumber && (
                                  <div className="mt-0.5 text-xs text-slate-400">
                                    {
                                      student.studentNumber
                                    }
                                  </div>
                                )}
                              </td>

                              <td className="px-4 py-3 text-right">
                                {groupScore !== null ? (
                                  <>
                                    {groupScore} /{" "}
                                    {groupPoints}
                                  </>
                                ) : (
                                  <span className="text-slate-300">
                                    —
                                  </span>
                                )}
                              </td>

                              <td className="px-4 py-3 text-right">
                                {individualScore !==
                                  null &&
                                individualScore !==
                                  undefined ? (
                                  <>
                                    {individualScore} /{" "}
                                    {individualPoints}
                                  </>
                                ) : (
                                  <span className="text-slate-300">
                                    —
                                  </span>
                                )}
                              </td>

                              <td className="px-4 py-3 text-right font-semibold text-slate-900">
                                {finalScore !== null ? (
                                  <>
                                    {finalScore} /{" "}
                                    {totalPoints}
                                  </>
                                ) : (
                                  <span className="font-normal text-slate-300">
                                    —
                                  </span>
                                )}
                              </td>

                              <td className="px-4 py-3 text-right">
                                {percentage !== null ? (
                                  `${percentage.toFixed(1)}%`
                                ) : (
                                  <span className="text-slate-300">
                                    —
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
