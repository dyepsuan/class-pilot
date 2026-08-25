-- =========================================================
-- LABORATORIES
-- =========================================================

CREATE TABLE IF NOT EXISTS laboratories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    class_id INTEGER NOT NULL,

    lab_no INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,

    -- individual | group
    lab_type TEXT NOT NULL DEFAULT 'individual'
        CHECK (lab_type IN ('individual', 'group')),

    -- Overall maximum score of the laboratory
    total_points REAL NOT NULL,

    -- Used for group laboratories
    group_points REAL NOT NULL DEFAULT 0,

    -- Individual lab:
    --   this should equal total_points
    --
    -- Group lab:
    --   this is the student's contribution component
    individual_points REAL NOT NULL,

    due_date TEXT,

    -- open | completed
    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'completed')),

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (class_id, lab_no),

    CHECK (total_points > 0),
    CHECK (group_points >= 0),
    CHECK (individual_points >= 0),

    CHECK (
        (
            lab_type = 'individual'
            AND group_points = 0
            AND individual_points = total_points
        )
        OR
        (
            lab_type = 'group'
            AND group_points + individual_points = total_points
        )
    )
);


-- =========================================================
-- LABORATORY GROUPS
-- Each group belongs only to one laboratory.
-- =========================================================

CREATE TABLE IF NOT EXISTS laboratory_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    laboratory_id INTEGER NOT NULL,

    name TEXT NOT NULL,

    -- Shared output score for the entire group
    group_score REAL,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (laboratory_id)
        REFERENCES laboratories(id)
        ON DELETE CASCADE,

    UNIQUE (laboratory_id, name)
);


-- =========================================================
-- GROUP MEMBERS
-- =========================================================

CREATE TABLE IF NOT EXISTS laboratory_group_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    laboratory_group_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (laboratory_group_id)
        REFERENCES laboratory_groups(id)
        ON DELETE CASCADE,

    UNIQUE (laboratory_group_id, student_id)
);


-- =========================================================
-- STUDENT LABORATORY SCORES
-- =========================================================

CREATE TABLE IF NOT EXISTS laboratory_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    laboratory_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,

    -- Individual lab:
    --   student's entire laboratory score
    --
    -- Group lab:
    --   student's individual contribution score
    individual_score REAL,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (laboratory_id)
        REFERENCES laboratories(id)
        ON DELETE CASCADE,

    UNIQUE (laboratory_id, student_id)
);


-- =========================================================
-- INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_laboratories_class
ON laboratories(class_id);

CREATE INDEX IF NOT EXISTS idx_laboratory_groups_lab
ON laboratory_groups(laboratory_id);

CREATE INDEX IF NOT EXISTS idx_lab_group_members_group
ON laboratory_group_members(laboratory_group_id);

CREATE INDEX IF NOT EXISTS idx_lab_group_members_student
ON laboratory_group_members(student_id);

CREATE INDEX IF NOT EXISTS idx_laboratory_scores_lab
ON laboratory_scores(laboratory_id);

CREATE INDEX IF NOT EXISTS idx_laboratory_scores_student
ON laboratory_scores(student_id);