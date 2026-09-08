-- =========================================================
-- Private student Dropbox file metadata.
-- File contents are stored in the private DROPBOX_BUCKET R2 bucket.
-- =========================================================

CREATE TABLE dropbox_files (
    id TEXT PRIMARY KEY,
    class_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    storage_key TEXT NOT NULL UNIQUE,
    original_filename TEXT NOT NULL
        CHECK (length(original_filename) BETWEEN 1 AND 255),
    display_name TEXT NOT NULL
        CHECK (length(display_name) BETWEEN 1 AND 255),
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL
        CHECK (file_size > 0 AND file_size <= 26214400),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE RESTRICT,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT
);

CREATE INDEX idx_dropbox_files_class_created
ON dropbox_files(class_id, created_at DESC);

CREATE INDEX idx_dropbox_files_student_created
ON dropbox_files(student_id, created_at DESC);

CREATE INDEX idx_dropbox_files_class_student_created
ON dropbox_files(class_id, student_id, created_at DESC);

CREATE INDEX idx_dropbox_files_created
ON dropbox_files(created_at DESC);
