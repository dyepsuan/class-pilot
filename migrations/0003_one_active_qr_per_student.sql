CREATE UNIQUE INDEX idx_student_qr_credentials_one_active
ON student_qr_credentials (student_id)
WHERE revoked_at IS NULL;