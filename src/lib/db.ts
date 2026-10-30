import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

export const DATA_DIR =
  process.env.FLOWBACK_DATA_DIR?.trim() || path.join(process.cwd(), "data");

export const DB_PATH =
  process.env.FLOWBACK_DB?.trim() || path.join(DATA_DIR, "flowback.db");

export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  openid TEXT UNIQUE,
  display_name TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  raw_text TEXT NOT NULL DEFAULT '',
  images_json TEXT NOT NULL DEFAULT '[]',
  file_names_json TEXT NOT NULL DEFAULT '[]',
  mode TEXT NOT NULL,
  model TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS extractions (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft',
  summary TEXT,
  payload_json TEXT NOT NULL,
  mode TEXT NOT NULL,
  model TEXT,
  warnings_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  extraction_id TEXT,
  title TEXT NOT NULL,
  owner TEXT,
  due_label TEXT,
  due_date TEXT,
  date_status TEXT NOT NULL DEFAULT 'unknown',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'todo',
  confidence TEXT NOT NULL DEFAULT 'explicit',
  source_quote TEXT NOT NULL DEFAULT '',
  speaker TEXT,
  evidence_quote TEXT,
  needs_confirmation INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS risks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  extraction_id TEXT,
  type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  source_quote TEXT NOT NULL DEFAULT '',
  resolution_note TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_events (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  from_value TEXT,
  to_value TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_source ON tasks(source_id);
CREATE INDEX IF NOT EXISTS idx_risks_project ON risks(project_id);
CREATE INDEX IF NOT EXISTS idx_risks_task ON risks(task_id);
CREATE INDEX IF NOT EXISTS idx_sources_project ON sources(project_id);
CREATE INDEX IF NOT EXISTS idx_extractions_source ON extractions(source_id);
CREATE INDEX IF NOT EXISTS idx_events_task ON task_events(task_id);
`;

export const AUTH_LOCAL_USER_ID = "usr_local_admin";

let dbInstance: DatabaseSync | null = null;

/**
 * Idempotent migration for the existing R2 database. It only adds an owner
 * column and assigns legacy projects to the local admin user; it never drops
 * or truncates project data.
 */
function ensureAuthSchema(db: DatabaseSync): void {
  const columns = db
    .prepare("PRAGMA table_info(projects)")
    .all() as Array<{ name?: unknown }>;
  if (!columns.some((column) => column.name === "owner_id")) {
    db.exec("ALTER TABLE projects ADD COLUMN owner_id TEXT");
  }
  const now = new Date().toISOString();
  db.prepare(
    `INSERT OR IGNORE INTO users (id, kind, openid, display_name, created_at)
     VALUES (?, 'local', NULL, '本机管理员', ?)`,
  ).run(AUTH_LOCAL_USER_ID, now);
  db.prepare("UPDATE projects SET owner_id = ? WHERE owner_id IS NULL").run(
    AUTH_LOCAL_USER_ID,
  );
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id)",
  );
}

function openDatabase(file: string): DatabaseSync {
  if (file !== ":memory:") {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const db = new DatabaseSync(file);
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  ensureAuthSchema(db);
  return db;
}

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = openDatabase(DB_PATH);
  }
  return dbInstance;
}

/** Test helper: swap the singleton for an isolated in-memory database. */
export function setDatabaseForTests(file = ":memory:"): DatabaseSync {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      /* ignore */
    }
  }
  dbInstance = openDatabase(file);
  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function ensureUploadsDir(): string {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  return UPLOAD_DIR;
}

export function transaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw error;
  }
}
