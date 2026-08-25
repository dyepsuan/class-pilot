"use server";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";

function refreshLaboratory(classId: string, laboratoryId: string) {
  revalidatePath(
    `/classes/${classId}/laboratories/${laboratoryId}`
  );
}

async function isGroupStructureLocked(
  laboratoryId: number
) {
  const { env } = getCloudflareContext();

  const result = await env.DB.prepare(
    `
      SELECT
        (
          SELECT COUNT(*)
          FROM laboratory_groups
          WHERE laboratory_id = ?
            AND group_score IS NOT NULL
        ) AS group_scores,

        (
          SELECT COUNT(*)
          FROM laboratory_scores
          WHERE laboratory_id = ?
            AND individual_score IS NOT NULL
        ) AS individual_scores
    `
  )
    .bind(laboratoryId, laboratoryId)
    .first<{
      group_scores: number;
      individual_scores: number;
    }>();

  return (
    Number(result?.group_scores ?? 0) > 0 ||
    Number(result?.individual_scores ?? 0) > 0
  );
}

export async function createLaboratoryGroup(
  classId: string,
  laboratoryId: string,
  formData: FormData
) {
  await requireUser();

  const labId = Number(laboratoryId);
  const name = String(formData.get("name") ?? "").trim();

  if (!Number.isInteger(labId) || labId <= 0) {
    return;
  }

  if (await isGroupStructureLocked(labId)) {
    console.warn(
      "Cannot create group: laboratory grading has already started."
    );

    return;
  }

  if (!name) {
    return;
  }

  const { env } = getCloudflareContext();

  try {
    await env.DB.prepare(
      `
        INSERT INTO laboratory_groups (
          laboratory_id,
          name
        )
        VALUES (?, ?)
      `
    )
      .bind(labId, name)
      .run();

    refreshLaboratory(classId, laboratoryId);
  } catch (error) {
    console.error("Failed to create laboratory group:", error);
  }
}

export async function addStudentToGroup(
  classId: string,
  laboratoryId: string,
  groupId: string,
  formData: FormData
) {
  await requireUser();

  const labId = Number(laboratoryId);
  const numericGroupId = Number(groupId);
  const studentId = Number(formData.get("student_id"));

  if (
    !Number.isInteger(labId) ||
    !Number.isInteger(numericGroupId) ||
    !Number.isInteger(studentId)
  ) {
    return;
  }

  if (await isGroupStructureLocked(labId)) {
    return;
  }

  const { env } = getCloudflareContext();

  // Make sure this group belongs to this laboratory.
  const group = await env.DB.prepare(
    `
      SELECT lg.id
      FROM laboratory_groups lg
      INNER JOIN laboratories l
        ON l.id = lg.laboratory_id
      WHERE lg.id = ?1
        AND lg.laboratory_id = ?2
        AND l.class_id = ?3
      LIMIT 1
    `
  )
    .bind(numericGroupId, labId, Number(classId))
    .first<{ id: number }>();

  if (!group) {
    return;
  }

  const activeEnrollment = await env.DB.prepare(
    `
      SELECT id
      FROM enrollments
      WHERE class_id = ?1
        AND student_id = ?2
        AND status = 'ACTIVE'
      LIMIT 1
    `
  )
    .bind(Number(classId), studentId)
    .first<{ id: number }>();

  if (!activeEnrollment) {
    return;
  }

  // A student can only belong to one group
  // within the same laboratory.
  const existingMembership = await env.DB.prepare(
    `
      SELECT lgm.id
      FROM laboratory_group_members lgm

      INNER JOIN laboratory_groups lg
        ON lg.id = lgm.laboratory_group_id

      WHERE lg.laboratory_id = ?
        AND lgm.student_id = ?

      LIMIT 1
    `
  )
    .bind(labId, studentId)
    .first<{ id: number }>();

  if (existingMembership) {
    return;
  }

  try {
    await env.DB.prepare(
      `
        INSERT INTO laboratory_group_members (
          laboratory_group_id,
          student_id
        )
        VALUES (?, ?)
      `
    )
      .bind(numericGroupId, studentId)
      .run();

    refreshLaboratory(classId, laboratoryId);
  } catch (error) {
    console.error("Failed to add student to group:", error);
  }
}

export async function removeStudentFromGroup(
  classId: string,
  laboratoryId: string,
  membershipId: string
) {
  await requireUser();

  const numericMembershipId = Number(membershipId);
  const labId = Number(laboratoryId);

  if (await isGroupStructureLocked(labId)) {
    return;
  }

  if (
    !Number.isInteger(numericMembershipId) ||
    numericMembershipId <= 0
  ) {
    return;
  }

  const { env } = getCloudflareContext();

  try {
    await env.DB.prepare(
      `
        DELETE FROM laboratory_group_members
        WHERE id = ?
      `
    )
      .bind(numericMembershipId)
      .run();

    refreshLaboratory(classId, laboratoryId);
  } catch (error) {
    console.error("Failed to remove group member:", error);
  }
}

export async function deleteLaboratoryGroup(
  classId: string,
  laboratoryId: string,
  groupId: string
) {
  await requireUser();

  const numericGroupId = Number(groupId);
  const labId = Number(laboratoryId);

  if (
    !Number.isInteger(numericGroupId) ||
    numericGroupId <= 0 ||
    !Number.isInteger(labId)
  ) {
    return;
  }

  if (await isGroupStructureLocked(labId)) {
    return;
  }

  if (!Number.isInteger(numericGroupId) || numericGroupId <= 0) {
    return;
  }

  const { env } = getCloudflareContext();

  try {
    // Members are deleted automatically because of ON DELETE CASCADE.
    await env.DB.prepare(
      `
        DELETE FROM laboratory_groups
        WHERE id = ?
          AND laboratory_id = ?
      `
    )
      .bind(numericGroupId, labId)
      .run();

    refreshLaboratory(classId, laboratoryId);
  } catch (error) {
    console.error("Failed to delete laboratory group:", error);
  }
}

export type RandomGroupingState = {
  error?: string;
  success?: string;
};

export async function randomizeLaboratoryGroups(
  classId: string,
  laboratoryId: string,
  _previousState: RandomGroupingState,
  formData: FormData
): Promise<RandomGroupingState> {
  await requireUser();

  const numericClassId = Number(classId);
  const numericLaboratoryId = Number(laboratoryId);

  const mode = String(formData.get("mode") ?? "");
  const groupingValue = Number(formData.get("grouping_value"));

  if (
    !Number.isInteger(numericClassId) ||
    numericClassId <= 0 ||
    !Number.isInteger(numericLaboratoryId) ||
    numericLaboratoryId <= 0
  ) {
    return {
      error: "Invalid laboratory.",
    };
  }

  if (
    mode !== "group_count" &&
    mode !== "students_per_group"
  ) {
    return {
      error: "Invalid grouping method.",
    };
  }

  if (
    !Number.isInteger(groupingValue) ||
    groupingValue <= 0
  ) {
    return {
      error: "Enter a valid whole number.",
    };
  }

  const { env } = getCloudflareContext();

  // Make sure this is really a group laboratory
  // belonging to the current class.
  const laboratory = await env.DB.prepare(
    `
      SELECT id
      FROM laboratories
      WHERE id = ?
        AND class_id = ?
        AND lab_type = 'group'
      LIMIT 1
    `
  )
    .bind(numericLaboratoryId, numericClassId)
    .first<{ id: number }>();

  if (!laboratory) {
    return {
      error: "Group laboratory not found.",
    };
  }

  // Do not allow regrouping once scores have already
  // been entered.
  const scoreCheck = await env.DB.prepare(
    `
      SELECT
        (
          SELECT COUNT(*)
          FROM laboratory_groups
          WHERE laboratory_id = ?
            AND group_score IS NOT NULL
        ) AS group_scores,

        (
          SELECT COUNT(*)
          FROM laboratory_scores
          WHERE laboratory_id = ?
            AND individual_score IS NOT NULL
        ) AS individual_scores
    `
  )
    .bind(
      numericLaboratoryId,
      numericLaboratoryId
    )
    .first<{
      group_scores: number;
      individual_scores: number;
    }>();

  if (
    Number(scoreCheck?.group_scores ?? 0) > 0 ||
    Number(scoreCheck?.individual_scores ?? 0) > 0
  ) {
    return {
      error:
        "Groups cannot be randomized after laboratory scores have been entered.",
    };
  }

  // Get the active roster for this class.
  const studentResult = await env.DB.prepare(
    `
      SELECT
        s.id AS student_id

      FROM enrollments e

      INNER JOIN students s
        ON s.id = e.student_id

      WHERE e.class_id = ?
        AND e.status = 'ACTIVE'

      ORDER BY
        s.last_name ASC,
        s.first_name ASC
    `
  )
    .bind(numericClassId)
    .all<{
      student_id: number;
    }>();

  const studentIds = (studentResult.results ?? []).map(
    (student) => Number(student.student_id)
  );

  if (studentIds.length === 0) {
    return {
      error: "There are no active students in this class.",
    };
  }

  let groupCount: number;

  if (mode === "group_count") {
    if (groupingValue > studentIds.length) {
      return {
        error:
          "The number of groups cannot be greater than the number of students.",
      };
    }

    groupCount = groupingValue;
  } else {
    if (groupingValue > studentIds.length) {
      groupCount = 1;
    } else {
      groupCount = Math.ceil(
        studentIds.length / groupingValue
      );
    }
  }

  // Fisher-Yates shuffle
  for (let i = studentIds.length - 1; i > 0; i--) {
    const randomIndex = Math.floor(
      Math.random() * (i + 1)
    );

    [studentIds[i], studentIds[randomIndex]] = [
      studentIds[randomIndex],
      studentIds[i],
    ];
  }

  // Distribute students evenly across groups.
  //
  // Example:
  // 10 students / 3 groups
  // = 4, 3, 3
  const randomizedGroups: number[][] = Array.from(
    { length: groupCount },
    () => []
  );

  studentIds.forEach((studentId, index) => {
    randomizedGroups[index % groupCount].push(studentId);
  });

  try {
    const statements = [];

    // Rebuilding groups removes old memberships through
    // ON DELETE CASCADE.
    statements.push(
      env.DB.prepare(
        `
          DELETE FROM laboratory_groups
          WHERE laboratory_id = ?
        `
      ).bind(numericLaboratoryId)
    );

    // Create the new groups.
    randomizedGroups.forEach((_, index) => {
      statements.push(
        env.DB.prepare(
          `
            INSERT INTO laboratory_groups (
              laboratory_id,
              name
            )
            VALUES (?, ?)
          `
        ).bind(
          numericLaboratoryId,
          `Group ${index + 1}`
        )
      );
    });

    // Add each randomized student to the correct group.
    randomizedGroups.forEach((studentIds, groupIndex) => {
      const groupName = `Group ${groupIndex + 1}`;

      studentIds.forEach((studentId) => {
        statements.push(
          env.DB.prepare(
            `
              INSERT INTO laboratory_group_members (
                laboratory_group_id,
                student_id
              )

              SELECT
                id,
                ?

              FROM laboratory_groups

              WHERE laboratory_id = ?
                AND name = ?

              LIMIT 1
            `
          ).bind(
            studentId,
            numericLaboratoryId,
            groupName
          )
        );
      });
    });

    await env.DB.batch(statements);

    refreshLaboratory(classId, laboratoryId);

    return {
      success: `${studentIds.length} students were randomized into ${groupCount} ${
        groupCount === 1 ? "group" : "groups"
      }.`,
    };
  } catch (error) {
    console.error(
      "Failed to randomize laboratory groups:",
      error
    );

    return {
      error:
        "Could not randomize the groups. Please try again.",
    };
  }
}

export type SaveSingleGroupScoresState = {
  error?: string;
  success?: boolean;
};

export async function saveSingleGroupScores(
  classId: string,
  laboratoryId: string,
  groupId: string,
  _previousState: SaveSingleGroupScoresState,
  formData: FormData
): Promise<SaveSingleGroupScoresState> {
  await requireUser();

  const numericClassId = Number(classId);
  const numericLaboratoryId = Number(laboratoryId);
  const numericGroupId = Number(groupId);

  if (
    !Number.isInteger(numericClassId) ||
    !Number.isInteger(numericLaboratoryId) ||
    !Number.isInteger(numericGroupId)
  ) {
    return {
      error: "Invalid laboratory group.",
    };
  }

  const { env } = getCloudflareContext();

  const laboratory = await env.DB.prepare(
    `
      SELECT
        id,
        total_points,
        group_points,
        individual_points,
        status

      FROM laboratories

      WHERE id = ?
        AND class_id = ?
        AND lab_type = 'group'

      LIMIT 1
    `
  )
    .bind(
      numericLaboratoryId,
      numericClassId
    )
    .first<{
      id: number;
      total_points: number;
      group_points: number;
      individual_points: number;
      status: "open" | "completed";
    }>();

  if (!laboratory) {
    return {
      error: "Group laboratory not found.",
    };
  }

  if (laboratory.status === "completed") {
    return {
      error:
        "This laboratory is completed. Reopen it before editing scores.",
    };
  }

  const group = await env.DB.prepare(
    `
      SELECT
        id,
        name

      FROM laboratory_groups

      WHERE id = ?
        AND laboratory_id = ?

      LIMIT 1
    `
  )
    .bind(
      numericGroupId,
      numericLaboratoryId
    )
    .first<{
      id: number;
      name: string;
    }>();

  if (!group) {
    return {
      error: "Laboratory group not found.",
    };
  }

  const membershipResult = await env.DB.prepare(
    `
      SELECT
        student_id

      FROM laboratory_group_members

      WHERE laboratory_group_id = ?

      ORDER BY id ASC
    `
  )
    .bind(numericGroupId)
    .all<{
      student_id: number;
    }>();

  const memberships =
    membershipResult.results ?? [];

  if (memberships.length === 0) {
    return {
      error: "This group has no members.",
    };
  }

  const groupScoreValue =
    formData.get("group_score");

  const groupScore =
    Number(groupScoreValue);

  if (
    groupScoreValue === null ||
    groupScoreValue === "" ||
    !Number.isFinite(groupScore)
  ) {
    return {
      error: "Enter the group output score.",
    };
  }

  if (
    groupScore < 0 ||
    groupScore > Number(laboratory.group_points)
  ) {
    return {
      error: `Group output must be between 0 and ${laboratory.group_points}.`,
    };
  }

  const statements = [
    env.DB.prepare(
      `
        UPDATE laboratory_groups

        SET
          group_score = ?,
          updated_at = CURRENT_TIMESTAMP

        WHERE id = ?
          AND laboratory_id = ?
      `
    ).bind(
      groupScore,
      numericGroupId,
      numericLaboratoryId
    ),
  ];

  for (const membership of memberships) {
    const value = formData.get(
      `individual_score_${membership.student_id}`
    );

    const score = Number(value);

    if (
      value === null ||
      value === "" ||
      !Number.isFinite(score)
    ) {
      return {
        error:
          "Enter an individual contribution score for every member.",
      };
    }

    if (
      score < 0 ||
      score >
        Number(laboratory.individual_points)
    ) {
      return {
        error: `Individual contribution must be between 0 and ${laboratory.individual_points}.`,
      };
    }

    statements.push(
      env.DB.prepare(
        `
          INSERT INTO laboratory_scores (
            laboratory_id,
            student_id,
            individual_score,
            created_at,
            updated_at
          )

          VALUES (
            ?,
            ?,
            ?,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )

          ON CONFLICT(
            laboratory_id,
            student_id
          )
          DO UPDATE SET
            individual_score =
              excluded.individual_score,
            updated_at =
              CURRENT_TIMESTAMP
        `
      ).bind(
        numericLaboratoryId,
        membership.student_id,
        score
      )
    );
  }

  try {
    await env.DB.batch(statements);
  } catch (error) {
    console.error(
      "Failed to save group scores:",
      error
    );

    return {
      error: "Could not save group scores.",
    };
  }

  revalidatePath(
    `/classes/${classId}/laboratories/${laboratoryId}`
  );

  return {
    success: true,
  };
}

export type SaveIndividualScoresState = {
  error?: string;
};

export async function saveIndividualLaboratoryScores(
  classId: string,
  laboratoryId: string,
  _previousState: SaveIndividualScoresState,
  formData: FormData
): Promise<SaveIndividualScoresState> {
  await requireUser();

  const numericClassId = Number(classId);
  const numericLaboratoryId = Number(laboratoryId);

  if (
    !Number.isInteger(numericClassId) ||
    !Number.isInteger(numericLaboratoryId)
  ) {
    return {
      error: "Invalid laboratory.",
    };
  }

  const { env } = getCloudflareContext();

  const laboratory = await env.DB.prepare(
    `
      SELECT
        id,
        total_points,
        status

      FROM laboratories

      WHERE id = ?
        AND class_id = ?
        AND lab_type = 'individual'

      LIMIT 1
    `
  )
    .bind(
      numericLaboratoryId,
      numericClassId
    )
    .first<{
      id: number;
      total_points: number;
      status: "open" | "completed";
    }>();

  if (!laboratory) {
    return {
      error: "Individual laboratory not found.",
    };
  }

  if (laboratory.status === "completed") {
    return {
      error:
        "This laboratory is completed. Reopen it before editing scores.",
    };
  }

  /*
   * Get the active students from the class.
   */
  const rosterResult = await env.DB.prepare(
    `
      SELECT
        s.id AS student_id

      FROM enrollments e

      INNER JOIN students s
        ON s.id = e.student_id

      WHERE e.class_id = ?
        AND e.status = 'ACTIVE'

      ORDER BY
        s.last_name ASC,
        s.first_name ASC
    `
  )
    .bind(numericClassId)
    .all<{
      student_id: number;
    }>();

  const roster = rosterResult.results ?? [];

  if (roster.length === 0) {
    return {
      error: "There are no active students in this class.",
    };
  }

  const statements = [];

  for (const student of roster) {
    const value = formData.get(
      `score_${student.student_id}`
    );

    if (
      value === null ||
      value === ""
    ) {
      return {
        error:
          "Enter a score for every student before saving.",
      };
    }

    const score = Number(value);

    if (!Number.isFinite(score)) {
      return {
        error: "One or more scores are invalid.",
      };
    }

    if (
      score < 0 ||
      score > Number(laboratory.total_points)
    ) {
      return {
        error: `Scores must be between 0 and ${laboratory.total_points}.`,
      };
    }

    statements.push(
      env.DB.prepare(
        `
          INSERT INTO laboratory_scores (
            laboratory_id,
            student_id,
            individual_score,
            created_at,
            updated_at
          )

          VALUES (
            ?,
            ?,
            ?,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )

          ON CONFLICT (
            laboratory_id,
            student_id
          )

          DO UPDATE SET
            individual_score =
              excluded.individual_score,
            updated_at =
              CURRENT_TIMESTAMP
        `
      ).bind(
        numericLaboratoryId,
        student.student_id,
        score
      )
    );
  }

  try {
    await env.DB.batch(statements);
  } catch (error) {
    console.error(
      "Failed to save individual laboratory scores:",
      error
    );

    return {
      error: "Could not save laboratory scores.",
    };
  }

  revalidatePath(
    `/classes/${classId}/laboratories/${laboratoryId}`
  );

  redirect(
    `/classes/${classId}/laboratories/${laboratoryId}`
  );
}

export type CompleteLaboratoryState = {
  error?: string;
};

export async function completeLaboratory(
  classId: string,
  laboratoryId: string,
  _previousState: CompleteLaboratoryState,
  _formData: FormData
): Promise<CompleteLaboratoryState> {
  await requireUser();

  const numericClassId = Number(classId);
  const numericLaboratoryId = Number(laboratoryId);

  if (
    !Number.isInteger(numericClassId) ||
    !Number.isInteger(numericLaboratoryId)
  ) {
    return {
      error: "Invalid laboratory.",
    };
  }

  const { env } = getCloudflareContext();

  const laboratory = await env.DB.prepare(
    `
      SELECT
        id,
        lab_type,
        status

      FROM laboratories

      WHERE id = ?
        AND class_id = ?

      LIMIT 1
    `
  )
    .bind(
      numericLaboratoryId,
      numericClassId
    )
    .first<{
      id: number;
      lab_type: "individual" | "group";
      status: "open" | "completed";
    }>();

  if (!laboratory) {
    return {
      error: "Laboratory not found.",
    };
  }

  if (laboratory.status === "completed") {
    return {
      error: "This laboratory is already completed.",
    };
  }

  /*
   * Active class roster
   */
  const rosterResult = await env.DB.prepare(
    `
      SELECT
        s.id AS student_id

      FROM enrollments e

      INNER JOIN students s
        ON s.id = e.student_id

      WHERE e.class_id = ?
        AND e.status = 'ACTIVE'
    `
  )
    .bind(numericClassId)
    .all<{
      student_id: number;
    }>();

  const roster = rosterResult.results ?? [];

  if (roster.length === 0) {
    return {
      error:
        "This laboratory cannot be completed because the class has no active students.",
    };
  }

  /*
   * =====================================================
   * INDIVIDUAL LAB
   * =====================================================
   */
  if (laboratory.lab_type === "individual") {
    const scoreResult = await env.DB.prepare(
      `
        SELECT
          student_id,
          individual_score

        FROM laboratory_scores

        WHERE laboratory_id = ?
      `
    )
      .bind(numericLaboratoryId)
      .all<{
        student_id: number;
        individual_score: number | null;
      }>();

    const scoreMap = new Map(
      (scoreResult.results ?? []).map((score) => [
        Number(score.student_id),
        score.individual_score,
      ])
    );

    const missingScores = roster.filter((student) => {
      const score = scoreMap.get(
        Number(student.student_id)
      );

      return (
        score === null ||
        score === undefined
      );
    });

    if (missingScores.length > 0) {
      return {
        error: `${missingScores.length} ${
          missingScores.length === 1
            ? "student still needs"
            : "students still need"
        } a score before this laboratory can be completed.`,
      };
    }
  }

  /*
   * =====================================================
   * GROUP LAB
   * =====================================================
   */
  if (laboratory.lab_type === "group") {
    const groupResult = await env.DB.prepare(
      `
        SELECT
          id,
          name,
          group_score

        FROM laboratory_groups

        WHERE laboratory_id = ?
      `
    )
      .bind(numericLaboratoryId)
      .all<{
        id: number;
        name: string;
        group_score: number | null;
      }>();

    const groups = groupResult.results ?? [];

    if (groups.length === 0) {
      return {
        error:
          "Create and assign laboratory groups before completing this laboratory.",
      };
    }

    /*
     * Every group must have a saved group score.
     */
    const unscoredGroups = groups.filter(
      (group) => group.group_score === null
    );

    if (unscoredGroups.length > 0) {
      return {
        error: `${unscoredGroups.length} ${
          unscoredGroups.length === 1
            ? "group still needs"
            : "groups still need"
        } a group output score.`,
      };
    }

    /*
     * Get memberships.
     */
    const membershipResult = await env.DB.prepare(
      `
        SELECT
          lgm.student_id

        FROM laboratory_group_members lgm

        INNER JOIN laboratory_groups lg
          ON lg.id = lgm.laboratory_group_id

        WHERE lg.laboratory_id = ?
      `
    )
      .bind(numericLaboratoryId)
      .all<{
        student_id: number;
      }>();

    const memberships =
      membershipResult.results ?? [];

    const assignedStudentIds = new Set(
      memberships.map((membership) =>
        Number(membership.student_id)
      )
    );

    /*
     * Every active student must belong to a group.
     */
    const unassignedStudents = roster.filter(
      (student) =>
        !assignedStudentIds.has(
          Number(student.student_id)
        )
    );

    if (unassignedStudents.length > 0) {
      return {
        error: `${unassignedStudents.length} ${
          unassignedStudents.length === 1
            ? "student is"
            : "students are"
        } still not assigned to a group.`,
      };
    }

    /*
     * Every assigned student must have an
     * individual contribution score.
     */
    const scoreResult = await env.DB.prepare(
      `
        SELECT
          student_id,
          individual_score

        FROM laboratory_scores

        WHERE laboratory_id = ?
      `
    )
      .bind(numericLaboratoryId)
      .all<{
        student_id: number;
        individual_score: number | null;
      }>();

    const scoreMap = new Map(
      (scoreResult.results ?? []).map((score) => [
        Number(score.student_id),
        score.individual_score,
      ])
    );

    const missingContributionScores =
      roster.filter((student) => {
        const score = scoreMap.get(
          Number(student.student_id)
        );

        return (
          score === null ||
          score === undefined
        );
      });

    if (missingContributionScores.length > 0) {
      return {
        error: `${missingContributionScores.length} ${
          missingContributionScores.length === 1
            ? "student still needs"
            : "students still need"
        } an individual contribution score.`,
      };
    }
  }

  /*
   * Everything is complete.
   */
  try {
    await env.DB.prepare(
      `
        UPDATE laboratories

        SET
          status = 'completed',
          updated_at = CURRENT_TIMESTAMP

        WHERE id = ?
          AND class_id = ?
          AND status = 'open'
      `
    )
      .bind(
        numericLaboratoryId,
        numericClassId
      )
      .run();
  } catch (error) {
    console.error(
      "Failed to complete laboratory:",
      error
    );

    return {
      error:
        "Could not complete the laboratory. Please try again.",
    };
  }

  revalidatePath(
    `/classes/${classId}/laboratories`
  );

  revalidatePath(
    `/classes/${classId}/laboratories/${laboratoryId}`
  );

  redirect(
    `/classes/${classId}/laboratories/${laboratoryId}`
  );
}

export type ReopenLaboratoryState = {
  error?: string;
};

export async function reopenLaboratory(
  classId: string,
  laboratoryId: string,
  _previousState: ReopenLaboratoryState,
  _formData: FormData
): Promise<ReopenLaboratoryState> {
  await requireUser();

  const numericClassId = Number(classId);
  const numericLaboratoryId = Number(laboratoryId);

  if (
    !Number.isInteger(numericClassId) ||
    !Number.isInteger(numericLaboratoryId)
  ) {
    return {
      error: "Invalid laboratory.",
    };
  }

  const { env } = getCloudflareContext();

  const laboratory = await env.DB.prepare(
    `
      SELECT
        id,
        status

      FROM laboratories

      WHERE id = ?
        AND class_id = ?

      LIMIT 1
    `
  )
    .bind(
      numericLaboratoryId,
      numericClassId
    )
    .first<{
      id: number;
      status: "open" | "completed";
    }>();

  if (!laboratory) {
    return {
      error: "Laboratory not found.",
    };
  }

  if (laboratory.status !== "completed") {
    return {
      error: "This laboratory is already open.",
    };
  }

  try {
    await env.DB.prepare(
      `
        UPDATE laboratories

        SET
          status = 'open',
          updated_at = CURRENT_TIMESTAMP

        WHERE id = ?
          AND class_id = ?
          AND status = 'completed'
      `
    )
      .bind(
        numericLaboratoryId,
        numericClassId
      )
      .run();
  } catch (error) {
    console.error(
      "Failed to reopen laboratory:",
      error
    );

    return {
      error:
        "Could not reopen the laboratory. Please try again.",
    };
  }

  revalidatePath(
    `/classes/${classId}/laboratories`
  );

  revalidatePath(
    `/classes/${classId}/laboratories/${laboratoryId}`
  );

  redirect(
    `/classes/${classId}/laboratories/${laboratoryId}`
  );
}

export type UpdateLaboratoryState = {
  error?: string;
  success?: boolean;
};

function optionalNumber(formData: FormData, name: string) {
  const value = formData.get(name);

  if (value === null || String(value).trim() === "") {
    return null;
  }

  return Number(value);
}

function pointsDiffer(left: number, right: number) {
  return Math.abs(left - right) > 0.0001;
}

export async function updateLaboratory(
  classId: string,
  laboratoryId: string,
  _previousState: UpdateLaboratoryState,
  formData: FormData
): Promise<UpdateLaboratoryState> {
  await requireUser();

  const classIdNumber = Number(classId);
  const laboratoryIdNumber = Number(laboratoryId);

  if (
    !Number.isInteger(classIdNumber) ||
    classIdNumber <= 0 ||
    !Number.isInteger(laboratoryIdNumber) ||
    laboratoryIdNumber <= 0
  ) {
    return { error: "Invalid laboratory." };
  }

  const labNo = Number(formData.get("lab_no"));
  const title = String(formData.get("title") ?? "").trim();
  const description = String(
    formData.get("description") ?? ""
  ).trim();
  const startDate =
    String(formData.get("start_date") ?? "").trim() || null;
  const dueDate =
    String(formData.get("due_date") ?? "").trim() || null;

  if (!Number.isInteger(labNo) || labNo <= 0) {
    return {
      error: "Laboratory number must be a positive whole number.",
    };
  }

  if (!title) {
    return { error: "Laboratory title is required." };
  }

  if (startDate && dueDate && dueDate < startDate) {
    return {
      error: "Due date cannot be earlier than the start date.",
    };
  }

  const { env } = getCloudflareContext();

  const laboratory = await env.DB.prepare(
    `
      SELECT
        id,
        lab_type,
        total_points,
        group_points,
        individual_points,
        status
      FROM laboratories
      WHERE id = ?
        AND class_id = ?
      LIMIT 1
    `
  )
    .bind(laboratoryIdNumber, classIdNumber)
    .first<{
      id: number;
      lab_type: "individual" | "group";
      total_points: number;
      group_points: number;
      individual_points: number;
      status: "open" | "completed";
    }>();

  if (!laboratory) {
    return { error: "Laboratory not found." };
  }

  const duplicate = await env.DB.prepare(
    `
      SELECT id
      FROM laboratories
      WHERE class_id = ?
        AND lab_no = ?
        AND id <> ?
      LIMIT 1
    `
  )
    .bind(classIdNumber, labNo, laboratoryIdNumber)
    .first<{ id: number }>();

  if (duplicate) {
    return {
      error: `Laboratory ${labNo} already exists for this class.`,
    };
  }

  const scoringLocked =
    laboratory.status === "completed" ||
    await isGroupStructureLocked(laboratoryIdNumber);

  let totalPoints = Number(laboratory.total_points);
  let groupPoints = Number(laboratory.group_points);
  let individualPoints = Number(laboratory.individual_points);

  const submittedTotal = optionalNumber(
    formData,
    "total_points"
  );

  if (scoringLocked) {
    if (
      submittedTotal !== null &&
      (
        !Number.isFinite(submittedTotal) ||
        pointsDiffer(submittedTotal, totalPoints)
      )
    ) {
      return {
        error:
          "Scoring settings cannot be changed because grading has already started.",
      };
    }

    if (laboratory.lab_type === "group") {
      const submittedGroup = optionalNumber(
        formData,
        "group_points"
      );
      const submittedIndividual = optionalNumber(
        formData,
        "individual_points"
      );

      if (
        (
          submittedGroup !== null &&
          (
            !Number.isFinite(submittedGroup) ||
            pointsDiffer(submittedGroup, groupPoints)
          )
        ) ||
        (
          submittedIndividual !== null &&
          (
            !Number.isFinite(submittedIndividual) ||
            pointsDiffer(
              submittedIndividual,
              individualPoints
            )
          )
        )
      ) {
        return {
          error:
            "Scoring settings cannot be changed because grading has already started.",
        };
      }
    }
  } else {
    if (
      submittedTotal === null ||
      !Number.isFinite(submittedTotal) ||
      submittedTotal <= 0
    ) {
      return { error: "Total points must be greater than 0." };
    }

    totalPoints = submittedTotal;

    if (laboratory.lab_type === "individual") {
      groupPoints = 0;
      individualPoints = totalPoints;
    } else {
      const submittedGroup = optionalNumber(
        formData,
        "group_points"
      );
      const submittedIndividual = optionalNumber(
        formData,
        "individual_points"
      );

      if (
        submittedGroup === null ||
        !Number.isFinite(submittedGroup) ||
        submittedGroup < 0
      ) {
        return {
          error: "Group output points must be 0 or greater.",
        };
      }

      if (
        submittedIndividual === null ||
        !Number.isFinite(submittedIndividual) ||
        submittedIndividual < 0
      ) {
        return {
          error:
            "Individual contribution points must be 0 or greater.",
        };
      }

      if (
        pointsDiffer(
          submittedGroup + submittedIndividual,
          totalPoints
        )
      ) {
        return {
          error:
            "Group output points and individual contribution points must equal the total points.",
        };
      }

      groupPoints = submittedGroup;
      individualPoints = submittedIndividual;
    }
  }

  try {
    await env.DB.prepare(
      `
        UPDATE laboratories
        SET
          lab_no = ?,
          title = ?,
          description = ?,
          total_points = ?,
          group_points = ?,
          individual_points = ?,
          start_date = ?,
          due_date = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND class_id = ?
      `
    )
      .bind(
        labNo,
        title,
        description || null,
        totalPoints,
        groupPoints,
        individualPoints,
        startDate,
        dueDate,
        laboratoryIdNumber,
        classIdNumber
      )
      .run();
  } catch (error) {
    console.error("Failed to update laboratory:", error);

    if (
      error instanceof Error &&
      error.message.includes("UNIQUE constraint")
    ) {
      return {
        error: `Laboratory ${labNo} already exists for this class.`,
      };
    }

    return {
      error:
        "Could not update the laboratory. Please try again.",
    };
  }

  refreshLaboratory(classId, laboratoryId);
  revalidatePath(`/classes/${classId}/laboratories`);

  return { success: true };
}

export type DeleteLaboratoryState = {
  error?: string;
};

export async function deleteLaboratory(
  classId: string,
  laboratoryId: string,
  _previousState: DeleteLaboratoryState,
  _formData: FormData
): Promise<DeleteLaboratoryState> {
  await requireUser();

  const classIdNumber = Number(classId);
  const laboratoryIdNumber = Number(laboratoryId);

  if (
    !Number.isInteger(classIdNumber) ||
    classIdNumber <= 0 ||
    !Number.isInteger(laboratoryIdNumber) ||
    laboratoryIdNumber <= 0
  ) {
    return { error: "Invalid laboratory." };
  }

  const { env } = getCloudflareContext();

  const laboratory = await env.DB.prepare(
    `
      SELECT id
      FROM laboratories
      WHERE id = ?
        AND class_id = ?
      LIMIT 1
    `
  )
    .bind(laboratoryIdNumber, classIdNumber)
    .first<{ id: number }>();

  if (!laboratory) {
    return { error: "Laboratory not found." };
  }

  try {
    await env.DB.prepare(
      `
        DELETE FROM laboratories
        WHERE id = ?
          AND class_id = ?
      `
    )
      .bind(laboratoryIdNumber, classIdNumber)
      .run();
  } catch (error) {
    console.error("Failed to delete laboratory:", error);

    return {
      error:
        "Could not delete the laboratory. Please try again.",
    };
  }

  revalidatePath(`/classes/${classId}/laboratories`);
  redirect(`/classes/${classId}/laboratories`);
}
