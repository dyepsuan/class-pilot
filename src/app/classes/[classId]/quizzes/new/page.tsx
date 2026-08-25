import Link from "next/link";
import { notFound } from "next/navigation";

import {
  createQuiz,
} from "../actions";
import PendingSubmitButton from "@/components/pending-submit-button";

type Props = {
  params: Promise<{
    classId: string;
  }>;
};

export default async function NewQuizPage({
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

  const action =
    createQuiz.bind(
      null,
      id
    );

  return (
    <div>
      <Link
        href={
          `/classes/${id}/quizzes`
        }
        className="text-sm font-medium text-gray-500 hover:text-gray-900"
      >
        ← Back to Quizzes
      </Link>

      <div className="mt-6">
        <h2 className="text-xl font-semibold text-gray-900">
          New Quiz
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Create a quiz and then encode student scores.
        </p>
      </div>

      <form
        action={action}
        className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <div className="space-y-6">

          <div>
            <label
              htmlFor="title"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Quiz Title
            </label>

            <input
              id="title"
              name="title"
              required
              placeholder="e.g. Project Management Fundamentals"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-gray-500"
            />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">

            <div>
              <label
                htmlFor="max_score"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Maximum Score
              </label>

              <input
                id="max_score"
                name="max_score"
                type="number"
                min="0.01"
                step="0.01"
                required
                placeholder="15"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-gray-500"
              />
            </div>

            <div>
              <label
                htmlFor="date_given"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Date
              </label>

              <input
                id="date_given"
                name="date_given"
                type="date"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-gray-500"
              />
            </div>

          </div>

          <div>
            <label
              htmlFor="description"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Description
            </label>

            <textarea
              id="description"
              name="description"
              rows={3}
              placeholder="Optional"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-gray-500"
            />
          </div>

        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            href={
              `/classes/${id}/quizzes`
            }
            className="inline-flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:w-auto"
          >
            Cancel
          </Link>

          <PendingSubmitButton
            pendingLabel="Creating..."
            className="w-full rounded-lg bg-blue-600 shadow-sm px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 sm:w-auto"
          >
            Create Quiz
          </PendingSubmitButton>
        </div>
      </form>
    </div>
  );
}
