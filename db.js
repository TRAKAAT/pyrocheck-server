const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'pyrocheck.db');
const db = new Database(DB_PATH);

// Performance settings
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

// ── Migrations ───────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS records (
    id            TEXT PRIMARY KEY,
    timestamp     TEXT NOT NULL,
    type          TEXT NOT NULL CHECK(type IN ('check','event')),
    check_slot    INTEGER DEFAULT -1,
    check_label   TEXT,
    operator      TEXT,
    shift         TEXT CHECK(shift IN ('day','night')),
    flag          TEXT DEFAULT 'ok' CHECK(flag IN ('ok','warn','alert')),
    smoke_flag    INTEGER DEFAULT 0,
    odour_flag    INTEGER DEFAULT 0,
    comp_flag     INTEGER DEFAULT 0,
    ev_flag       INTEGER DEFAULT 0,
    requires_coct INTEGER DEFAULT 0,
    backfill      INTEGER DEFAULT 0,
    data_json     TEXT DEFAULT '{}',
    photos_json   TEXT DEFAULT '{}',
    created_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_records_timestamp ON records(timestamp);
  CREATE INDEX IF NOT EXISTS idx_records_shift     ON records(shift);
  CREATE INDEX IF NOT EXISTS idx_records_flag      ON records(flag);

  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE,
    role       TEXT DEFAULT 'Operator',
    sig_data   TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

module.exports = db;
