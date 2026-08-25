-- =========================================================
-- Class-pilot student portal authentication
-- Kept separate from instructor authentication and sessions.
-- =========================================================

CREATE TABLE student_accounts (
    id TEXT PRIMARY KEY,
    student_id INTEGER NOT NULL UNIQUE,
    pin_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE student_sessions (
    id TEXT PRIMARY KEY,
    student_id INTEGER NOT NULL,
    session_token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX idx_student_sessions_student_id
ON student_sessions(student_id);

CREATE INDEX idx_student_sessions_expires_at
ON student_sessions(expires_at);
