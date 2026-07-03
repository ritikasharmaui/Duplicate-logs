const express = require('express');
const { openDb } = require('../db/connection');
const { q } = require('../db/leadColumns');

const router = express.Router();

const APPLICANT_COLUMNS = [
  'Name', 'Registered Email', 'Registered Mobile', 'State', 'City',
  'Lead Stage', 'User Registration Date', 'Lead Id',
];

// Two single-column EXISTS clauses, not one OR'd across both columns - SQLite can only use
// idx_dlr_incoming/idx_dlr_matched as index seeks this way. The OR'd-single-EXISTS form made
// the planner fall back to idx_dlr_deleted (near-useless, almost every row has deleted=0) and
// linear-scan duplicate_lead_records per lead - 115k leads x ~90k rows, a multi-minute query.
const DUPLICATE_EXISTS_SQL = `(
  EXISTS (SELECT 1 FROM duplicate_lead_records d WHERE d.deleted = 0 AND d.incoming_lead_id = leads.id)
  OR EXISTS (SELECT 1 FROM duplicate_lead_records d WHERE d.deleted = 0 AND d.matched_lead_id = leads.id)
)`;

function buildListFilters(query) {
  const clauses = [];
  const params = [];

  if (query.q) {
    const term = `%${String(query.q).trim()}%`;
    clauses.push(`(
      ${q('Name')} LIKE ? OR ${q('Registered Email')} LIKE ? OR ${q('Registered Mobile')} LIKE ? OR ${q('Lead Id')} LIKE ?
    )`);
    params.push(term, term, term, term);
  }
  if (query.state) {
    clauses.push(`${q('State')} = ?`);
    params.push(query.state);
  }
  if (query.stage) {
    clauses.push(`${q('Lead Stage')} = ?`);
    params.push(query.stage);
  }
  if (query.hasDuplicate === 'yes') clauses.push(DUPLICATE_EXISTS_SQL);
  if (query.hasDuplicate === 'no') clauses.push(`NOT ${DUPLICATE_EXISTS_SQL}`);

  return { where: clauses.length ? clauses.join(' AND ') : '1=1', params };
}

router.get('/facets', (req, res) => {
  const db = openDb();
  try {
    const states = db.prepare(
      `SELECT DISTINCT ${q('State')} v FROM leads WHERE TRIM(${q('State')}) <> '' ORDER BY v LIMIT 200`
    ).all().map((r) => r.v);
    const stages = db.prepare(
      `SELECT DISTINCT ${q('Lead Stage')} v FROM leads WHERE TRIM(${q('Lead Stage')}) <> '' ORDER BY v LIMIT 200`
    ).all().map((r) => r.v);
    res.json({ states, stages });
  } finally {
    db.close();
  }
});

router.get('/', (req, res) => {
  const db = openDb();
  try {
    const { where, params } = buildListFilters(req.query);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(20, Math.max(1, parseInt(req.query.pageSize, 10) || 10));
    const offset = (page - 1) * pageSize;

    const totalRow = db.prepare(`SELECT COUNT(*) c FROM leads WHERE ${where}`).get(...params);
    const total = totalRow.c;

    // leads has no precomputed ms-date column like duplicate_lead_records, so id (insertion order) stands in for recency.
    const rows = db.prepare(`
      SELECT id, ${q('Name')} name, ${q('Registered Email')} email, ${q('Registered Mobile')} mobile,
             ${q('State')} state, ${q('City')} city, ${q('User Registration Date')} regDate,
             ${q('Lead Stage')} leadStage, ${DUPLICATE_EXISTS_SQL} hasDuplicate
      FROM leads
      WHERE ${where}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    res.json({
      total,
      page,
      pageSize,
      rows: rows.map((r) => ({ ...r, hasDuplicate: !!r.hasDuplicate })),
    });
  } finally {
    db.close();
  }
});

router.get('/:id', (req, res) => {
  const db = openDb();
  try {
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const applicant = {
      id: lead.id,
      name: lead['Name'],
      email: lead['Registered Email'],
      mobile: lead['Registered Mobile'],
      state: lead['State'],
      city: lead['City'],
      leadStage: lead['Lead Stage'],
      userRegistrationDate: lead['User Registration Date'],
      leadId: lead['Lead Id'],
    };

    const allFields = Object.keys(lead)
      .filter((k) => k !== 'id' && !APPLICANT_COLUMNS.includes(k))
      .map((k) => ({ label: k, value: (lead[k] || '').trim() }))
      .filter((f) => f.value && f.value.toUpperCase() !== 'NA');

    const dupRows = db.prepare(`
      SELECT * FROM duplicate_lead_records
      WHERE deleted = 0 AND (incoming_lead_id = ? OR matched_lead_id = ?)
      ORDER BY id DESC
    `).all(lead.id, lead.id);

    const duplicateMatches = dupRows.map((r) => {
      const isMatched = Number(r.matched_lead_id) === Number(lead.id);
      return {
        duplicateRecordId: r.id,
        role: isMatched ? 'matched' : 'incoming',
        otherLeadId: isMatched ? r.incoming_lead_id : r.matched_lead_id,
        otherLeadName: isMatched ? r.incoming_lead_name : r.matched_lead_name,
        matchedField: r.matched_field,
        incomingValue: r.incoming_value,
        matchedValue: r.matched_value,
        leadInflowSource: r.lead_inflow_source,
        userRegistrationDate: r.user_registration_date,
      };
    });

    res.json({ applicant, allFields, duplicateMatches });
  } finally {
    db.close();
  }
});

router.get('/:id/audit-trail', (req, res) => {
  const db = openDb();
  try {
    const rows = db.prepare(
      'SELECT * FROM lead_audit_trail WHERE lead_id = ? ORDER BY changed_at_ms DESC'
    ).all(req.params.id);
    res.json({ rows });
  } finally {
    db.close();
  }
});

router.get('/:id/compare/:duplicateRecordId', (req, res) => {
  const db = openDb();
  try {
    const leadId = Number(req.params.id);
    const record = db.prepare(
      'SELECT * FROM duplicate_lead_records WHERE id = ? AND deleted = 0'
    ).get(req.params.duplicateRecordId);
    if (!record) return res.status(404).json({ error: 'Duplicate record not found' });
    if (Number(record.matched_lead_id) !== leadId) {
      return res.status(400).json({ error: 'This lead is not the original side of this duplicate match' });
    }

    const otherLeadId = record.incoming_lead_id;
    const original = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
    const duplicate = db.prepare('SELECT * FROM leads WHERE id = ?').get(otherLeadId);
    if (!original || !duplicate) return res.status(404).json({ error: 'Lead not found' });

    const fields = Object.keys(original)
      .filter((k) => k !== 'id')
      .map((k) => ({
        field: k,
        originalValue: (original[k] || '').trim(),
        duplicateValue: (duplicate[k] || '').trim(),
      }))
      .filter((f) => f.originalValue !== f.duplicateValue && (f.originalValue || f.duplicateValue));

    const cascadeRow = db.prepare(`
      SELECT COUNT(*) c FROM duplicate_lead_records
      WHERE deleted = 0 AND id != ? AND (incoming_lead_id = ? OR matched_lead_id = ?)
    `).get(record.id, otherLeadId, otherLeadId);

    res.json({
      otherLeadId,
      otherLeadName: duplicate['Name'],
      fields,
      cascadeCount: cascadeRow.c,
    });
  } finally {
    db.close();
  }
});

router.post('/:id/merge-from-duplicate', (req, res) => {
  const db = openDb();
  try {
    const leadId = Number(req.params.id);
    const { duplicateRecordId, fieldSelections = [] } = req.body;

    const record = db.prepare(
      'SELECT * FROM duplicate_lead_records WHERE id = ? AND deleted = 0'
    ).get(duplicateRecordId);
    if (!record) return res.status(404).json({ error: 'Duplicate record not found' });
    if (Number(record.matched_lead_id) !== leadId) {
      return res.status(400).json({ error: 'This lead is not the original side of this duplicate match' });
    }

    const otherLeadId = record.incoming_lead_id;
    const original = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
    const duplicate = db.prepare('SELECT * FROM leads WHERE id = ?').get(otherLeadId);
    if (!original || !duplicate) return res.status(404).json({ error: 'Lead not found' });

    // Never trust client-sent values - only the chosen field names are honored, and this
    // server re-reads both leads fresh so the values actually written always come from the DB.
    const validColumns = new Set(Object.keys(original).filter((k) => k !== 'id'));
    const changes = [];
    for (const sel of fieldSelections) {
      if (sel.source !== 'duplicate' || !validColumns.has(sel.field)) continue;
      const oldValue = original[sel.field];
      const newValue = duplicate[sel.field];
      if ((oldValue || '').trim() !== (newValue || '').trim()) {
        changes.push({ field: sel.field, oldValue, newValue });
      }
    }

    db.exec('BEGIN');

    if (changes.length) {
      const setSql = changes.map((c) => `${q(c.field)} = ?`).join(', ');
      db.prepare(`UPDATE leads SET ${setSql} WHERE id = ?`).run(...changes.map((c) => c.newValue), leadId);

      const now = new Date();
      const insertAudit = db.prepare(`
        INSERT INTO lead_audit_trail (lead_id, field_name, old_value, new_value, change_source, changed_by, changed_at, changed_at_ms)
        VALUES (?, ?, ?, ?, 'duplicate_merge', 'Ritika Sharma', ?, ?)
      `);
      for (const c of changes) {
        insertAudit.run(leadId, c.field, c.oldValue, c.newValue, now.toISOString(), now.getTime());
      }
    }

    const removedRow = db.prepare(
      'SELECT COUNT(*) c FROM duplicate_lead_records WHERE incoming_lead_id = ? OR matched_lead_id = ?'
    ).get(otherLeadId, otherLeadId);
    // Every duplicate_lead_records row referencing the other lead must go first - the FK
    // (PRAGMA foreign_keys = ON) blocks deleting a leads row that's still referenced.
    db.prepare('DELETE FROM duplicate_lead_records WHERE incoming_lead_id = ? OR matched_lead_id = ?').run(otherLeadId, otherLeadId);
    db.prepare('DELETE FROM leads WHERE id = ?').run(otherLeadId);

    db.exec('COMMIT');

    res.json({
      ok: true,
      removedLeadId: otherLeadId,
      removedDuplicateRecords: removedRow.c,
      fieldsChanged: changes.length,
    });
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    db.close();
  }
});

module.exports = router;
