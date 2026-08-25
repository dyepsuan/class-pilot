-- =========================================================
-- ClassPilot
-- Initial Database Schema
-- =========================================================


-- =========================================================
-- USERS / INSTRUCTORS
-- Authentication will be added later.
-- =========================================================

CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- CLASSES
--
-- Example:
-- IS 106
-- Information Systems Project Management
-- BSIS 3C
-- SY 2026-2027
-- 1st Semester
-- =========================================================

CREATE TABLE classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    instructor_id INTEGER NOT NULL,

    subject_code TEXT NOT NULL,
    subject_name TEXT NOT NULL,
    section TEXT NOT NULL,

    school_year TEXT NOT NULL,

    term TEXT NOT NULL
        CHECK (
            term IN (
                '1ST_SEMESTER',
                '2ND_SEMESTER',
                'SUMMER'
            )
        ),

    schedule_text TEXT,

    status TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (
            status IN (
                'ACTIVE',
                'ARCHIVED'
            )
        ),

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (instructor_id)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    UNIQUE (
        instructor_id,
        subject_code,
        section,
        school_year,
        term
    )
);


-- =========================================================
-- STUDENTS
--
-- A student exists once in the database even if enrolled
-- in multiple classes.
-- =========================================================

CREATE TABLE students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    student_number TEXT NOT NULL UNIQUE,

    first_name TEXT NOT NULL,
    middle_name TEXT,
    last_name TEXT NOT NULL,
    suffix TEXT,

    email TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- ENROLLMENTS
--
-- Connects a student to a specific class.
-- =========================================================

CREATE TABLE enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    class_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,

    status TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (
            status IN (
                'ACTIVE',
                'DROPPED',
                'WITHDRAWN',
                'COMPLETED'
            )
        ),

    joined_on TEXT,
    left_on TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (class_id)
        REFERENCES classes(id)
        ON DELETE CASCADE,

    FOREIGN KEY (student_id)
        REFERENCES students(id)
        ON DELETE RESTRICT,

    UNIQUE (
        class_id,
        student_id
    ),

    CHECK (
        left_on IS NULL
        OR joined_on IS NULL
        OR left_on >= joined_on
    )
);


-- =========================================================
-- ATTENDANCE SESSIONS
--
-- One row represents one actual class meeting.
--
-- meeting_no allows:
-- Aug 18 - Meeting 1
-- Aug 18 - Meeting 2
-- =========================================================

CREATE TABLE attendance_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    class_id INTEGER NOT NULL,

    session_date TEXT NOT NULL,

    meeting_no INTEGER NOT NULL DEFAULT 1
        CHECK (meeting_no > 0),

    topic TEXT,
    notes TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (class_id)
        REFERENCES classes(id)
        ON DELETE CASCADE,

    UNIQUE (
        class_id,
        session_date,
        meeting_no
    )
);


-- =========================================================
-- ATTENDANCE RECORDS
--
-- One record per student enrollment per attendance session.
-- =========================================================

CREATE TABLE attendance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    attendance_session_id INTEGER NOT NULL,
    enrollment_id INTEGER NOT NULL,

    status TEXT NOT NULL
        CHECK (
            status IN (
                'PRESENT',
                'LATE',
                'ABSENT',
                'EXCUSED'
            )
        ),

    remarks TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (attendance_session_id)
        REFERENCES attendance_sessions(id)
        ON DELETE CASCADE,

    FOREIGN KEY (enrollment_id)
        REFERENCES enrollments(id)
        ON DELETE RESTRICT,

    UNIQUE (
        attendance_session_id,
        enrollment_id
    )
);


-- =========================================================
-- ASSESSMENTS
--
-- Both quizzes and laboratories live here.
--
-- Examples:
--
-- type = QUIZ
-- sequence_no = 1
--
-- type = LABORATORY
-- sequence_no = 1
-- =========================================================

CREATE TABLE assessments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    class_id INTEGER NOT NULL,

    type TEXT NOT NULL
        CHECK (
            type IN (
                'QUIZ',
                'LABORATORY'
            )
        ),

    sequence_no INTEGER NOT NULL
        CHECK (sequence_no > 0),

    title TEXT NOT NULL,
    description TEXT,

    max_score REAL NOT NULL
        CHECK (max_score > 0),

    date_given TEXT,
    due_at TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (class_id)
        REFERENCES classes(id)
        ON DELETE CASCADE,

    UNIQUE (
        class_id,
        type,
        sequence_no
    )
);


-- =========================================================
-- ASSESSMENT SCORES
--
-- Used by both quizzes and laboratories.
-- =========================================================

CREATE TABLE assessment_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    assessment_id INTEGER NOT NULL,
    enrollment_id INTEGER NOT NULL,

    score REAL
        CHECK (
            score IS NULL
            OR score >= 0
        ),

    status TEXT NOT NULL DEFAULT 'NOT_RECORDED'
        CHECK (
            status IN (
                'NOT_RECORDED',
                'SCORED',
                'SUBMITTED',
                'CHECKED',
                'MISSING',
                'ABSENT',
                'EXCUSED',
                'NEEDS_REVISION'
            )
        ),

    remarks TEXT,

    checked_at TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (assessment_id)
        REFERENCES assessments(id)
        ON DELETE CASCADE,

    FOREIGN KEY (enrollment_id)
        REFERENCES enrollments(id)
        ON DELETE RESTRICT,

    UNIQUE (
        assessment_id,
        enrollment_id
    )
);


-- =========================================================
-- INDEXES
-- =========================================================

CREATE INDEX idx_classes_instructor_status
ON classes (
    instructor_id,
    status
);


CREATE INDEX idx_students_name
ON students (
    last_name,
    first_name
);


CREATE INDEX idx_enrollments_class_status
ON enrollments (
    class_id,
    status
);


CREATE INDEX idx_enrollments_student
ON enrollments (
    student_id
);


CREATE INDEX idx_attendance_sessions_class_date
ON attendance_sessions (
    class_id,
    session_date
);


CREATE INDEX idx_attendance_records_session
ON attendance_records (
    attendance_session_id
);


CREATE INDEX idx_attendance_records_enrollment
ON attendance_records (
    enrollment_id
);


CREATE INDEX idx_assessments_class_type_sequence
ON assessments (
    class_id,
    type,
    sequence_no
);


CREATE INDEX idx_assessment_scores_assessment
ON assessment_scores (
    assessment_id
);


CREATE INDEX idx_assessment_scores_enrollment
ON assessment_scores (
    enrollment_id
);