ALTER TABLE laboratories
ADD COLUMN groups_locked_at TEXT;

-- Existing scored group laboratories must never become editable merely because
-- they predate the explicit grouping lifecycle.
UPDATE laboratories
SET groups_locked_at = CURRENT_TIMESTAMP
WHERE lab_type = 'group'
  AND groups_locked_at IS NULL
  AND (
    EXISTS (
      SELECT 1
      FROM laboratory_groups lg
      WHERE lg.laboratory_id = laboratories.id
        AND lg.group_score IS NOT NULL
    )
    OR EXISTS (
      SELECT 1
      FROM laboratory_scores ls
      WHERE ls.laboratory_id = laboratories.id
        AND ls.individual_score IS NOT NULL
    )
  );

-- These triggers make lock/scoring rules atomic with the write. Application
-- checks provide friendly errors; the triggers protect against stale requests.
CREATE TRIGGER prevent_group_insert_when_locked
BEFORE INSERT ON laboratory_groups
WHEN EXISTS (
  SELECT 1 FROM laboratories l
  WHERE l.id = NEW.laboratory_id
    AND (
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
    )
)
BEGIN
  SELECT RAISE(ABORT, 'This laboratory''s groups are locked.');
END;

CREATE TRIGGER prevent_group_delete_when_locked
BEFORE DELETE ON laboratory_groups
WHEN EXISTS (
  SELECT 1 FROM laboratories l
  WHERE l.id = OLD.laboratory_id
    AND (
      l.groups_locked_at IS NOT NULL
      OR OLD.group_score IS NOT NULL
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
    )
)
BEGIN
  SELECT RAISE(ABORT, 'This laboratory''s groups are locked.');
END;

CREATE TRIGGER prevent_group_identity_update_when_locked
BEFORE UPDATE OF laboratory_id, name ON laboratory_groups
WHEN EXISTS (
  SELECT 1 FROM laboratories l
  WHERE l.id = OLD.laboratory_id
    AND l.groups_locked_at IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'This laboratory''s groups are locked.');
END;

CREATE TRIGGER prevent_membership_insert_when_locked
BEFORE INSERT ON laboratory_group_members
WHEN EXISTS (
  SELECT 1
  FROM laboratory_groups lg
  INNER JOIN laboratories l ON l.id = lg.laboratory_id
  WHERE lg.id = NEW.laboratory_group_id
    AND (
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
    )
)
BEGIN
  SELECT RAISE(ABORT, 'This laboratory''s groups are locked.');
END;

CREATE TRIGGER prevent_membership_update_when_locked
BEFORE UPDATE ON laboratory_group_members
WHEN EXISTS (
  SELECT 1
  FROM laboratory_groups lg
  INNER JOIN laboratories l ON l.id = lg.laboratory_id
  WHERE lg.id IN (OLD.laboratory_group_id, NEW.laboratory_group_id)
    AND l.groups_locked_at IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'This laboratory''s groups are locked.');
END;

CREATE TRIGGER prevent_membership_delete_when_locked
BEFORE DELETE ON laboratory_group_members
WHEN EXISTS (
  SELECT 1
  FROM laboratory_groups lg
  INNER JOIN laboratories l ON l.id = lg.laboratory_id
  WHERE lg.id = OLD.laboratory_group_id
    AND (
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
    )
)
BEGIN
  SELECT RAISE(ABORT, 'This laboratory''s groups are locked.');
END;

CREATE TRIGGER require_locked_groups_for_group_score
BEFORE UPDATE OF group_score ON laboratory_groups
WHEN NEW.group_score IS NOT OLD.group_score
  AND EXISTS (
    SELECT 1 FROM laboratories l
    WHERE l.id = NEW.laboratory_id
      AND l.lab_type = 'group'
      AND l.groups_locked_at IS NULL
  )
BEGIN
  SELECT RAISE(ABORT, 'Lock in the laboratory groups before recording scores.');
END;

CREATE TRIGGER require_locked_groups_for_student_score_insert
BEFORE INSERT ON laboratory_scores
WHEN NEW.individual_score IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM laboratories l
    WHERE l.id = NEW.laboratory_id
      AND l.lab_type = 'group'
      AND l.groups_locked_at IS NULL
  )
BEGIN
  SELECT RAISE(ABORT, 'Lock in the laboratory groups before recording scores.');
END;

CREATE TRIGGER require_locked_groups_for_student_score_update
BEFORE UPDATE OF individual_score ON laboratory_scores
WHEN NEW.individual_score IS NOT OLD.individual_score
  AND NEW.individual_score IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM laboratories l
    WHERE l.id = NEW.laboratory_id
      AND l.lab_type = 'group'
      AND l.groups_locked_at IS NULL
  )
BEGIN
  SELECT RAISE(ABORT, 'Lock in the laboratory groups before recording scores.');
END;
