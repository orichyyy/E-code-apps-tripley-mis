CREATE TABLE IF NOT EXISTS user_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER,
  user_id INTEGER NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  theme_mode TEXT NOT NULL DEFAULT 'light',
  theme_color TEXT NOT NULL DEFAULT 'blue',
  page_tabs_enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  CONSTRAINT user_preferences_language_check CHECK (language IN ('en', 'zh')),
  CONSTRAINT user_preferences_theme_mode_check CHECK (theme_mode IN ('light', 'dark')),
  CONSTRAINT user_preferences_theme_color_check CHECK (theme_color IN ('blue', 'emerald', 'violet', 'slate'))
);

CREATE UNIQUE INDEX IF NOT EXISTS user_preferences_user_unique
  ON user_preferences(user_id);
