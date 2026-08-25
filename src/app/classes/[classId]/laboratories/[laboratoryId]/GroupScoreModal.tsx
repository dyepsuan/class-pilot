"use client";

import {
  useActionState,
  useMemo,
  useState,
} from "react";

import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import {
  saveSingleGroupScores,
  type SaveSingleGroupScoresState,
} from "./actions";

type Student = {
  id: number;
  name: string;
  studentNumber?: string | null;
};

type StudentScore = {
  student_id: number;
  individual_score: number | null;
};

type Props = {
  classId: string;
  laboratoryId: string;

  groupId: number;
  groupName: string;
  savedGroupScore: number | null;

  members: Student[];
  studentScores: StudentScore[];

  totalPoints: number;
  groupPoints: number;
  individualPoints: number;
  readOnly: boolean;
};

const initialState: SaveSingleGroupScoresState = {};

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

export default function GroupScoreModal({
  classId,
  laboratoryId,
  groupId,
  groupName,
  savedGroupScore,
  members,
  studentScores,
  totalPoints,
  groupPoints,
  individualPoints,
  readOnly,
}: Props) {
  const router = useRouter();

  const [open, setOpen] = useState(false);

  const savedScoreMap = useMemo(
    () =>
      new Map(
        studentScores.map((score) => [
          score.student_id,
          score.individual_score,
        ])
      ),
    [studentScores]
  );

  const isScored =
    savedGroupScore !== null &&
    members.length > 0 &&
    members.every(
      (member) =>
        savedScoreMap.get(member.id) !== null &&
        savedScoreMap.get(member.id) !== undefined
    );

  const [groupScore, setGroupScore] =
    useState(
      savedGroupScore !== null
        ? String(savedGroupScore)
        : ""
    );

  const [individualScores, setIndividualScores] =
    useState<Record<number, string>>(() => {
      const initial: Record<number, string> = {};

      members.forEach((member) => {
        const score =
          savedScoreMap.get(member.id);

        initial[member.id] =
          score !== null &&
          score !== undefined
            ? String(score)
            : "";
      });

      return initial;
    });

  const saveAction =
    saveSingleGroupScores.bind(
      null,
      classId,
      laboratoryId,
      String(groupId)
    );

  async function saveAndClose(
    previousState: SaveSingleGroupScoresState,
    formData: FormData
  ): Promise<SaveSingleGroupScoresState> {
    const result = await saveAction(
      previousState,
      formData
    );

    if (result.success) {
      setOpen(false);
      router.refresh();
    }

    return result;
  }

  const [state, formAction] =
    useActionState(
      saveAndClose,
      initialState
    );

  function resetFromSavedValues() {
    setGroupScore(
      savedGroupScore !== null
        ? String(savedGroupScore)
        : ""
    );

    const scores: Record<number, string> = {};

    members.forEach((member) => {
      const score =
        savedScoreMap.get(member.id);

      scores[member.id] =
        score !== null &&
        score !== undefined
          ? String(score)
          : "";
    });

    setIndividualScores(scores);
  }

  function closeModal() {
    resetFromSavedValues();
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        disabled={members.length === 0}
        onClick={() => setOpen(true)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {readOnly
          ? "View Score"
          : isScored
            ? "Edit Score"
            : "Score Group"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close modal"
            onClick={closeModal}
            className="absolute inset-0 bg-black/40"
          />

          {/* Modal */}
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Score {groupName}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {groupPoints} group points +{" "}
                  {individualPoints} individual
                  contribution points.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                aria-label="Close score modal"
                className="rounded-lg px-2 py-1 text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <form
              action={formAction}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="overflow-y-auto px-6 py-5">
                {state.error && (
                  <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {state.error}
                  </div>
                )}

                {/* Group score */}
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-medium text-slate-900">
                        Group Output
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        This score applies to every
                        member of {groupName}.
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        name="group_score"
                        type="number"
                        min="0"
                        max={groupPoints}
                        step="0.01"
                        required
                        value={groupScore}
                        disabled={readOnly}
                        onChange={(event) =>
                          setGroupScore(
                            event.target.value
                          )
                        }
                        className={scoreInputClass}
                      />

                      <span className="text-sm text-slate-500">
                        / {groupPoints}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Members */}
                <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Individual Contribution
                    </h3>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {members.map((member) => {
                      const contribution =
                        individualScores[
                          member.id
                        ] ?? "";

                      const numericGroup =
                        Number(groupScore);

                      const numericContribution =
                        Number(contribution);

                      const hasFinal =
                        groupScore !== "" &&
                        contribution !== "" &&
                        Number.isFinite(
                          numericGroup
                        ) &&
                        Number.isFinite(
                          numericContribution
                        );

                      const finalScore =
                        hasFinal
                          ? numericGroup +
                            numericContribution
                          : null;

                      const percentage =
                        finalScore !== null &&
                        totalPoints > 0
                          ? (finalScore /
                              totalPoints) *
                            100
                          : null;

                      return (
                        <div
                          key={member.id}
                          className="grid gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-slate-900">
                              {member.name}
                            </div>

                            {member.studentNumber && (
                              <div className="mt-0.5 text-xs text-slate-400">
                                {
                                  member.studentNumber
                                }
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              name={`individual_score_${member.id}`}
                              type="number"
                              min="0"
                              max={
                                individualPoints
                              }
                              step="0.01"
                              required
                              value={
                                contribution
                              }
                              onChange={(event) =>
                                setIndividualScores(
                                  (current) => ({
                                    ...current,
                                    [member.id]:
                                      event.target
                                        .value,
                                  })
                                )
                              }
                              className={
                                scoreInputClass
                              }
                              disabled={readOnly}
                            />

                            <span className="whitespace-nowrap text-sm text-slate-500">
                              /{" "}
                              {individualPoints}
                            </span>
                          </div>

                          <div className="min-w-24 text-right">
                            {finalScore !== null ? (
                              <>
                                <div className="text-sm font-semibold text-slate-900">
                                  {finalScore} /{" "}
                                  {totalPoints}
                                </div>

                                <div className="mt-0.5 text-xs text-slate-400">
                                  {percentage?.toFixed(
                                    1
                                  )}
                                  %
                                </div>
                              </>
                            ) : (
                              <span className="text-sm text-slate-300">
                                —
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
                <button
                  type="button"
                  onClick={closeModal}
                  className="w-full rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 sm:w-auto"
                >
                  {readOnly ? "Close" : "Cancel"}
                </button>

                {!readOnly && (
                  <SaveButton />
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
