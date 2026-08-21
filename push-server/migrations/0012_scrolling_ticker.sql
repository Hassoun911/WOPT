INSERT OR IGNORE INTO app_settings (setting_key, value_json, description)
VALUES (
  'scrolling_ticker',
  '{"enabled":false,"message":"","speed":"normal"}',
  'Admin-controlled scrolling alert bar shown in Hassoun clients. Supports emoji and Unicode text.'
);
