"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";

export async function createQuiz(
  classId: number,
  formData: FormData
) {
  await requireUser();

  const titleValue =
    formData.get("title");

  const maxScoreValue =
    formData.get("max_score");

  const dateValue =
    formData.get("date_given");

  const descriptionValue =
    formData.get("description");

  if (
    typeof titleValue !== "string" ||
    titleValue.trim() === ""
  ) {
    throw new Error(
      "Quiz title is required."
    );
  }

  const maxScore =
    Number(maxScoreValue);

  if (
    !Number.isFinite(maxScore) ||
    maxScore <= 0
  ) {
    throw new Error(
      "Maximum score must be greater than zero."
    );
  }

  const dateGiven =
    typeof dateValue === "string" &&
    dateValue.trim() !== ""
      ? dateValue
      : null;

  const description =
    typeof descriptionValue === "string" &&
    descriptionValue.trim() !== ""
      ? descriptionValue.trim()
      : null;

  const { env } =
    getCloudflareContext();

  const nextSequence =
    await env.DB.prepare(
      `
        SELECT
          COALESCE(
            MAX(sequence_no),
            0
          ) + 1 AS next_no

        FROM assessments

        WHERE class_id = ?1
          AND type = 'QUIZ'
      `
    )
      .bind(classId)
      .first<{
        next_no: number;
      }>();

  const sequenceNo =
    Number(
      nextSequence?.next_no ?? 1
    );

  const result =
    await env.DB.prepare(
      `
        INSERT INTO assessments (
          class_id,
          type,
          sequence_no,
          title,
          description,
          max_score,
          date_given
        )

        VALUES (
          ?1,
          'QUIZ',
          ?2,
          ?3,
          ?4,
          ?5,
          ?6
        )
      `
    )
      .bind(
        classId,
        sequenceNo,
        titleValue.trim(),
        description,
        maxScore,
        dateGiven
      )
      .run();

  const quizId =
    Number(
      result.meta.last_row_id
    );

  revalidatePath(
    `/classes/${classId}/quizzes`
  );

  redirect(
    `/classes/${classId}/quizzes/${quizId}`
  );
}
