const express = require('express');
const fs = require('fs');
const path = require('path');
const { openDb } = require('../db/connection');
const { q } = require('../db/leadColumns');
const { buildFilters } = require('./records');

const router = express.Router();
const DOWNLOADS_DIR = path.join(__dirname, '..', 'downloads');

const COLUMN_DEFS = {
  'Incoming Duplicate Lead Name': (r) => r.incoming_lead_name,
  'Incoming Duplicate Lead Number': (r) => r.incoming_value,
  'Matched Lead Name': (r) => r.matched_lead_name,
  'Matched Lead ID': (r) => r.matched_lead_ref,
  'Matched Unique Field': (r) => r.matched_field,
  'User Registration Date': (r) => r.user_registration_date,
  'Lead Inflow Source': (r) => r.lead_inflow_source,
  'Source (UTM)': (r) => r._incomingLead ? r._incomingLead['Source'] : '',
  Medium: () => '',
  Campaign: (r) => r._incomingLead ? r._incomingLead['Utm Campaignid'] : '',
  'Custom Lead Field': () => '',
  'Initiated By': (r) => r.initiated_by || '',
  'Primary Registration Campaign': (r) => r._incomingLead ? r._incomingLead['Primary Registration Campaign'] : '',
  'Event Status': (r) => r.event_status,
  'Secondary Registration Campaign': (r) => r._incomingLead ? r._incomingLead['Secondary Registration Campaign'] : '',
};

const DEFAULT_COLUMNS = [
  'Incoming Duplicate Lead Name', 'Incoming Duplicate Lead Number', 'Matched Lead Name',
  'Matched Lead ID', 'Matched Unique Field', 'User Registration Date', 'Lead Inflow Source',
];

function csvEscape(value) {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

router.get('/', (req, res) => {
  const db = openDb();
  try {
    const rows = db.prepare('SELECT * FROM download_requests ORDER BY id DESC').all();
    res.json({ rows });
  } finally {
    db.close();
  }
});

router.post('/', (req, res) => {
  const db = openDb();
  try {
    const { columns = DEFAULT_COLUMNS, filters = {}, requestedBy = 'Admin' } = req.body;
    const selectedColumns = columns.filter((c) => COLUMN_DEFS[c]);
    if (!selectedColumns.length) return res.status(400).json({ error: 'No valid columns selected' });

    const { where, params } = buildFilters(filters);
    const records = db.prepare(`
      SELECT * FROM duplicate_lead_records WHERE ${where} ORDER BY user_registration_date_ms DESC
    `).all(...params);

    const needsLeadJoin = selectedColumns.some((c) =>
      ['Source (UTM)', 'Campaign', 'Primary Registration Campaign', 'Secondary Registration Campaign'].includes(c)
    );
    if (needsLeadJoin) {
      const leadSelect = `SELECT id, ${['Source', 'Utm Campaignid', 'Primary Registration Campaign', 'Secondary Registration Campaign'].map(q).join(', ')} FROM leads WHERE id = ?`;
      const stmt = db.prepare(leadSelect);
      for (const r of records) r._incomingLead = stmt.get(r.incoming_lead_id);
    }

    const lines = [selectedColumns.map(csvEscape).join(',')];
    for (const r of records) {
      lines.push(selectedColumns.map((c) => csvEscape(COLUMN_DEFS[c](r))).join(','));
    }
    const csvContent = lines.join('\n');

    const now = new Date().toISOString();
    const insert = db.prepare(`
      INSERT INTO download_requests (requested_by, requested_at, status, columns_json, filters_json, row_count, file_name)
      VALUES (?, ?, 'Ready', ?, ?, ?, ?)
    `);
    const info = insert.run(requestedBy, now, JSON.stringify(selectedColumns), JSON.stringify(filters), records.length, '');
    const id = info.lastInsertRowid;
    const fileName = `duplicate_lead_records_${id}.csv`;

    if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
    fs.writeFileSync(path.join(DOWNLOADS_DIR, fileName), csvContent, 'utf-8');
    db.prepare('UPDATE download_requests SET file_name = ? WHERE id = ?').run(fileName, id);

    res.json({ id, status: 'Ready', rowCount: records.length, fileUrl: `/api/download-requests/${id}/file` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    db.close();
  }
});

router.get('/:id/file', (req, res) => {
  const db = openDb();
  try {
    const request = db.prepare('SELECT * FROM download_requests WHERE id = ?').get(req.params.id);
    if (!request || !request.file_name) return res.status(404).json({ error: 'Not found' });
    const filePath = path.join(DOWNLOADS_DIR, request.file_name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing' });
    res.setHeader('Content-Disposition', `attachment; filename="${request.file_name}"`);
    res.setHeader('Content-Type', 'text/csv');
    fs.createReadStream(filePath).pipe(res);
  } finally {
    db.close();
  }
});

module.exports = router;
