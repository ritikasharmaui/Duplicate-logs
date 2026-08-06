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

router.get('/:id/timeline', (req, res) => {
  const db = openDb();
  try {
    const rows = db.prepare(
      'SELECT * FROM lead_timeline_events WHERE lead_id = ? ORDER BY created_at_ms DESC'
    ).all(req.params.id);
    res.json({
      rows: rows.map((r) => ({
        id: r.id,
        eventType: r.event_type,
        eventText: r.event_text,
        createdAt: r.created_at,
        createdAtMs: r.created_at_ms,
        createdBy: r.created_by,
        fieldsChanged: r.fields_changed ? JSON.parse(r.fields_changed) : [],
      })),
    });
  } finally {
    db.close();
  }
});

// A lead can be the "matched" (anchor) side of many incoming duplicates at once - the
// detection engine anchors every group to its earliest-registered member (see
// build_duplicates.js), so a popular email/mobile can anchor up to MAX_GROUP_SIZE-1 duplicates.
// This endpoint collapses that N-way group into per-field value clusters (instead of N pairwise
// diffs) so the UI can offer one "which value wins" choice per field, with a count of how many
// duplicate leads carried each value, regardless of how large the group is.
router.get('/:id/duplicate-group', (req, res) => {
  const db = openDb();
  try {
    const leadId = Number(req.params.id);
    const anchor = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
    if (!anchor) return res.status(404).json({ error: 'Lead not found' });

    const dupRows = db.prepare(`
      SELECT * FROM duplicate_lead_records WHERE deleted = 0 AND matched_lead_id = ? ORDER BY id ASC
    `).all(leadId);

    if (dupRows.length === 0) {
      return res.json({ matchedField: null, duplicates: [], fieldsToReview: [] });
    }

    const duplicates = dupRows
      .map((r) => ({
        duplicateRecordId: r.id,
        leadId: r.incoming_lead_id,
        lead: db.prepare('SELECT * FROM leads WHERE id = ?').get(r.incoming_lead_id),
        leadInflowSource: r.lead_inflow_source,
        userRegistrationDate: r.user_registration_date,
      }))
      .filter((d) => d.lead);

    const columns = Object.keys(anchor).filter((k) => k !== 'id');
    const fieldsToReview = [];
    for (const field of columns) {
      const clusters = new Map(); // trimmed value -> { value, leadIds: [] }
      const addValue = (leadIdForValue, rawValue) => {
        const value = (rawValue || '').trim();
        if (!clusters.has(value)) clusters.set(value, { value, leadIds: [] });
        clusters.get(value).leadIds.push(leadIdForValue);
      };
      addValue(anchor.id, anchor[field]);
      for (const d of duplicates) addValue(d.leadId, d.lead[field]);

      if (clusters.size <= 1) continue; // every lead in the group agrees - nothing to reconcile

      const options = [...clusters.values()]
        .map((c) => ({ value: c.value, isAnchor: c.leadIds.includes(anchor.id), leadIds: c.leadIds, count: c.leadIds.length }))
        .sort((a, b) => (b.isAnchor - a.isAnchor) || (b.count - a.count));

      fieldsToReview.push({ field, options });
    }

    res.json({
      matchedField: dupRows[0].matched_field,
      duplicates: duplicates.map((d) => ({
        duplicateRecordId: d.duplicateRecordId,
        leadId: d.leadId,
        name: d.lead['Name'],
        matchedValue: d.lead[dupRows[0].matched_field],
        leadInflowSource: d.leadInflowSource,
        userRegistrationDate: d.userRegistrationDate,
      })),
      fieldsToReview,
    });
  } finally {
    db.close();
  }
});

router.post('/:id/merge-group', (req, res) => {
  const db = openDb();
  try {
    const leadId = Number(req.params.id);
    const { duplicateRecordIds = [], fieldSelections = [] } = req.body;
    if (!Array.isArray(duplicateRecordIds) || duplicateRecordIds.length === 0) {
      return res.status(400).json({ error: 'No duplicate records selected' });
    }

    const anchor = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
    if (!anchor) return res.status(404).json({ error: 'Lead not found' });

    const placeholders = duplicateRecordIds.map(() => '?').join(',');
    const dupRows = db.prepare(`
      SELECT * FROM duplicate_lead_records WHERE deleted = 0 AND matched_lead_id = ? AND id IN (${placeholders})
    `).all(leadId, ...duplicateRecordIds);
    if (dupRows.length !== duplicateRecordIds.length) {
      return res.status(400).json({ error: 'One or more duplicate records are invalid for this lead' });
    }

    const involvedLeadIds = new Set([leadId, ...dupRows.map((r) => r.incoming_lead_id)]);
    const validColumns = new Set(Object.keys(anchor).filter((k) => k !== 'id'));
    const leadsById = new Map([[leadId, anchor]]);
    for (const id of involvedLeadIds) {
      if (!leadsById.has(id)) leadsById.set(id, db.prepare('SELECT * FROM leads WHERE id = ?').get(id));
    }

    // Never trust client-sent values - only (field, sourceLeadId) pairs are honored, and both
    // are re-resolved against freshly-read rows so the values actually written always come from the DB.
    const changes = [];
    for (const sel of fieldSelections) {
      const sourceLeadId = Number(sel.sourceLeadId);
      if (!validColumns.has(sel.field) || !involvedLeadIds.has(sourceLeadId)) continue;
      const sourceLead = leadsById.get(sourceLeadId);
      if (!sourceLead) continue;
      const oldValue = anchor[sel.field];
      const newValue = sourceLead[sel.field];
      if ((oldValue || '').trim() !== (newValue || '').trim()) {
        changes.push({ field: sel.field, oldValue, newValue });
      }
    }

    // Turn FK off before BEGIN so the pragma takes effect for the whole transaction.
    // We keep the resolved duplicate_lead_records rows (they get resolution_status='updated')
    // and delete the incoming lead rows directly, which would otherwise violate the FK.
    db.exec('PRAGMA foreign_keys = OFF;');
    db.exec('BEGIN');

    const now = new Date();

    if (changes.length) {
      const setSql = changes.map((c) => `${q(c.field)} = ?`).join(', ');
      db.prepare(`UPDATE leads SET ${setSql} WHERE id = ?`).run(...changes.map((c) => c.newValue), leadId);

      const insertAudit = db.prepare(`
        INSERT INTO lead_audit_trail (lead_id, field_name, old_value, new_value, change_source, changed_by, changed_at, changed_at_ms)
        VALUES (?, ?, ?, ?, 'duplicate_group_merge', 'Ritika Sharma', ?, ?)
      `);
      for (const c of changes) {
        insertAudit.run(leadId, c.field, c.oldValue, c.newValue, now.toISOString(), now.getTime());
      }
    }

    // Mark the resolved records with resolution_status='updated' so the listing can
    // display them as disabled rows instead of hiding them.
    const markResolved = db.prepare(
      'UPDATE duplicate_lead_records SET resolution_status=?, resolved_at=?, resolved_by=? WHERE id=?'
    );
    for (const id of duplicateRecordIds) {
      markResolved.run('updated', now.toISOString(), 'Ritika Sharma', id);
    }

    // Write a timeline event on the anchor lead so the Timeline tab can surface it.
    const fieldsChangedJson = JSON.stringify(changes.map((c) => ({ field: c.field, oldValue: c.oldValue, newValue: c.newValue })));
    const eventText = changes.length > 0
      ? `Ritika Sharma resolved ${duplicateRecordIds.length} duplicate lead${duplicateRecordIds.length === 1 ? '' : 's'} — ${changes.length} field${changes.length === 1 ? '' : 's'} updated`
      : `Ritika Sharma resolved ${duplicateRecordIds.length} duplicate lead${duplicateRecordIds.length === 1 ? '' : 's'} — no field changes`;
    db.prepare(
      'INSERT INTO lead_timeline_events (lead_id, event_type, event_text, created_at, created_at_ms, created_by, fields_changed) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(leadId, 'duplicate_resolved', eventText, now.toISOString(), now.getTime(), 'Ritika Sharma', fieldsChangedJson);

    const removedLeadIds = dupRows.map((r) => r.incoming_lead_id);
    for (const otherLeadId of removedLeadIds) {
      // Delete only the non-resolved records for this incoming lead (e.g. cases where it was
      // also a matched_lead for some other record). The resolved records we just marked stay.
      db.prepare(
        'DELETE FROM duplicate_lead_records WHERE (incoming_lead_id = ? OR matched_lead_id = ?) AND resolution_status IS NULL'
      ).run(otherLeadId, otherLeadId);
      db.prepare('DELETE FROM leads WHERE id = ?').run(otherLeadId);
    }

    db.exec('COMMIT');
    db.exec('PRAGMA foreign_keys = ON;');

    res.json({ ok: true, removedLeadIds, fieldsChanged: changes.length });
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    db.close();
  }
});

module.exports = router;
