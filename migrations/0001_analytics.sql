CREATE TABLE IF NOT EXISTS visitors (
  visitor_hash TEXT PRIMARY KEY,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  has_success INTEGER NOT NULL DEFAULT 0 CHECK (has_success IN (0, 1))
);

CREATE TABLE IF NOT EXISTS daily_stats (
  day TEXT PRIMARY KEY,
  page_views INTEGER NOT NULL DEFAULT 0,
  dashboard_loads INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS daily_visitors (
  day TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  has_success INTEGER NOT NULL DEFAULT 0 CHECK (has_success IN (0, 1)),
  PRIMARY KEY (day, visitor_hash)
);

CREATE INDEX IF NOT EXISTS idx_daily_visitors_day ON daily_visitors (day);
CREATE INDEX IF NOT EXISTS idx_visitors_success ON visitors (has_success);
