const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, 'duplicate_logs.db');

const RA_STD  = JSON.stringify(['Lead Create Only', 'Never']);
const RA_FULL = JSON.stringify(['Lead Create Only', 'Lead Create or Update', 'Never']);
const RA_TEL  = JSON.stringify(['Only First Call', 'Every Call', 'Never']);

const DEFAULT_SOURCES = [
  ['add_quick_lead',    'Add Quick Lead',       RA_STD,  'Lead Create Only',       0, null, null],
  ['widget',           'Widget',                RA_FULL, 'Lead Create or Update',  1, 1,    'per_widget'],
  ['landing_page',     'Landing Page',          RA_FULL, 'Lead Create or Update',  1, 1,    null],
  ['telephony_inbound','Telephony Inbound',     RA_TEL,  'Only First Call',        0, null, null],
  ['fb_lead',          'FB Lead',               RA_FULL, 'Lead Create or Update',  1, 1,    null],
  ['google_lead',      'Google Lead',           RA_FULL, 'Lead Create or Update',  1, 1,    null],
  ['zapier_lead',      'Zapier Lead',           RA_FULL, 'Lead Create or Update',  1, 1,    null],
  ['am_single_upload', 'AM / Single Upload',    RA_STD,  'Lead Create Only',       0, null, null],
  ['publisher',        'Publisher',             RA_STD,  'Lead Create Only',       0, null, null],
];

const DEFAULT_WIDGETS = [
  'New form(a)', 'UG PROGRAM', 'Two Step Widget - Part 1', 'Scholarship Test Jan',
  'Sagar_Widget', 'Saurabh Widget', 'IES Widget 1', 'Calling Widget',
];

function openDb() {
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = OFF;');

  // Core tables — all created here so openDb() never crashes on a fresh DB
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      "Name" TEXT,
      "Registered Email" TEXT,
      "Registered Mobile" TEXT,
      "State" TEXT,
      "City" TEXT,
      "Lead Stage" TEXT,
      "User Registration Date" TEXT,
      "Lead Id" TEXT,
      "Lead Origin(Primary)" TEXT,
      "Widget Name" TEXT,
      "Source" TEXT,
      "Utm Campaignid" TEXT,
      "Primary Registration Campaign" TEXT,
      "Secondary Registration Campaign" TEXT,
      "Created By" TEXT,
      "Aadhaar Card" TEXT,
      "Primary Traffic Channel" TEXT,
      "Publisher Name" TEXT,
      "Registration Channel" TEXT
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS duplicate_lead_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      incoming_lead_id INTEGER NOT NULL,
      matched_lead_id INTEGER NOT NULL,
      matched_field TEXT NOT NULL,
      incoming_value TEXT,
      matched_value TEXT,
      incoming_lead_name TEXT,
      matched_lead_name TEXT,
      matched_lead_ref TEXT,
      lead_inflow_source TEXT NOT NULL,
      raw_source_signal TEXT,
      user_registration_date TEXT,
      user_registration_date_ms INTEGER,
      initiated_by TEXT,
      event_status TEXT,
      deleted INTEGER NOT NULL DEFAULT 0,
      resolution_status TEXT DEFAULT NULL,
      resolved_at TEXT DEFAULT NULL,
      resolved_by TEXT DEFAULT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS duplication_settings (
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

  db.exec(`
    CREATE TABLE IF NOT EXISTS widget_ra_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      widget_name TEXT NOT NULL UNIQUE,
      ra_option TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS download_requests (
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

  db.exec(`
    CREATE TABLE IF NOT EXISTS lead_audit_trail (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      change_source TEXT NOT NULL,
      changed_by TEXT NOT NULL,
      changed_at TEXT NOT NULL,
      changed_at_ms INTEGER NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS lead_timeline_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      event_text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      created_at_ms INTEGER NOT NULL,
      created_by TEXT NOT NULL,
      fields_changed TEXT DEFAULT NULL
    );
  `);

  // Indexes
  db.exec('CREATE INDEX IF NOT EXISTS idx_dlr_incoming ON duplicate_lead_records (incoming_lead_id);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_dlr_matched  ON duplicate_lead_records (matched_lead_id);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_dlr_deleted  ON duplicate_lead_records (deleted);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_lat_lead     ON lead_audit_trail (lead_id);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_lte_lead     ON lead_timeline_events (lead_id);');

  // Seed settings on first run (empty table = fresh DB)
  const settingsCount = db.prepare('SELECT COUNT(*) c FROM duplication_settings').get();
  if (settingsCount.c === 0) {
    const now = new Date().toISOString();
    const ins = db.prepare(`
      INSERT INTO duplication_settings
        (source_key,source_label,ra_enabled,ra_options,ra_selected,report_eligible,report_enabled,special_config,modified_on,modified_by)
      VALUES (?,?,1,?,?,?,?,?,?,?)
    `);
    for (const [key,label,opts,sel,re,ren,sc] of DEFAULT_SOURCES) {
      ins.run(key, label, opts, sel, re, ren, sc, now, 'System Default');
    }
    const insW = db.prepare('INSERT OR IGNORE INTO widget_ra_config (widget_name,ra_option) VALUES (?,?)');
    for (const w of DEFAULT_WIDGETS) insW.run(w, 'Lead Create or Update');

    // Seed demo leads and duplicate records for the hosted prototype
    const insLead = db.prepare(`
      INSERT INTO leads ("Name","Registered Email","Registered Mobile","State","City","Lead Stage","User Registration Date","Lead Id","Lead Origin(Primary)","Widget Name","Source")
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `);
    const DEMO_LEADS = [
      ['Arjun Sharma',   'arjun@gmail.com',          '9876543210','Maharashtra','Mumbai',    'Prospect',  '2025-01-10','LID-DEMO-0001','Widget',       'UG PROGRAM',          'Google'],
      ['Arjun S',        'arjun.s@yahoo.com',         '9876543210','Maharashtra','Pune',      'New',       '2025-03-05','LID-DEMO-0002','Landing Page', null,                  'FB'],
      ['A Sharma',       'a.sharma@outlook.com',      '9876543210','Maharashtra','Nagpur',    'New',       '2025-04-18','LID-DEMO-0003','Widget',       'UG PROGRAM',          'Direct'],
      ['Priya Mehta',    'priya.mehta@gmail.com',     '8765432109','Karnataka',  'Bengaluru', 'Interested','2025-01-22','LID-DEMO-0004','Widget',       'New form(a)',          'Google'],
      ['Priya M',        'priya.mehta@gmail.com',     '9900112233','Karnataka',  'Mysuru',    'New',       '2025-05-30','LID-DEMO-0005','FB Lead',      null,                  'FB'],
      ['Ravi Kumar',     'ravi.kumar@rediffmail.com', '7654321098','Tamil Nadu', 'Chennai',   'Converted', '2025-02-14','LID-DEMO-0006','Add Quick Lead',null,                 null],
      ['Ravi K',         'rk@gmail.com',              '7654321098','Tamil Nadu', 'Coimbatore','New',       '2025-06-01','LID-DEMO-0007','Widget',       'Calling Widget',      'Direct'],
      ['Sunita Rao',     'sunita.rao@gmail.com',      '6543210987','Telangana',  'Hyderabad', 'Prospect',  '2025-03-09','LID-DEMO-0008','Google Lead',  null,                  'Google'],
      ['Deepak Verma',   'deepak.v@gmail.com',        '5432109876','Delhi',      'New Delhi', 'New',       '2025-04-22','LID-DEMO-0009','Zapier Lead',  null,                  null],
      ['Anjali Singh',   'anjali.singh@gmail.com',    '4321098765','UP',         'Lucknow',   'Interested','2025-01-05','LID-DEMO-0010','Widget',       'Scholarship Test Jan','Organic'],
      ['Anjali S',       'anjali.singh@gmail.com',    '9988776655','UP',         'Kanpur',    'New',       '2025-07-12','LID-DEMO-0011','Landing Page', null,                  'Google'],
      ['Karan Malhotra', 'karan.m@hotmail.com',       '3210987654','Punjab',     'Chandigarh','Prospect',  '2025-05-15','LID-DEMO-0012','Widget',       'IES Widget 1',        'Google'],
    ];
    for (const l of DEMO_LEADS) insLead.run(...l);

    const leadsCount = db.prepare('SELECT COUNT(*) c FROM leads').get();
    if (leadsCount.c > 0) {
      const insDup = db.prepare(`
        INSERT INTO duplicate_lead_records
          (incoming_lead_id,matched_lead_id,matched_field,incoming_value,matched_value,
           incoming_lead_name,matched_lead_name,matched_lead_ref,
           lead_inflow_source,user_registration_date,user_registration_date_ms,event_status,deleted)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0)
      `);
      const toMs = (d) => new Date(d).getTime();
      insDup.run(2,1,'Registered Mobile','9876543210','9876543210','Arjun S','Arjun Sharma','LID-DEMO-0001','Landing Page','2025-03-05',toMs('2025-03-05'),'Registration Attempt');
      insDup.run(3,1,'Registered Mobile','9876543210','9876543210','A Sharma','Arjun Sharma','LID-DEMO-0001','Widget','2025-04-18',toMs('2025-04-18'),'Registration Attempt');
      insDup.run(5,4,'Registered Email','priya.mehta@gmail.com','priya.mehta@gmail.com','Priya M','Priya Mehta','LID-DEMO-0004','FB Lead','2025-05-30',toMs('2025-05-30'),'Registration Attempt');
      insDup.run(7,6,'Registered Mobile','7654321098','7654321098','Ravi K','Ravi Kumar','LID-DEMO-0006','Widget','2025-06-01',toMs('2025-06-01'),'Registration Attempt');
      insDup.run(11,10,'Registered Email','anjali.singh@gmail.com','anjali.singh@gmail.com','Anjali S','Anjali Singh','LID-DEMO-0010','Landing Page','2025-07-12',toMs('2025-07-12'),'Registration Attempt');
    }
    console.log('First-run seed complete: settings + demo leads + duplicate records.');
  }

  db.exec('PRAGMA foreign_keys = ON;');
  return db;
}

module.exports = { openDb, DB_PATH };
