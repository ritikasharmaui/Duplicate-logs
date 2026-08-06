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
    const sf = query.searchField;
    if (sf === 'email' || sf === 'mobile') {
      clauses.push('incoming_value LIKE ?');
      params.push(term);
    } else if (sf === 'name') {
      clauses.push('(incoming_lead_name LIKE ? OR matched_lead_name LIKE ?)');
      params.push(term, term);
    } else if (sf === 'lead_id') {
      clauses.push('matched_lead_ref LIKE ?');
      params.push(term);
    } else {
      clauses.push(`(incoming_lead_name LIKE ? OR matched_lead_name LIKE ? OR matched_lead_ref LIKE ? OR incoming_value LIKE ? OR matched_value LIKE ?)`);
      params.push(term, term, term, term, term);
    }
  }

  return { where: clauses.join(' AND '), params };
}

// Main listing — grouped by incoming lead (one row per incoming lead)
router.get('/', (req, res) => {
  const db = openDb();
  try {
    const { where, params } = buildFilters(req.query);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(20, Math.max(1, parseInt(req.query.pageSize, 10) || 10));
    const offset = (page - 1) * pageSize;

    const totalRow = db.prepare(
      `SELECT COUNT(DISTINCT incoming_lead_id) c FROM duplicate_lead_records WHERE ${where}`
    ).get(...params);
    const total = totalRow.c;

    const rows = db.prepare(`
      SELECT
        MIN(id) AS id,
        incoming_lead_id,
        incoming_lead_name,
        incoming_value,
        lead_inflow_source,
        MIN(user_registration_date) AS user_registration_date,
        MIN(user_registration_date_ms) AS user_registration_date_ms,
        COUNT(*) AS match_count,
        MIN(matched_lead_id) AS matched_lead_id,
        MIN(matched_lead_name) AS matched_lead_name,
        MIN(matched_lead_ref) AS matched_lead_ref,
        MIN(matched_field) AS matched_field,
        MIN(matched_value) AS matched_value,
        MIN(event_status) AS event_status,
        MIN(initiated_by) AS initiated_by,
        MIN(resolution_status) AS resolution_status,
        MIN(resolved_at) AS resolved_at,
        MIN(resolved_by) AS resolved_by
      FROM duplicate_lead_records
      WHERE ${where}
      GROUP BY incoming_lead_id
      ORDER BY MIN(user_registration_date_ms) DESC, MIN(id) DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    res.json({ total, page, pageSize, rows: rows.map(shapeGroupedRow) });
  } finally {
    db.close();
  }
});

// All matched leads for a given incoming lead (for drawer multi-match view)
router.get('/matches/:incomingLeadId', (req, res) => {
  const db = openDb();
  try {
    const matches = db.prepare(`
      SELECT id, matched_lead_id, matched_lead_name, matched_lead_ref,
             matched_field, matched_value, incoming_value, resolution_status
      FROM duplicate_lead_records
      WHERE incoming_lead_id = ? AND deleted = 0
      ORDER BY id
    `).all(req.params.incomingLeadId);
    res.json({
      matches: matches.map((m) => ({
        id: m.id,
        matchedLeadId: m.matched_lead_id,
        matchedLeadName: m.matched_lead_name,
        matchedLeadRef: m.matched_lead_ref,
        matchedField: m.matched_field,
        matchedValue: m.matched_value,
        incomingValue: m.incoming_value,
        resolutionStatus: m.resolution_status || null,
      })),
    });
  } finally {
    db.close();
  }
});

// Single record detail (kept for compatibility with lead profile context)
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
      ...shapeGroupedRow({ ...record, match_count: 1 }),
      incomingLeadDetail: incomingLead,
      matchedLeadDetail: matchedLead,
    });
  } finally {
    db.close();
  }
});

// Bulk soft-delete — accepts incoming_lead_ids to delete all records per group
router.post('/bulk-delete', (req, res) => {
  const db = openDb();
  try {
    const { incoming_lead_ids = [] } = req.body;
    if (!incoming_lead_ids.length) return res.status(400).json({ error: 'incoming_lead_ids required' });
    const ph = incoming_lead_ids.map(() => '?').join(',');
    db.prepare(
      `UPDATE duplicate_lead_records SET deleted = 1 WHERE incoming_lead_id IN (${ph})`
    ).run(...incoming_lead_ids);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    db.close();
  }
});

function shapeGroupedRow(r) {
  return {
    id: r.id,
    incomingLeadId: r.incoming_lead_id,
    incomingLeadName: r.incoming_lead_name,
    incomingValue: r.incoming_value,
    matchCount: r.match_count || 1,
    matchedLeadId: r.matched_lead_id,
    matchedLeadName: r.matched_lead_name,
    matchedLeadRef: r.matched_lead_ref,
    matchedField: r.matched_field,
    matchedValue: r.matched_value,
    leadInflowSource: r.lead_inflow_source,
    userRegistrationDate: r.user_registration_date,
    initiatedBy: r.initiated_by || null,
    eventStatus: r.event_status,
    resolutionStatus: r.resolution_status || null,
    resolvedAt: r.resolved_at || null,
    resolvedBy: r.resolved_by || null,
  };
}

module.exports = router;
module.exports.buildFilters = buildFilters;
