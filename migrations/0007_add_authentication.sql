-- =========================================================
-- ClassPilot authentication
-- Extends the existing instructor table without replacing it.
-- =========================================================

ALTER TABLE users
ADD COLUMN password_hash TEXT;

ALTER TABLE users
ADD COLUMN auth_id TEXT;

ALTER TABLE users
ADD COLUMN first_name TEXT;

ALTER TABLE users
ADD COLUMN last_name TEXT;

ALTER TABLE users
ADD COLUMN role TEXT NOT NULL DEFAULT 'INSTRUCTOR';

CREATE UNIQUE INDEX idx_users_email_nocase
ON users(email COLLATE NOCASE);

CREATE UNIQUE INDEX idx_users_auth_id
ON users(auth_id);

CREATE TABLE auth_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(auth_id) ON DELETE CASCADE
);

CREATE INDEX idx_auth_sessions_user_id
ON auth_sessions(user_id);

CREATE INDEX idx_auth_sessions_token_hash
ON auth_sessions(token_hash);

CREATE INDEX idx_auth_sessions_expires_at
ON auth_sessions(expires_at);
