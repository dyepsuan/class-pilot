-- =========================================================
-- ClassPilot
-- Migration 0002
-- QR Credentials + Attendance Enhancements
-- =========================================================


-- =========================================================
-- STUDENT QR CREDENTIALS
--
-- Each student can have a QR credential.
--
-- IMPORTANT:
-- The QR itself will contain a random secret token.
-- Only the HASH of that token is stored here.
-- =========================================================

CREATE TABLE student_qr_credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    student_id INTEGER NOT NULL,

    token_hash TEXT NOT NULL UNIQUE,

    issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    revoked_at TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (student_id)
        REFERENCES students(id)
        ON DELETE CASCADE
);


CREATE INDEX idx_student_qr_credentials_student
ON student_qr_credentials (
    student_id,
    revoked_at
);


-- =========================================================
-- ATTENDANCE SESSION ENHANCEMENTS
--
-- started_at:
-- When QR scanning begins.
--
-- ended_at:
-- When instructor finishes/closes attendance.
--
-- late_after:
-- Optional cutoff timestamp for automatic LATE status.
--
-- status:
-- OPEN   = QR scanning is allowed
-- CLOSED = attendance session is finished
-- =========================================================

ALTER TABLE attendance_sessions
ADD COLUMN started_at TEXT;


ALTER TABLE attendance_sessions
ADD COLUMN ended_at TEXT;


ALTER TABLE attendance_sessions
ADD COLUMN late_after TEXT;


ALTER TABLE attendance_sessions
ADD COLUMN status TEXT NOT NULL DEFAULT 'OPEN'
CHECK (
    status IN (
        'OPEN',
        'CLOSED'
    )
);


-- =========================================================
-- ATTENDANCE RECORD ENHANCEMENTS
--
-- recorded_at:
-- Exact time the attendance was recorded.
--
-- recording_method:
-- QR     = scanned
-- MANUAL = instructor manually marked student
-- =========================================================

ALTER TABLE attendance_records
ADD COLUMN recorded_at TEXT;


ALTER TABLE attendance_records
ADD COLUMN recording_method TEXT NOT NULL DEFAULT 'MANUAL'
CHECK (
    recording_method IN (
        'QR',
        'MANUAL'
    )
);


-- Preserve a reasonable timestamp for any old attendance
-- records that existed before this migration.
UPDATE attendance_records
SET recorded_at = created_at
WHERE recorded_at IS NULL;


-- =========================================================
-- INDEXES
-- =========================================================

CREATE INDEX idx_attendance_sessions_status
ON attendance_sessions (
    class_id,
    status
);


CREATE INDEX idx_attendance_records_method
ON attendance_records (
    attendance_session_id,
    recording_method
);