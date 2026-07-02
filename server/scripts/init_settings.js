// Creates and seeds the Lead Duplication Settings tables per duplicate_logs_feature.md Section 3.0/5.
// Report checkbox default state is Open Item #9 in the brief (unresolved) - defaulted to ON here
// for the 5 eligible sources; adjustable via the Settings screen once built.
const { openDb } = require('../db/connection');

const RA_OPTIONS_STANDARD = ['Lead Create Only', 'Never'];
const RA_OPTIONS_FULL = ['Lead Create Only', 'Lead Create or Update', 'Never', 'Report Only'];
const RA_OPTIONS_TELEPHONY = ['Only First Call', 'Every Call', 'Never'];

const SOURCES = [
  {
    key: 'add_quick_lead', label: 'Add Quick Lead',
    ra_options: RA_OPTIONS_STANDARD, ra_default: 'Lead Create Only',
    report_eligible: false, special_config: null,
  },
  {
    key: 'widget', label: 'Widget',
    ra_options: RA_OPTIONS_FULL, ra_default: 'Lead Create or Update',
    report_eligible: true, special_config: 'per_widget',
  },
  {
    key: 'landing_page', label: 'Landing Page',
    ra_options: RA_OPTIONS_FULL, ra_default: 'Lead Create or Update',
    report_eligible: true, special_config: null,
  },
  {
    key: 'telephony_inbound', label: 'Telephony Inbound',
    ra_options: RA_OPTIONS_TELEPHONY, ra_default: 'Only First Call',
    report_eligible: false, special_config: null,
  },
  {
    key: 'fb_lead', label: 'FB Lead',
    ra_options: RA_OPTIONS_FULL, ra_default: 'Lead Create or Update',
    report_eligible: true, special_config: null,
  },
  {
    key: 'google_lead', label: 'Google Lead',
    ra_options: RA_OPTIONS_FULL, ra_default: 'Lead Create or Update',
    report_eligible: true, special_config: null,
  },
  {
    key: 'zapier_lead', label: 'Zapier Lead',
    ra_options: RA_OPTIONS_FULL, ra_default: 'Lead Create or Update',
    report_eligible: true, special_config: null,
  },
  {
    key: 'am_single_upload', label: 'AM / Single Upload',
    ra_options: RA_OPTIONS_STANDARD, ra_default: 'Lead Create Only',
    report_eligible: false, special_config: null,
  },
  {
    key: 'publisher', label: 'Publisher',
    ra_options: RA_OPTIONS_STANDARD, ra_default: 'Lead Create Only',
    report_eligible: false, special_config: null,
  },
];

// Real widget names observed in the imported leads data, seeded with a default per-widget RA option.
const SEED_WIDGETS = [
  'New form(a)', 'UG PROGRAM', 'Two Step Widget - Part 1', 'Scholarship Test Jan',
  'Sagar_Widget', 'Saurabh Widget', 'IES Widget 1', 'Calling Widget',
];

function main() {
  const db = openDb();

  db.exec('DROP TABLE IF EXISTS duplication_settings;');
  db.exec(`
    CREATE TABLE duplication_settings (
      source_key TEXT PRIMARY KEY,
      source_label TEXT NOT NULL,
      ra_enabled INTEGER NOT NULL DEFAULT 1,
      ra_options TEXT NOT NULL,
      ra_selected TEXT NOT NULL,
      report_eligible INTEGER NOT NULL,
      report_enabled INTEGER,
      special_config TEXT,
      modified_on TEXT,
      modified_by TEXT
    );
  `);

  db.exec('DROP TABLE IF EXISTS widget_ra_config;');
  db.exec(`
    CREATE TABLE widget_ra_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      widget_name TEXT NOT NULL UNIQUE,
      ra_option TEXT NOT NULL
    );
  `);

  db.exec('DROP TABLE IF EXISTS download_requests;');
  db.exec(`
    CREATE TABLE download_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requested_by TEXT NOT NULL,
      requested_at TEXT NOT NULL,
      status TEXT NOT NULL,
      columns_json TEXT NOT NULL,
      filters_json TEXT,
      row_count INTEGER,
      file_name TEXT
    );
  `);

  const insertSource = db.prepare(`
    INSERT INTO duplication_settings (
      source_key, source_label, ra_enabled, ra_options, ra_selected,
      report_eligible, report_enabled, special_config, modified_on, modified_by
    ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  for (const s of SOURCES) {
    insertSource.run(
      s.key, s.label, JSON.stringify(s.ra_options), s.ra_default,
      s.report_eligible ? 1 : 0,
      s.report_eligible ? 1 : null,
      s.special_config,
      now, 'System Default'
    );
  }

  const insertWidget = db.prepare('INSERT INTO widget_ra_config (widget_name, ra_option) VALUES (?, ?)');
  for (const w of SEED_WIDGETS) {
    insertWidget.run(w, 'Lead Create or Update');
  }

  console.log(`Seeded ${SOURCES.length} sources and ${SEED_WIDGETS.length} widget configs.`);
  db.close();
}

main();
