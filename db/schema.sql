CREATE TABLE IF NOT EXISTS members (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_user_id TEXT    NOT NULL UNIQUE,
  username        TEXT    NOT NULL,
  created_at      TEXT    NOT NULL  -- ISO 8601
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id   INTEGER NOT NULL REFERENCES members(id),
  event_type  TEXT    NOT NULL,  -- cam | screen
  action      TEXT    NOT NULL,  -- on | off
  timestamp   TEXT    NOT NULL   -- ISO 8601 UTC
);
