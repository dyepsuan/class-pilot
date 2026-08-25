import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getQuizzes,
} from "@/lib/db/quizzes";

type Props = {
  params: Promise<{
    classId: string;
  }>;
};

export default async function QuizzesPage({
  params,
}: Props) {
  const { classId } =
    await params;

  const id =
    Number(classId);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    notFound();
  }

  const quizzes =
    await getQuizzes(id);

  function formatNumber(
    value: number | null
  ) {
    if (value === null) {
      return "—";
    }

    return Number(
      value.toFixed(2)
    );
  }

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Quizzes
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Create quizzes and record student scores.
          </p>
        </div>

        <Link
          href={
            `/classes/${id}/quizzes/new`
          }
          className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 shadow-sm px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 sm:w-auto"
        >
          + New Quiz
        </Link>
      </div>

      {quizzes.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center sm:p-12">
          <h3 className="font-semibold text-gray-900">
            No quizzes yet
          </h3>

          <p className="mt-2 text-sm text-gray-500">
            Create your first quiz to begin recording scores.
          </p>

          <Link
            href={`/classes/${id}/quizzes/new`}
            className="mt-5 inline-flex items-center justify-center rounded-lg bg-blue-600 shadow-sm px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            + New Quiz
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

          {quizzes.map(
            (quiz) => (
              <Link
                key={quiz.id}
                href={
                  `/classes/${id}/quizzes/${quiz.id}`
                }
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300 hover:bg-gray-50/40"
              >
                <div className="text-sm font-semibold text-gray-500">
                  Quiz {quiz.sequence_no}
                </div>

                <h3 className="mt-1 text-lg font-semibold text-gray-900">
                  {quiz.title}
                </h3>

                {quiz.date_given && (
                  <p className="mt-2 text-xs text-gray-500">
                    {quiz.date_given}
                  </p>
                )}

                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4">

                  <div>
                    <p className="text-xs text-gray-500">
                      Maximum
                    </p>

                    <p className="mt-1 font-semibold text-gray-900">
                      {quiz.max_score}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Scores
                    </p>

                    <p className="mt-1 font-semibold text-gray-900">
                      {quiz.scored_count}
                      {" / "}
                      {quiz.total_students}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Average
                    </p>

                    <p className="mt-1 font-semibold text-gray-900">
                      {formatNumber(
                        quiz.average_score
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Highest
                    </p>

                    <p className="mt-1 font-semibold text-gray-900">
                      {formatNumber(
                        quiz.highest_score
                      )}
                    </p>
                  </div>

                </div>
              </Link>
            )
          )}

        </div>
      )}
    </div>
  );
}
