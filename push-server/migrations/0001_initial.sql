CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  installation_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('expo', 'web')),
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  locale TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'ar')),
  address TEXT NOT NULL,
  web_p256dh TEXT,
  web_auth TEXT,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  app_version TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, address)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_enabled_provider
  ON subscriptions(enabled, provider);

CREATE TABLE IF NOT EXISTS deliveries (
  event_id TEXT NOT NULL,
  subscription_id INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent')),
  provider_ticket_id TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(event_id, subscription_id),
  FOREIGN KEY(subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_deliveries_created_at
  ON deliveries(created_at);
