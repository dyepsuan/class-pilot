-- =========================================================
-- STRUCTURED CLASS MEETINGS
-- Recurring classroom-local wall-clock times.
-- =========================================================

CREATE TABLE IF NOT EXISTS class_meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,

    weekday TEXT NOT NULL
        CHECK (weekday IN (
            'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY',
            'FRIDAY', 'SATURDAY', 'SUNDAY'
        )),

    start_time TEXT NOT NULL
        CHECK (
            length(start_time) = 5
            AND start_time GLOB '[0-2][0-9]:[0-5][0-9]'
            AND substr(start_time, 1, 2) BETWEEN '00' AND '23'
        ),

    end_time TEXT NOT NULL
        CHECK (
            length(end_time) = 5
            AND end_time GLOB '[0-2][0-9]:[0-5][0-9]'
            AND substr(end_time, 1, 2) BETWEEN '00' AND '23'
        ),

    position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    UNIQUE (class_id, weekday, start_time, end_time),
    CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_class_meetings_class_day_time
ON class_meetings(class_id, weekday, start_time, position);
