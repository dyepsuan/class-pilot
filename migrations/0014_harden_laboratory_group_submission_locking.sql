-- Group submissions make the laboratory grouping permanent because each file is
-- attached to a specific persistent group ID.

UPDATE laboratories
SET
  groups_locked_at = COALESCE(groups_locked_at, CURRENT_TIMESTAMP),
  updated_at = CURRENT_TIMESTAMP
WHERE lab_type = 'group'
  AND groups_locked_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM laboratory_group_submissions lgs
    WHERE lgs.laboratory_id = laboratories.id
  );

CREATE TRIGGER prevent_group_unlock_after_submission_or_score
BEFORE UPDATE OF groups_locked_at ON laboratories
WHEN OLD.groups_locked_at IS NOT NULL
  AND NEW.groups_locked_at IS NULL
  AND OLD.lab_type = 'group'
  AND (
    EXISTS (
      SELECT 1
      FROM laboratory_group_submissions lgs
      WHERE lgs.laboratory_id = OLD.id
    )
    OR EXISTS (
      SELECT 1
      FROM laboratory_groups lg
      WHERE lg.laboratory_id = OLD.id
        AND lg.group_score IS NOT NULL
    )
    OR EXISTS (
      SELECT 1
      FROM laboratory_scores ls
      WHERE ls.laboratory_id = OLD.id
        AND ls.individual_score IS NOT NULL
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'Groups cannot be unlocked after a submission or score has been recorded.');
END;

CREATE TRIGGER require_locked_groups_for_submission_insert
BEFORE INSERT ON laboratory_group_submissions
WHEN NOT EXISTS (
  SELECT 1
  FROM laboratories l
  WHERE l.id = NEW.laboratory_id
    AND l.lab_type = 'group'
    AND l.groups_locked_at IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'Lock in the laboratory groups before recording submissions.');
END;

CREATE TRIGGER require_locked_groups_for_submission_update
BEFORE UPDATE ON laboratory_group_submissions
WHEN NOT EXISTS (
  SELECT 1
  FROM laboratories l
  WHERE l.id = NEW.laboratory_id
    AND l.lab_type = 'group'
    AND l.groups_locked_at IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'Lock in the laboratory groups before updating submissions.');
END;
