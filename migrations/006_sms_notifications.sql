ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'Driver assigned';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'Ready for pickup';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'Picked up';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'Driver arriving';
ALTER TABLE notifications ADD COLUMN notification_type TEXT NOT NULL DEFAULT 'ACCOUNT';
ALTER TABLE notifications ADD COLUMN provider TEXT;
ALTER TABLE notifications ADD COLUMN next_attempt_at TEXT;
ALTER TABLE notifications ADD COLUMN sent_at TEXT;
ALTER TABLE notifications ADD COLUMN failed_at TEXT;
ALTER TABLE notifications ADD COLUMN expires_at TEXT;
ALTER TABLE notifications ADD COLUMN sensitive_payload TEXT;
CREATE TABLE otp_challenges (
 id TEXT PRIMARY KEY, phone TEXT NOT NULL, name TEXT NOT NULL, email TEXT, password_hash TEXT,
 user_id TEXT REFERENCES users(id) ON DELETE CASCADE, code_hash TEXT NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0, expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL
);
CREATE INDEX otp_phone_created ON otp_challenges(phone,created_at);
CREATE TABLE sms_campaigns (
 id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES users(id), recipient_group TEXT NOT NULL,
 message TEXT NOT NULL, recipients JSONB NOT NULL, cursor INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL, completed_at TEXT
);
-- Retire old plaintext phone-verification payloads; never expose historical codes.
UPDATE notifications SET message='Verification SMS (code hidden)',notification_type='OTP',
 status=CASE WHEN status='queued' THEN 'failed'::notification_status ELSE status END
 WHERE dedup_key LIKE 'phone:%';
