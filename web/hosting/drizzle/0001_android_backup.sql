CREATE TABLE IF NOT EXISTS android_backup_devices (
  token_hash TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS android_backups (
  owner TEXT PRIMARY KEY,
  revision INTEGER NOT NULL,
  saved_at INTEGER NOT NULL,
  payload TEXT NOT NULL
);
