"use client";

import {
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import Link from "next/link";

import type {
  QuizRosterItem,
} from "@/lib/db/quizzes";

type Props = {
  classId: number;
  quizId: number;
  maxScore: number;
  initialRoster: QuizRosterItem[];
};

type SaveScoresResponse = {
  ok?: boolean;
  message?: string;
};

export default function QuizScoreSheet({
  classId,
  quizId,
  maxScore,
  initialRoster,
}: Props) {
  const router =
    useRouter();

  const hasExistingScores =
    initialRoster.some(
      (item) =>
        item.status !==
        "NOT_RECORDED"
    );

  const [
    roster,
    setRoster,
  ] = useState(
    initialRoster
  );

  const [
    savedRoster,
    setSavedRoster,
  ] = useState(
    initialRoster
  );

  const [
    isEditing,
    setIsEditing,
  ] = useState(
    !hasExistingScores
  );

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState("");

  const inputRefs =
    useRef<
      Array<HTMLInputElement | null>
    >([]);

  const quizSummary =
    useMemo(() => {
        const scoredItems =
        roster.filter(
            (item) =>
            item.status === "SCORED" &&
            item.score !== null
        );

        const scores =
        scoredItems.map(
            (item) =>
            item.score as number
        );

        const scoredCount =
        scoredItems.length;

        const absentCount =
        roster.filter(
            (item) =>
            item.status === "ABSENT"
        ).length;

        const excusedCount =
        roster.filter(
            (item) =>
            item.status === "EXCUSED"
        ).length;

        const notRecordedCount =
        roster.filter(
            (item) =>
            item.status ===
            "NOT_RECORDED"
        ).length;

        const average =
        scores.length > 0
            ? scores.reduce(
                (total, score) =>
                total + score,
                0
            ) / scores.length
            : null;

        const highest =
        scores.length > 0
            ? Math.max(...scores)
            : null;

        const lowest =
        scores.length > 0
            ? Math.min(...scores)
            : null;

        return {
        scoredCount,
        absentCount,
        excusedCount,
        notRecordedCount,
        average,
        highest,
        lowest,
        };
    }, [roster]);

  // =========================================================
  // HELPERS
  // =========================================================

  function getStudentName(
    item: QuizRosterItem
  ) {
    const middleInitial =
      item.middle_name
        ? `${item.middle_name.charAt(
            0
          )}.`
        : "";

    return [
      `${item.last_name},`,
      item.first_name,
      middleInitial,
      item.suffix,
    ]
      .filter(Boolean)
      .join(" ");
  }

  function getPercentage(
    score: number | null
  ) {
    if (
      score === null ||
      maxScore <= 0
    ) {
      return null;
    }

    return (
      (score / maxScore) *
      100
    );
  }

  // =========================================================
  // EDITING
  // =========================================================

  function updateScore(
    index: number,
    value: string
  ) {
    setMessage("");

    setRoster(
      (current) =>
        current.map(
          (
            item,
            itemIndex
          ) => {
            if (
              itemIndex !==
              index
            ) {
              return item;
            }

            if (
              value === ""
            ) {
              return {
                ...item,

                score: null,

                status:
                  "NOT_RECORDED",
              };
            }

            const score =
              Number(value);

            return {
              ...item,

              score,

              status:
                "SCORED",
            };
          }
        )
    );
  }

  function changeStatus(
    index: number,
    status:
      | "ABSENT"
      | "EXCUSED"
      | "NOT_RECORDED"
  ) {
    setMessage("");

    setRoster(
      (current) =>
        current.map(
          (
            item,
            itemIndex
          ) =>
            itemIndex ===
            index
              ? {
                  ...item,

                  score:
                    null,

                  status,
                }
              : item
        )
    );
  }

  // =========================================================
  // SAVE
  // =========================================================

  async function saveScores() {
    setSaving(true);
    setMessage("");

    try {
      const response =
        await fetch(
          `/api/classes/${classId}/quizzes/${quizId}/scores`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                scores:
                  roster
                  .filter(
                    (item) => item.enrollment_status === "ACTIVE"
                  )
                  .map(
                    (item) => ({
                      enrollmentId:
                        item.enrollment_id,

                      score:
                        item.score,

                      status:
                        item.status,
                    })
                  ),
              }),
          }
        );

      const data =
        (await response.json()) as SaveScoresResponse;

      if (!response.ok) {
        setMessage(
          data.message ??
            "Could not save scores."
        );

        return;
      }

      // Keep a copy of the successfully
      // saved state for Cancel/Edit.
      setSavedRoster(
        roster.map(
          (item) => ({
            ...item,
          })
        )
      );

      setMessage(
        data.message ??
          "Scores saved successfully."
      );

      // Switch immediately to
      // read-only results mode.
      setIsEditing(false);

      // Refresh server-rendered
      // quiz statistics.
      router.refresh();
    } catch (
      error
    ) {
      console.error(
        "Quiz save request failed:",
        error
      );

      setMessage(
        "Could not save scores."
      );
    } finally {
      setSaving(false);
    }
  }

  function startEditing() {
    setMessage("");
    setIsEditing(true);
  }

  function cancelEditing() {
    setRoster(
      savedRoster.map(
        (item) => ({
          ...item,
        })
      )
    );

    setMessage("");
    setIsEditing(false);
  }

  // =========================================================
  // VIEW MODE
  // =========================================================

  if (!isEditing) {
    const averagePercentage =
        quizSummary.average !== null &&
        maxScore > 0
        ? (quizSummary.average / maxScore) * 100
        : null;

    const completionPercentage =
        roster.length > 0
        ? ((roster.length -
            quizSummary.notRecordedCount) /
            roster.length) *
            100
        : 0;

    return (
        <div className="space-y-6">

        {/* =====================================================
            QUIZ SUMMARY
        ===================================================== */}

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

            {/* HEADER */}

            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">

                <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                    Quiz Summary
                    </h3>

                    <p className="mt-1 text-sm text-gray-500">
                    Final recorded scores for this quiz.
                    </p>
                </div>

                <div className="text-right">
                    <p className="text-3xl font-bold text-gray-900">
                        {averagePercentage !== null
                        ? `${averagePercentage.toFixed(1)}%`
                        : "—"}
                    </p>

                    <p className="text-xs text-gray-500">
                        Class Average
                    </p>
                </div>
            </div>


            {/* SUMMARY CARDS */}

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

            {/* TOTAL STUDENTS */}

            <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs font-medium text-gray-500">
                Total Students
                </p>

                <p className="mt-1 text-2xl font-bold text-gray-900">
                {roster.length}
                </p>
            </div>


            {/* SCORED */}

            <div className="rounded-lg bg-green-50 p-4">
                <p className="text-xs font-medium text-green-700">
                Scored
                </p>

                <p className="mt-1 text-2xl font-bold text-green-800">
                {quizSummary.scoredCount}
                </p>
            </div>


            {/* AVERAGE */}

            <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs font-medium text-gray-500">
                Average
                </p>

                <p className="mt-1 text-2xl font-bold text-gray-900">
                {quizSummary.average !== null
                    ? quizSummary.average.toFixed(2)
                    : "—"}
                </p>
            </div>


            {/* HIGHEST */}

            <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs font-medium text-gray-500">
                Highest
                </p>

                <p className="mt-1 text-2xl font-bold text-gray-900">
                {quizSummary.highest !== null
                    ? `${quizSummary.highest} / ${maxScore}`
                    : "—"}
                </p>
            </div>


            {/* LOWEST */}

            <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs font-medium text-gray-500">
                Lowest
                </p>

                <p className="mt-1 text-2xl font-bold text-gray-900">
                {quizSummary.lowest !== null
                    ? `${quizSummary.lowest} / ${maxScore}`
                    : "—"}
                </p>
            </div>


            {/* ABSENT */}

            <div className="rounded-lg bg-red-50 p-4">
                <p className="text-xs font-medium text-red-700">
                Absent
                </p>

                <p className="mt-1 text-2xl font-bold text-red-800">
                {quizSummary.absentCount}
                </p>
            </div>


            {/* EXCUSED */}

            <div className="rounded-lg bg-blue-50 p-4">
                <p className="text-xs font-medium text-blue-700">
                Excused
                </p>

                <p className="mt-1 text-2xl font-bold text-blue-800">
                {quizSummary.excusedCount}
                </p>
            </div>


            {/* NOT RECORDED */}

            <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs font-medium text-gray-500">
                Not Recorded
                </p>

                <p className="mt-1 text-2xl font-bold text-gray-900">
                {quizSummary.notRecordedCount}
                </p>
            </div>

            </div>
        </div>


        {/* =====================================================
            SCORE DETAILS
        ===================================================== */}

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

            <h3 className="font-semibold text-gray-900">
            Score Details
            </h3>

            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

            {/* MAX SCORE */}

            <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Maximum Score
                </p>

                <p className="mt-1 text-sm font-medium text-gray-900">
                {maxScore}
                </p>
            </div>


            {/* RECORDED */}

            <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Recorded Scores
                </p>

                <p className="mt-1 text-sm font-medium text-gray-900">
                {quizSummary.scoredCount}
                {" / "}
                {roster.length}
                </p>
            </div>


            {/* COMPLETION */}

            <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Completion
                </p>

                <p className="mt-1 text-sm font-medium text-gray-900">
                {completionPercentage.toFixed(0)}%
                </p>
            </div>


            {/* CLASS AVERAGE */}

            <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Class Average
                </p>

                <p className="mt-1 text-sm font-medium text-gray-900">
                {quizSummary.average !== null
                    ? `${quizSummary.average.toFixed(2)} / ${maxScore}`
                    : "—"}
                </p>
            </div>

            </div>
        </div>


        {/* =====================================================
            STUDENT SCORES
        ===================================================== */}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

            {/* TABLE HEADER */}

            <div className="flex flex-col justify-between gap-4 border-b border-gray-100 px-6 py-5 sm:flex-row sm:items-center">

                <div>
                    <h3 className="font-semibold text-gray-900">
                    Student Scores
                    </h3>

                    <p className="mt-1 text-sm text-gray-500">
                    Final quiz score for each student.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={startEditing}
                    className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                    Edit Scores
                </button>

            </div>


            {/* TABLE */}

            <div className="overflow-x-auto">

            <table className="min-w-full divide-y divide-gray-200">

                <thead className="bg-gray-50">
                <tr>

                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Student
                    </th>

                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Score
                    </th>

                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Percentage
                    </th>

                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Status
                    </th>

                </tr>
                </thead>


                <tbody className="divide-y divide-gray-100">

                {roster.map(
                    (item) => {
                    const percentage =
                        getPercentage(
                        item.score
                        );

                    return (
                        <tr
                        key={
                            item.enrollment_id
                        }
                        >

                        {/* STUDENT */}

                        <td className="px-6 py-4">

                            <Link
                              href={`/classes/${classId}/students/${item.student_id}`}
                              className="text-sm font-medium text-gray-900 transition hover:text-gray-600"
                            >
                            {getStudentName(
                                item
                            )}
                            </Link>
                            {item.enrollment_status !== "ACTIVE" && (
                              <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                                Archived
                              </span>
                            )}

                            <p className="mt-0.5 text-xs text-gray-500">
                            {
                                item.student_number
                            }
                            </p>

                        </td>


                        {/* SCORE */}

                        <td className="whitespace-nowrap px-6 py-4">

                            {item.status ===
                            "SCORED" ? (
                            <span className="text-sm font-semibold text-gray-900">
                                {item.score}
                                {" / "}
                                {maxScore}
                            </span>
                            ) : (
                            <span className="text-sm text-gray-400">
                                —
                            </span>
                            )}

                        </td>


                        {/* PERCENTAGE */}

                        <td className="whitespace-nowrap px-6 py-4">

                            {percentage !==
                            null ? (
                            <span className="text-sm text-gray-600">
                                {percentage.toFixed(
                                1
                                )}
                                %
                            </span>
                            ) : (
                            <span className="text-sm text-gray-400">
                                —
                            </span>
                            )}

                        </td>


                        {/* STATUS */}

                        <td className="whitespace-nowrap px-6 py-4">

                            {item.status ===
                            "SCORED" && (
                            <span className="inline-block rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                                SCORED
                            </span>
                            )}

                            {item.status ===
                            "ABSENT" && (
                            <span className="inline-block rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                                ABSENT
                            </span>
                            )}

                            {item.status ===
                            "EXCUSED" && (
                            <span className="inline-block rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                                EXCUSED
                            </span>
                            )}

                            {item.status ===
                            "NOT_RECORDED" && (
                            <span className="inline-block rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
                                NOT RECORDED
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


        {/* SAVE MESSAGE */}

        {message && (
            <p className="text-sm text-green-700">
            {message}
            </p>
        )}

        </div>
    );
  }

  // =========================================================
  // EDIT MODE
  // =========================================================

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

        {/* HEADER */}

        <div className="border-b border-gray-100 px-5 py-4">
          <p className="text-sm text-gray-500">
            Maximum Score
          </p>

          <p className="text-xl font-bold text-gray-900">
            {maxScore}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            Enter a score or mark a student absent or excused.
          </p>
        </div>

        {/* SCORE ENCODING */}

        <div className="divide-y divide-gray-100">

          {roster.map(
            (
              item,
              index
            ) => (
              <div
                key={
                  item.enrollment_id
                }
                className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_150px_220px] md:items-center"
              >

                {/* STUDENT */}

                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {getStudentName(
                      item
                    )}
                  </p>
                  {item.enrollment_status !== "ACTIVE" && (
                    <span className="mt-1 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                      Archived
                    </span>
                  )}

                  <p className="mt-0.5 text-xs text-gray-500">
                    {
                      item.student_number
                    }
                  </p>
                </div>

                {/* SCORE */}

                <div>
                  <input
                    ref={(
                      element
                    ) => {
                      inputRefs.current[
                        index
                      ] =
                        element;
                    }}
                    type="number"
                    min="0"
                    max={
                      maxScore
                    }
                    step="0.01"
                    value={
                      item.status ===
                      "SCORED"
                        ? item.score ??
                          ""
                        : ""
                    }
                    disabled={
                      item.enrollment_status !== "ACTIVE" ||
                      item.status ===
                        "ABSENT" ||
                      item.status ===
                        "EXCUSED"
                    }
                    onChange={(
                      event
                    ) =>
                      updateScore(
                        index,
                        event.target
                          .value
                      )
                    }
                    onKeyDown={(
                      event
                    ) => {
                      if (
                        event.key ===
                        "Enter"
                      ) {
                        event.preventDefault();

                        inputRefs
                          .current[
                          index + 1
                        ]
                          ?.focus();
                      }
                    }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 disabled:bg-gray-100"
                    placeholder={
                      `0 - ${maxScore}`
                    }
                  />
                </div>

                {/* ACTIONS */}

                {item.enrollment_status === "ACTIVE" ? (
                <div className="flex flex-wrap gap-2">

                  <button
                    type="button"
                    onClick={() =>
                      changeStatus(
                        index,
                        "ABSENT"
                      )
                    }
                    className={
                      item.status ===
                      "ABSENT"
                        ? "rounded-md bg-red-100 px-2.5 py-1.5 text-xs font-medium text-red-700"
                        : "rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    }
                  >
                    Absent
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      changeStatus(
                        index,
                        "EXCUSED"
                      )
                    }
                    className={
                      item.status ===
                      "EXCUSED"
                        ? "rounded-md bg-blue-100 px-2.5 py-1.5 text-xs font-medium text-blue-700"
                        : "rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    }
                  >
                    Excused
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      changeStatus(
                        index,
                        "NOT_RECORDED"
                      )
                    }
                    className="rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Clear
                  </button>

                </div>
                ) : (
                  <p className="text-xs font-medium text-gray-500">
                    Historical score retained
                  </p>
                )}
              </div>
            )
          )}

        </div>
      </div>

      {/* FOOTER */}

      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">

        <p className="text-sm text-gray-600">
          {message}
        </p>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

          {hasExistingScores && (
            <button
              type="button"
              disabled={
                saving
              }
              onClick={
                cancelEditing
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 sm:w-auto"
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            disabled={
              saving
            }
            onClick={
              saveScores
            }
            className="w-full rounded-lg bg-blue-600 shadow-sm px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
          >
            {saving
              ? "Saving..."
              : "Save Scores"}
          </button>

        </div>
      </div>
    </div>
  );
}
