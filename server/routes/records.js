const express = require('express');
const { openDb } = require('../db/connection');
const { q } = require('../db/leadColumns');

const router = express.Router();

function buildFilters(query) {
  const clauses = ['deleted = 0'];
  const params = [];

  if (query.source) {
    const sources = String(query.source).split(',').filter(Boolean);
    if (sources.length) {
      clauses.push(`lead_inflow_source IN (${sources.map(() => '?').join(',')})`);
      params.push(...sources);
    }
  }
  if (query.uniqueField) {
    const fields = String(query.uniqueField).split(',').filter(Boolean);
    if (fields.length) {
      clauses.push(`matched_field IN (${fields.map(() => '?').join(',')})`);
      params.push(...fields);
    }
  }
  if (query.dateFrom) {
    clauses.push('user_registration_date_ms >= ?');
    params.push(Number(query.dateFrom));
  }
  if (query.dateTo) {
    clauses.push('user_registration_date_ms <= ?');
    params.push(Number(query.dateTo));
  }
  if (query.q) {
    const term = `%${String(query.q).trim()}%`;
    clauses.push(`(
      incoming_lead_name LIKE ? OR matched_lead_name LIKE ? OR matched_lead_ref LIKE ?
      OR incoming_value LIKE ? OR matched_value LIKE ?
    )`);
    params.push(term, term, term, term, term);
  }

  return { where: clauses.join(' AND '), params };
}

router.get('/', (req, res) => {
  const db = openDb();
  try {
    const { where, params } = buildFilters(req.query);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(20, Math.max(1, parseInt(req.query.pageSize, 10) || 10));
    const offset = (page - 1) * pageSize;

    const totalRow = db.prepare(`SELECT COUNT(*) c FROM duplicate_lead_records WHERE ${where}`).get(...params);
    const total = totalRow.c;

    const rows = db.prepare(`
      SELECT id, incoming_lead_id, matched_lead_id, matched_field, incoming_value, matched_value,
             incoming_lead_name, matched_lead_name, matched_lead_ref, lead_inflow_source,
             user_registration_date, user_registration_date_ms, initiated_by, event_status
      FROM duplicate_lead_records
      WHERE ${where}
      ORDER BY user_registration_date_ms DESC, id DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    res.json({
      total,
      page,
      pageSize,
      rows: rows.map(shapeRow),
    });
  } finally {
    db.close();
  }
});

router.get('/:id', (req, res) => {
  const db = openDb();
  try {
    const record = db.prepare('SELECT * FROM duplicate_lead_records WHERE id = ?').get(req.params.id);
    if (!record) return res.status(404).json({ error: 'Not found' });

    const leadCols = ['Registered Email', 'Registered Mobile', 'Aadhaar Card', 'Lead Id', 'Name'];
    const leadSelect = `SELECT id, ${leadCols.map(q).join(', ')} FROM leads WHERE id = ?`;
    const incomingLead = db.prepare(leadSelect).get(record.incoming_lead_id);
    const matchedLead = db.prepare(leadSelect).get(record.matched_lead_id);

    res.json({
      ...shapeRow(record),
      incomingLeadDetail: incomingLead,
      matchedLeadDetail: matchedLead,
    });
  } finally {
    db.close();
  }
});

router.post('/bulk-delete', (req, res) => {
  const db = openDb();
  try {
    const { ids = [] } = req.body;
    if (!ids.length) return res.status(400).json({ error: 'ids required' });
    const stmt = db.prepare('UPDATE duplicate_lead_records SET deleted = 1 WHERE id = ?');
    db.exec('BEGIN');
    for (const id of ids) stmt.run(id);
    db.exec('COMMIT');
    res.json({ ok: true, deletedCount: ids.length });
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    db.close();
  }
});

function shapeRow(r) {
  return {
    id: r.id,
    incomingLeadName: r.incoming_lead_name,
    matchedLeadName: r.matched_lead_name,
    matchedLeadRef: r.matched_lead_ref,
    matchedField: r.matched_field,
    incomingValue: r.incoming_value,
    matchedValue: r.matched_value,
    leadInflowSource: r.lead_inflow_source,
    userRegistrationDate: r.user_registration_date,
    initiatedBy: r.initiated_by,
    eventStatus: r.event_status,
  };
}

module.exports = router;
module.exports.buildFilters = buildFilters;
