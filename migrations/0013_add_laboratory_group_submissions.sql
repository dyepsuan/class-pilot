-- One current private R2-backed submission per laboratory group.
-- Contents live in LABORATORY_SUBMISSIONS; D1 stores server-safe metadata only.

CREATE UNIQUE INDEX idx_laboratory_groups_id_laboratory
ON laboratory_groups(id, laboratory_id);

CREATE TABLE laboratory_group_submissions (
    id TEXT PRIMARY KEY,
    laboratory_id INTEGER NOT NULL,
    group_id INTEGER NOT NULL,
    uploaded_by_student_id INTEGER NOT NULL,
    r2_key TEXT NOT NULL UNIQUE,
    original_filename TEXT NOT NULL
        CHECK (length(original_filename) BETWEEN 1 AND 255),
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL
        CHECK (file_size > 0 AND file_size <= 20971520),
    submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (laboratory_id) REFERENCES laboratories(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id, laboratory_id)
        REFERENCES laboratory_groups(id, laboratory_id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by_student_id) REFERENCES students(id) ON DELETE RESTRICT,
    UNIQUE (laboratory_id, group_id)
);

CREATE INDEX idx_laboratory_group_submissions_group
ON laboratory_group_submissions(group_id);
