// Computes real duplicate events from the imported `leads` table and populates
// `duplicate_lead_records`, applying the locked Unique Fields matching rules:
//   - case-insensitive, whitespace-trimmed, "NA"/blank excluded (no dedup on blank)
//   - mobile matching is dial-code aware
//   - match priority when multiple fields collide: Registered Mobile (PK) > Registered Email > Aadhaar Card
//   - match groups larger than MAX_GROUP_SIZE are excluded as reused test/placeholder values
//   - within a group, the earliest lead by User Registration Date is the "Matched Lead";
//     every later lead in the group is one "incoming duplicate" event against it
const { openDb } = require('../db/connection');
const { q } = require('../db/leadColumns');
const { normalizeEmail, mobileKey, formatMobileDisplay, normalizeAadhaar, parseRegistrationDate } = require('./normalize');
const { inferSource, EVENT_STATUS_BY_SOURCE, MANUAL_SOURCES } = require('./sourceMapping');

const MAX_GROUP_SIZE = 20;

function buildGroups(leads, keyFn) {
  const groups = new Map();
  for (const lead of leads) {
    const key = keyFn(lead);
    if (key === null) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(lead);
  }
  const kept = [];
  let droppedGroups = 0;
  let droppedRows = 0;
  for (const [key, members] of groups) {
    if (members.length < 2) continue;
    if (members.length > MAX_GROUP_SIZE) {
      droppedGroups++;
      droppedRows += members.length;
      continue;
    }
    members.sort((a, b) => {
      const da = a._regDateMs, db_ = b._regDateMs;
      if (da === null && db_ === null) return a.id - b.id;
      if (da === null) return 1;
      if (db_ === null) return -1;
      if (da !== db_) return da - db_;
      return a.id - b.id;
    });
    kept.push(members);
  }
  return { groups: kept, droppedGroups, droppedRows };
}

function main() {
  const db = openDb();

  console.log('Loading leads for matching...');
  const cols = [
    'id', 'Name', 'Registered Email', 'Registered Mobile', 'Aadhaar Card',
    'User Registration Date', 'Lead Id', 'Created By', 'Lead Origin(Primary)',
    'Primary Traffic Channel', 'Publisher Name', 'Widget Name', 'Registration Channel',
  ];
  const selectSql = `SELECT ${cols.map(q).join(', ')} FROM leads`;
  const leads = db.prepare(selectSql).all();
  console.log(`Loaded ${leads.length} leads.`);

  for (const lead of leads) {
    lead._regDateMs = parseRegistrationDate(lead['User Registration Date']);
  }

  // Created By volume counts feed the Add Quick Lead vs AM/Single Upload heuristic.
  const createdByCounts = new Map();
  for (const lead of leads) {
    const cb = (lead['Created By'] || '').trim();
    createdByCounts.set(cb, (createdByCounts.get(cb) || 0) + 1);
  }

  console.log('Grouping by Registered Mobile...');
  const mobileGrouping = buildGroups(leads, (l) => mobileKey(l['Registered Mobile']));
  console.log(`  ${mobileGrouping.groups.length} mobile groups kept, ${mobileGrouping.droppedGroups} dropped (>${MAX_GROUP_SIZE} members, ${mobileGrouping.droppedRows} rows).`);

  console.log('Grouping by Registered Email...');
  const emailGrouping = buildGroups(leads, (l) => normalizeEmail(l['Registered Email']));
  console.log(`  ${emailGrouping.groups.length} email groups kept, ${emailGrouping.droppedGroups} dropped (>${MAX_GROUP_SIZE} members, ${emailGrouping.droppedRows} rows).`);

  console.log('Grouping by Aadhaar Card...');
  const aadhaarGrouping = buildGroups(leads, (l) => normalizeAadhaar(l['Aadhaar Card']));
  console.log(`  ${aadhaarGrouping.groups.length} aadhaar groups kept, ${aadhaarGrouping.droppedGroups} dropped (>${MAX_GROUP_SIZE} members, ${aadhaarGrouping.droppedRows} rows).`);

  // Priority when a lead qualifies as a duplicate on more than one field: Mobile (PK) > Email > Aadhaar.
  // anchorFor[field] maps incoming lead id -> anchor (matched/existing) lead, for leads that are
  // NOT the earliest member of their group.
  const anchorByMobile = new Map();
  for (const group of mobileGrouping.groups) {
    const anchor = group[0];
    for (let i = 1; i < group.length; i++) anchorByMobile.set(group[i].id, anchor);
  }
  const anchorByEmail = new Map();
  for (const group of emailGrouping.groups) {
    const anchor = group[0];
    for (let i = 1; i < group.length; i++) anchorByEmail.set(group[i].id, anchor);
  }
  const anchorByAadhaar = new Map();
  for (const group of aadhaarGrouping.groups) {
    const anchor = group[0];
    for (let i = 1; i < group.length; i++) anchorByAadhaar.set(group[i].id, anchor);
  }

  console.log('Resolving one duplicate event per incoming lead (Mobile > Email > Aadhaar priority)...');
  const records = [];
  for (const lead of leads) {
    let matchedField, matchedLead, incomingValue, matchedValue;
    if (anchorByMobile.has(lead.id)) {
      matchedField = 'Registered Mobile';
      matchedLead = anchorByMobile.get(lead.id);
      incomingValue = formatMobileDisplay(lead['Registered Mobile']);
      matchedValue = formatMobileDisplay(matchedLead['Registered Mobile']);
    } else if (anchorByEmail.has(lead.id)) {
      matchedField = 'Registered Email';
      matchedLead = anchorByEmail.get(lead.id);
      incomingValue = lead['Registered Email'].trim();
      matchedValue = matchedLead['Registered Email'].trim();
    } else if (anchorByAadhaar.has(lead.id)) {
      matchedField = 'Aadhaar Card';
      matchedLead = anchorByAadhaar.get(lead.id);
      incomingValue = lead['Aadhaar Card'].trim();
      matchedValue = matchedLead['Aadhaar Card'].trim();
    } else {
      continue;
    }

    const { source, signal } = inferSource(lead, createdByCounts);
    const eventStatus = EVENT_STATUS_BY_SOURCE[source] || 'Registration Attempt';
    const initiatedBy = MANUAL_SOURCES.has(source) ? (lead['Created By'] || null) : null;

    records.push({
      incoming_lead_id: lead.id,
      matched_lead_id: matchedLead.id,
      matched_field: matchedField,
      incoming_value: incomingValue,
      matched_value: matchedValue,
      incoming_lead_name: lead['Name'],
      matched_lead_name: matchedLead['Name'],
      matched_lead_ref: matchedLead['Lead Id'],
      lead_inflow_source: source,
      raw_source_signal: signal,
      user_registration_date: lead['User Registration Date'],
      initiated_by: initiatedBy,
      event_status: eventStatus,
    });
  }
  console.log(`Resolved ${records.length} duplicate lead record events.`);

  console.log('Creating duplicate_lead_records table...');
  db.exec('DROP TABLE IF EXISTS duplicate_lead_records;');
  db.exec(`
    CREATE TABLE duplicate_lead_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      incoming_lead_id INTEGER NOT NULL REFERENCES leads(id),
      matched_lead_id INTEGER NOT NULL REFERENCES leads(id),
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
      deleted INTEGER NOT NULL DEFAULT 0
    );
  `);

  const insertSql = `
    INSERT INTO duplicate_lead_records (
      incoming_lead_id, matched_lead_id, matched_field, incoming_value, matched_value,
      incoming_lead_name, matched_lead_name, matched_lead_ref, lead_inflow_source,
      raw_source_signal, user_registration_date, user_registration_date_ms, initiated_by, event_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const insertStmt = db.prepare(insertSql);
  const leadsById = new Map(leads.map((l) => [l.id, l]));

  db.exec('BEGIN');
  for (const r of records) {
    const leadForMs = leadsById.get(r.incoming_lead_id);
    insertStmt.run(
      r.incoming_lead_id, r.matched_lead_id, r.matched_field, r.incoming_value, r.matched_value,
      r.incoming_lead_name, r.matched_lead_name, r.matched_lead_ref, r.lead_inflow_source,
      r.raw_source_signal, r.user_registration_date, leadForMs ? leadForMs._regDateMs : null,
      r.initiated_by, r.event_status
    );
  }
  db.exec('COMMIT');

  console.log('Creating indexes...');
  db.exec('CREATE INDEX idx_dlr_source ON duplicate_lead_records (lead_inflow_source);');
  db.exec('CREATE INDEX idx_dlr_field ON duplicate_lead_records (matched_field);');
  db.exec('CREATE INDEX idx_dlr_date ON duplicate_lead_records (user_registration_date_ms);');
  db.exec('CREATE INDEX idx_dlr_deleted ON duplicate_lead_records (deleted);');

  const bySource = db.prepare('SELECT lead_inflow_source, COUNT(*) c FROM duplicate_lead_records GROUP BY lead_inflow_source ORDER BY c DESC').all();
  console.log('\nDuplicate records by inferred source:');
  for (const row of bySource) console.log(`  ${row.lead_inflow_source}: ${row.c}`);

  db.close();
  console.log('\nDone.');
}

main();
