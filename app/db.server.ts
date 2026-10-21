import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const path = process.env.DATABASE_PATH ?? "./data/tracker.db";
mkdirSync(dirname(path), { recursive: true });

const db = new Database(path);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    entry_date TEXT NOT NULL,
    description TEXT NOT NULL,
    minutes INTEGER NOT NULL CHECK (minutes > 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS entries_date ON entries(entry_date);
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);

if (!(db.pragma("table_info(entries)") as { name: string }[]).some((c) => c.name === "location")) {
  db.exec("ALTER TABLE entries ADD COLUMN location TEXT NOT NULL DEFAULT ''");
}

export function getSetting(key: string): string | null {
  return (
    (db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined)?.value ?? null
  );
}

export function setSetting(key: string, value: string) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, value);
}

export function deleteSetting(key: string) {
  db.prepare("DELETE FROM settings WHERE key = ?").run(key);
}

export type Client = { id: number; name: string; archived: number; entry_count?: number };
export type Entry = {
  id: number;
  client_id: number;
  client_name: string;
  entry_date: string;
  description: string;
  location: string;
  minutes: number;
};

export function listClients(includeArchived = false): Client[] {
  return db
    .prepare(
      `SELECT c.id, c.name, c.archived, COUNT(e.id) AS entry_count
       FROM clients c LEFT JOIN entries e ON e.client_id = c.id
       ${includeArchived ? "" : "WHERE c.archived = 0"}
       GROUP BY c.id ORDER BY c.name`,
    )
    .all() as Client[];
}

/** Ids of the most recently logged-against active clients, newest first. */
export function recentClientIds(limit = 4): number[] {
  return (
    db
      .prepare(
        `SELECT e.client_id AS id FROM entries e JOIN clients c ON c.id = e.client_id
         WHERE c.archived = 0 GROUP BY e.client_id ORDER BY MAX(e.id) DESC LIMIT ?`,
      )
      .all(limit) as { id: number }[]
  ).map((r) => r.id);
}

/** Distinct job locations already used, most recently used first. */
export function listLocations(): string[] {
  return (
    db
      .prepare(
        `SELECT location FROM entries WHERE location <> ''
         GROUP BY location COLLATE NOCASE ORDER BY MAX(id) DESC`,
      )
      .all() as { location: string }[]
  ).map((r) => r.location);
}

export function addClient(name: string) {
  db.prepare("INSERT INTO clients (name) VALUES (?)").run(name);
}

/** Adds any names that don't already exist (case-insensitive). Existing and archived clients are left untouched. */
export function importClients(names: string[]): { added: number; existing: number } {
  const insert = db.prepare("INSERT OR IGNORE INTO clients (name) VALUES (?)");
  const run = db.transaction((list: string[]) => list.reduce((n, name) => n + insert.run(name).changes, 0));
  const added = run(names);
  return { added, existing: names.length - added };
}

export function setClientArchived(id: number, archived: boolean) {
  db.prepare("UPDATE clients SET archived = ? WHERE id = ?").run(archived ? 1 : 0, id);
}

export function deleteClientIfUnused(id: number) {
  db.prepare("DELETE FROM clients WHERE id = ? AND NOT EXISTS (SELECT 1 FROM entries WHERE client_id = ?)").run(id, id);
}

export function listEntries(filter: { clientId?: number; month?: string; location?: string }): Entry[] {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (filter.clientId) {
    where.push("e.client_id = ?");
    params.push(filter.clientId);
  }
  if (filter.month) {
    where.push("substr(e.entry_date, 1, 7) = ?");
    params.push(filter.month);
  }
  if (filter.location) {
    where.push("e.location = ? COLLATE NOCASE");
    params.push(filter.location);
  }
  return db
    .prepare(
      `SELECT e.id, e.client_id, c.name AS client_name, e.entry_date, e.description, e.location, e.minutes
       FROM entries e JOIN clients c ON c.id = e.client_id
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY e.entry_date DESC, e.id DESC`,
    )
    .all(...params) as Entry[];
}

export function addEntry(e: {
  clientId: number;
  date: string;
  description: string;
  location: string;
  minutes: number;
}) {
  db.prepare("INSERT INTO entries (client_id, entry_date, description, location, minutes) VALUES (?, ?, ?, ?, ?)").run(
    e.clientId,
    e.date,
    e.description,
    e.location,
    e.minutes,
  );
}

export function deleteEntry(id: number) {
  db.prepare("DELETE FROM entries WHERE id = ?").run(id);
}
