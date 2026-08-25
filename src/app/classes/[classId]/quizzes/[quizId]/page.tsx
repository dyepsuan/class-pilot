import Link from "next/link";
import { notFound } from "next/navigation";

import QuizScoreSheet from "@/components/quiz-score-sheet";

import {
  getQuizById,
  getQuizRoster,
} from "@/lib/db/quizzes";

type Props = {
  params: Promise<{
    classId: string;
    quizId: string;
  }>;
};

export default async function QuizPage({
  params,
}: Props) {
  const {
    classId,
    quizId,
  } = await params;

  const classIdNumber =
    Number(classId);

  const quizIdNumber =
    Number(quizId);

  if (
    !Number.isInteger(
      classIdNumber
    ) ||
    !Number.isInteger(
      quizIdNumber
    )
  ) {
    notFound();
  }

  const quiz =
    await getQuizById(
      classIdNumber,
      quizIdNumber
    );

  if (!quiz) {
    notFound();
  }

  const roster =
    await getQuizRoster(
      classIdNumber,
      quizIdNumber
    );

  return (
    <div>
      <Link
        href={
          `/classes/${classIdNumber}/quizzes`
        }
        className="text-sm font-medium text-gray-500 hover:text-gray-900"
      >
        ← Back to Quizzes
      </Link>

      <div className="mt-6">
        <p className="text-sm font-semibold text-gray-500">
          Quiz {quiz.sequence_no}
        </p>

        <h2 className="mt-1 text-2xl font-bold text-gray-900">
          {quiz.title}
        </h2>

        {quiz.date_given && (
          <p className="mt-2 text-sm text-gray-500">
            {quiz.date_given}
          </p>
        )}

        {quiz.description && (
          <p className="mt-3 text-sm text-gray-600">
            {quiz.description}
          </p>
        )}
      </div>

      <div className="mt-6">
        <QuizScoreSheet
          classId={
            classIdNumber
          }
          quizId={
            quizIdNumber
          }
          maxScore={
            quiz.max_score
          }
          initialRoster={
            roster
          }
        />
      </div>
    </div>
  );
}