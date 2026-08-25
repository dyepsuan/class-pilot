-- =========================================================
-- Instructor Gmail OAuth connections and setup-link delivery history.
-- OAuth credentials are encrypted before storage. Raw setup tokens,
-- setup URLs, access tokens, email bodies, and PINs are never stored.
-- =========================================================

CREATE TABLE instructor_google_connections (
    id TEXT PRIMARY KEY,
    instructor_id INTEGER NOT NULL UNIQUE,
    google_email TEXT NOT NULL,
    google_subject TEXT NOT NULL,
    refresh_token_ciphertext TEXT NOT NULL,
    refresh_token_iv TEXT NOT NULL,
    encryption_version INTEGER NOT NULL DEFAULT 1
        CHECK (encryption_version = 1),
    scope TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TEXT,
    FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX idx_instructor_google_connections_active
ON instructor_google_connections(instructor_id, revoked_at);

CREATE TABLE student_setup_link_deliveries (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    setup_token_id TEXT NOT NULL,
    previous_setup_token_id TEXT,
    student_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    instructor_id INTEGER NOT NULL,
    provider TEXT NOT NULL DEFAULT 'GMAIL'
        CHECK (provider = 'GMAIL'),
    status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    provider_message_id TEXT,
    error_code TEXT
        CHECK (
            error_code IS NULL
            OR error_code IN (
                'AUTH_REQUIRED',
                'INVALID_RECIPIENT',
                'RATE_LIMITED',
                'PROVIDER_ERROR'
            )
        ),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TEXT,
    FOREIGN KEY (setup_token_id)
        REFERENCES student_setup_tokens(id) ON DELETE RESTRICT,
    FOREIGN KEY (previous_setup_token_id)
        REFERENCES student_setup_tokens(id) ON DELETE RESTRICT,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE RESTRICT,
    FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX idx_setup_link_deliveries_class_created
ON student_setup_link_deliveries(class_id, created_at DESC);

CREATE INDEX idx_setup_link_deliveries_student_created
ON student_setup_link_deliveries(student_id, created_at DESC);

CREATE INDEX idx_setup_link_deliveries_request
ON student_setup_link_deliveries(request_id);

CREATE UNIQUE INDEX idx_setup_link_deliveries_one_pending_student
ON student_setup_link_deliveries(student_id)
WHERE status = 'PENDING';
