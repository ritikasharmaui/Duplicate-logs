const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, 'duplicate_logs.db');

function openDb() {
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS lead_audit_trail (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES leads(id),
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      change_source TEXT NOT NULL,
      changed_by TEXT NOT NULL,
      changed_at TEXT NOT NULL,
      changed_at_ms INTEGER NOT NULL
    );
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_lat_lead ON lead_audit_trail (lead_id);');
  // Without these, the Lead Manager listing's "has a duplicate match" lookup (a correlated
  // EXISTS per lead) has to full-scan duplicate_lead_records for every one of 115k+ leads.
  db.exec('CREATE INDEX IF NOT EXISTS idx_dlr_incoming ON duplicate_lead_records (incoming_lead_id);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_dlr_matched ON duplicate_lead_records (matched_lead_id);');
  return db;
}

module.exports = { openDb, DB_PATH };
