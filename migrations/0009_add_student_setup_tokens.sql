-- =========================================================
-- Secure, one-time student account setup links.
-- Raw setup tokens are never stored; only SHA-256 hashes.
-- =========================================================

CREATE TABLE student_setup_tokens (
    id TEXT PRIMARY KEY,
    student_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    purpose TEXT NOT NULL
        CHECK (purpose IN ('INITIAL_SETUP')),
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    revoked_at TEXT,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX idx_student_setup_tokens_student_purpose_created
ON student_setup_tokens(student_id, purpose, created_at DESC);

CREATE INDEX idx_student_setup_tokens_class
ON student_setup_tokens(class_id);

CREATE UNIQUE INDEX idx_student_setup_tokens_one_open_initial
ON student_setup_tokens(student_id)
WHERE purpose = 'INITIAL_SETUP'
  AND used_at IS NULL
  AND revoked_at IS NULL;
