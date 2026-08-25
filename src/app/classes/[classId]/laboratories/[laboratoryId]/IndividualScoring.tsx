"use client";

import {
  useActionState,
  useState,
} from "react";

import { useFormStatus } from "react-dom";
import Link from "next/link";

import {
  saveIndividualLaboratoryScores,
  type SaveIndividualScoresState,
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

type IndividualScoringProps = {
  classId: string;
  laboratoryId: string;

  totalPoints: number;

  students: Student[];
  studentScores: StudentScore[];

  readOnly: boolean;
};

const initialState: SaveIndividualScoresState = {};

const scoreInputClass =
  "w-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-right text-sm text-slate-900 outline-none transition focus:border-slate-500";

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-blue-600 shadow-sm px-5 py-2.5 text-sm font-medium text-white transition sm:w-auto hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending
        ? "Saving..."
        : "Save Scores"}
    </button>
  );
}

export default function IndividualScoring({
  classId,
  laboratoryId,
  totalPoints,
  students,
  studentScores,
  readOnly,
}: IndividualScoringProps) {
  const scoreMap = new Map(
    studentScores.map((score) => [
      score.student_id,
      score.individual_score,
    ])
  );
  const activeStudents = students.filter((student) => student.active);

  const scoresComplete =
    activeStudents.length > 0 &&
    activeStudents.every((student) => {
      const score = scoreMap.get(student.id);

      return (
        score !== null &&
        score !== undefined
      );
    });

  const [editing, setEditing] = useState(
    !readOnly && !scoresComplete
  );

  const saveAction =
    saveIndividualLaboratoryScores.bind(
      null,
      classId,
      laboratoryId
    );

  const [state, formAction] = useActionState(
    saveAction,
    initialState
  );

  if (students.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">
          Student Scores
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          There are no students with current or historical scores for this laboratory.
        </p>
      </div>
    );
  }

  const gradedCount = activeStudents.filter(
    (student) => {
      const score = scoreMap.get(student.id);

      return (
        score !== null &&
        score !== undefined
      );
    }
  ).length;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Student Scores
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Grade each student out of{" "}
            <span className="font-medium text-slate-700">
              {totalPoints} points
            </span>
            .
          </p>
        </div>

        <div className="flex items-center gap-3">
          {!editing && !readOnly && (
            <>
              <span className="text-sm text-slate-500">
                {gradedCount} / {activeStudents.length} graded
              </span>

              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Edit Scores
              </button>
            </>
          )}
        </div>
      </div>

      <form action={formAction}>
        {state.error && (
          <div className="mx-6 mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-6 py-3">
                  Student
                </th>

                <th className="px-6 py-3 text-right">
                  Score
                </th>

                <th className="px-6 py-3 text-right">
                  Percentage
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {students.map((student) => {
                const savedScore =
                  scoreMap.get(student.id);

                const hasScore =
                  savedScore !== null &&
                  savedScore !== undefined;

                const percentage =
                  hasScore && totalPoints > 0
                    ? (Number(savedScore) /
                        totalPoints) *
                      100
                    : null;

                return (
                  <tr
                    key={student.id}
                    className="text-slate-700"
                  >
                    {/* Student */}
                    <td className="px-6 py-4">
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
                          {student.studentNumber}
                        </div>
                      )}
                    </td>

                    {/* Score */}
                    <td className="px-6 py-4 text-right">
                      {editing && student.active ? (
                        <div className="flex items-center justify-end gap-2">
                          <input
                            name={`score_${student.id}`}
                            type="number"
                            min="0"
                            max={totalPoints}
                            step="0.01"
                            required
                            defaultValue={
                              savedScore ?? ""
                            }
                            className={
                              scoreInputClass
                            }
                          />

                          <span className="whitespace-nowrap text-slate-400">
                            / {totalPoints}
                          </span>
                        </div>
                      ) : hasScore ? (
                        <span className="font-medium text-slate-900">
                          {savedScore} /{" "}
                          {totalPoints}
                        </span>
                      ) : (
                        <span className="text-slate-300">
                          —
                        </span>
                      )}
                    </td>

                    {/* Percentage */}
                    <td className="px-6 py-4 text-right">
                      {!editing &&
                      percentage !== null ? (
                        <span className="font-medium text-slate-900">
                          {percentage.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-slate-300">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Editing actions */}
        {editing && (
          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
            {scoresComplete && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="w-full rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 sm:w-auto"
              >
                Cancel
              </button>
            )}

            <SaveButton />
          </div>
        )}
      </form>
    </div>
  );
}
