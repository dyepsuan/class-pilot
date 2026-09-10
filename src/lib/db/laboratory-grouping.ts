export type LaboratoryScoreState = {
  groupScores: number;
  individualScores: number;
  hasScores: boolean;
};

export type LaboratoryGroupingLifecycleState = LaboratoryScoreState & {
  submissions: number;
  hasSubmissions: boolean;
  canUnlock: boolean;
};

export const LABORATORY_EFFECTIVE_LOCK_SQL = `
  (
    l.groups_locked_at IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM laboratory_groups scored_group
      WHERE scored_group.laboratory_id = l.id
        AND scored_group.group_score IS NOT NULL
    )
    OR EXISTS (
      SELECT 1 FROM laboratory_scores scored_student
      WHERE scored_student.laboratory_id = l.id
        AND scored_student.individual_score IS NOT NULL
    )
    OR EXISTS (
      SELECT 1 FROM laboratory_group_submissions submitted_group
      WHERE submitted_group.laboratory_id = l.id
    )
  )
`;

export async function getLaboratoryGroupingLifecycleState(
  db: D1Database,
  laboratoryId: number
): Promise<LaboratoryGroupingLifecycleState> {
  const result = await db.prepare(
    `
      SELECT
        (
          SELECT COUNT(*)
          FROM laboratory_groups
          WHERE laboratory_id = ?1
            AND group_score IS NOT NULL
        ) AS group_scores,
        (
          SELECT COUNT(*)
          FROM laboratory_scores
          WHERE laboratory_id = ?1
            AND individual_score IS NOT NULL
        ) AS individual_scores,
        (
          SELECT COUNT(*)
          FROM laboratory_group_submissions
          WHERE laboratory_id = ?1
        ) AS submissions
    `
  )
    .bind(laboratoryId)
    .first<{
      group_scores: number;
      individual_scores: number;
      submissions: number;
    }>();

  const groupScores = Number(result?.group_scores ?? 0);
  const individualScores = Number(result?.individual_scores ?? 0);
  const submissions = Number(result?.submissions ?? 0);
  const hasScores = groupScores > 0 || individualScores > 0;
  const hasSubmissions = submissions > 0;

  return {
    groupScores,
    individualScores,
    submissions,
    hasScores,
    hasSubmissions,
    canUnlock: !hasScores && !hasSubmissions,
  };
}

export async function getLaboratoryScoreState(
  db: D1Database,
  laboratoryId: number
): Promise<LaboratoryScoreState> {
  const result = await db.prepare(
    `
      SELECT
        (
          SELECT COUNT(*)
          FROM laboratory_groups
          WHERE laboratory_id = ?1
            AND group_score IS NOT NULL
        ) AS group_scores,
        (
          SELECT COUNT(*)
          FROM laboratory_scores
          WHERE laboratory_id = ?1
            AND individual_score IS NOT NULL
        ) AS individual_scores
    `
  )
    .bind(laboratoryId)
    .first<{ group_scores: number; individual_scores: number }>();

  const groupScores = Number(result?.group_scores ?? 0);
  const individualScores = Number(result?.individual_scores ?? 0);

  return {
    groupScores,
    individualScores,
    hasScores: groupScores > 0 || individualScores > 0,
  };
}

export async function hasLaboratoryScores(
  db: D1Database,
  laboratoryId: number
): Promise<boolean> {
  return (await getLaboratoryScoreState(db, laboratoryId)).hasScores;
}

export async function hasLaboratoryGroupSubmissions(
  db: D1Database,
  laboratoryId: number
): Promise<boolean> {
  return (
    await getLaboratoryGroupingLifecycleState(db, laboratoryId)
  ).hasSubmissions;
}

export async function isLaboratoryGroupingEffectivelyLocked(
  db: D1Database,
  laboratoryId: number
): Promise<boolean> {
  const laboratory = await db.prepare(
    `SELECT ${LABORATORY_EFFECTIVE_LOCK_SQL} AS effective_locked
     FROM laboratories l
     WHERE l.id = ?1
     LIMIT 1`
  )
    .bind(laboratoryId)
    .first<{ effective_locked: number }>();

  return Number(laboratory?.effective_locked ?? 0) === 1;
}
