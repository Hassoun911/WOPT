ALTER TABLE subscriptions ADD COLUMN native_token TEXT;
ALTER TABLE subscriptions ADD COLUMN native_token_type TEXT;
CREATE INDEX IF NOT EXISTS idx_subscriptions_native_token ON subscriptions(native_token);
