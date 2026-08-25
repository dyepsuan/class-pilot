import {
  getCloudflareContext,
} from "@opennextjs/cloudflare";

import { requireApiAuthentication } from "@/lib/auth/api";

type Props = {
  params: Promise<{
    classId: string;
    quizId: string;
  }>;
};

type SubmittedScore = {
  enrollmentId: number;

  score:
    | number
    | null;

  status:
    | "NOT_RECORDED"
    | "SCORED"
    | "ABSENT"
    | "EXCUSED";
};

export async function POST(
  request: Request,
  { params }: Props
) {
  try {
    const authenticationError = await requireApiAuthentication();

    if (authenticationError) {
      return authenticationError;
    }

    const {
      classId,
      quizId,
    } = await params;

    const classIdNumber =
      Number(classId);

    const quizIdNumber =
      Number(quizId);

    const { env } =
      getCloudflareContext();

    const quiz =
      await env.DB.prepare(
        `
          SELECT
            id,
            max_score

          FROM assessments

          WHERE id = ?1
            AND class_id = ?2
            AND type = 'QUIZ'

          LIMIT 1
        `
      )
        .bind(
          quizIdNumber,
          classIdNumber
        )
        .first<{
          id: number;
          max_score: number;
        }>();

    if (!quiz) {
      return Response.json(
        {
          message:
            "Quiz not found.",
        },
        {
          status: 404,
        }
      );
    }

    const body =
      await request.json() as {
        scores?: SubmittedScore[];
      };

    const scores =
      body.scores;

    if (
      !Array.isArray(scores)
    ) {
      return Response.json(
        {
          message:
            "Invalid scores.",
        },
        {
          status: 400,
        }
      );
    }

    const statements = [];
    const enrollmentChecks = await Promise.all(
      scores.map((item) =>
        env.DB.prepare(
          `
            SELECT
              e.status
            FROM enrollments e
            WHERE e.id = ?1
              AND e.class_id = ?2
            LIMIT 1
          `
        )
          .bind(item.enrollmentId, classIdNumber)
          .first<{ status: string }>()
      )
    );

    for (const [index, item] of scores.entries()) {
      if (
        !Number.isInteger(
          item.enrollmentId
        )
      ) {
        return Response.json(
          {
            message:
              "Invalid student.",
          },
          {
            status: 400,
          }
        );
      }

      const enrollment = enrollmentChecks[index];

      if (!enrollment) {
        return Response.json(
          {
            message: "A submitted student is not enrolled in this class.",
          },
          {
            status: 400,
          }
        );
      }

      if (enrollment.status !== "ACTIVE") {
        return Response.json(
          {
            message: "Archived student scores are read-only.",
          },
          {
            status: 409,
          }
        );
      }

      if (
        item.status ===
        "SCORED"
      ) {
        if (
          typeof item.score !==
            "number" ||
          item.score < 0 ||
          item.score >
            quiz.max_score
        ) {
          return Response.json(
            {
              message:
                `Scores must be between 0 and ${quiz.max_score}.`,
            },
            {
              status: 400,
            }
          );
        }
      }

      if (
        item.status ===
        "NOT_RECORDED"
      ) {
        statements.push(
          env.DB.prepare(
            `
              DELETE FROM assessment_scores

              WHERE assessment_id = ?1
                AND enrollment_id = ?2
            `
          ).bind(
            quizIdNumber,
            item.enrollmentId
          )
        );

        continue;
      }

      statements.push(
        env.DB.prepare(
          `
            INSERT INTO assessment_scores (
              assessment_id,
              enrollment_id,
              score,
              status,
              checked_at
            )

            VALUES (
              ?1,
              ?2,
              ?3,
              ?4,
              CURRENT_TIMESTAMP
            )

            ON CONFLICT(
              assessment_id,
              enrollment_id
            )

            DO UPDATE SET
              score =
                excluded.score,

              status =
                excluded.status,

              checked_at =
                CURRENT_TIMESTAMP,

              updated_at =
                CURRENT_TIMESTAMP
          `
        ).bind(
          quizIdNumber,
          item.enrollmentId,
          item.status ===
            "SCORED"
              ? item.score
              : null,
          item.status
        )
      );
    }

    await env.DB.batch(
      statements
    );

    return Response.json({
      ok: true,
      message:
        "Quiz scores saved.",
    });
  } catch (error) {
    console.error(
      "[ClassPilot quiz score error]",
      error
    );

    return Response.json(
      {
        message:
          "Could not save quiz scores.",
      },
      {
        status: 500,
      }
    );
  }
}
