ALTER TABLE subscriptions
  ADD COLUMN notify_twenty INTEGER NOT NULL DEFAULT 1 CHECK (notify_twenty IN (0, 1));

ALTER TABLE subscriptions
  ADD COLUMN notify_ten INTEGER NOT NULL DEFAULT 1 CHECK (notify_ten IN (0, 1));

ALTER TABLE subscriptions
  ADD COLUMN notify_athan INTEGER NOT NULL DEFAULT 1 CHECK (notify_athan IN (0, 1));
