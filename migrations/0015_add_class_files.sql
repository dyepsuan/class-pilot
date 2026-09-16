-- Instructor materials in the private DROPBOX_BUCKET, separate from student files.
CREATE TABLE class_files (
    id TEXT PRIMARY KEY NOT NULL,
    class_id INTEGER NOT NULL,
    title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 255),
    description TEXT,
    original_filename TEXT NOT NULL CHECK (length(original_filename) BETWEEN 1 AND 255),
    storage_key TEXT NOT NULL UNIQUE CHECK (storage_key LIKE 'class-files/%'),
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 26214400),
    uploaded_by INTEGER NOT NULL,
    version INTEGER NOT NULL DEFAULT 1 CHECK (typeof(version) = 'integer' AND version > 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE RESTRICT,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX idx_class_files_class_created ON class_files(class_id, created_at DESC, id DESC);
CREATE INDEX idx_class_files_uploaded_by ON class_files(uploaded_by);

-- Historical views remain attached to their version when the current file changes.
CREATE TABLE class_file_views (
    class_file_id TEXT NOT NULL,
    student_id INTEGER NOT NULL,
    version INTEGER NOT NULL CHECK (typeof(version) = 'integer' AND version > 0),
    first_viewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_viewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (class_file_id, student_id, version),
    FOREIGN KEY (class_file_id) REFERENCES class_files(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT
);

CREATE INDEX idx_class_file_views_file_version ON class_file_views(class_file_id, version);
CREATE INDEX idx_class_file_views_student ON class_file_views(student_id, class_file_id, version);
