const express = require('express');
const { openDb } = require('../db/connection');

const router = express.Router();

router.get('/', (req, res) => {
  const db = openDb();
  try {
    const sources = db.prepare('SELECT * FROM duplication_settings ORDER BY rowid').all();
    const counts = db.prepare(`
      SELECT lead_inflow_source, COUNT(*) c
      FROM duplicate_lead_records
      WHERE deleted = 0
      GROUP BY lead_inflow_source
    `).all();
    const countBySource = new Map(counts.map((c) => [c.lead_inflow_source, c.c]));

    const widgets = db.prepare('SELECT * FROM widget_ra_config ORDER BY widget_name').all();

    const shaped = sources.map((s) => ({
      sourceKey: s.source_key,
      sourceLabel: s.source_label,
      raEnabled: !!s.ra_enabled,
      raOptions: JSON.parse(s.ra_options),
      raSelected: s.ra_selected,
      reportEligible: !!s.report_eligible,
      reportEnabled: s.report_enabled === null ? null : !!s.report_enabled,
      specialConfig: s.special_config,
      modifiedOn: s.modified_on,
      modifiedBy: s.modified_by,
      recordCount: countBySource.get(s.source_label) || 0,
    }));

    res.json({
      sources: shaped,
      widgets: widgets.map((w) => ({ id: w.id, widgetName: w.widget_name, raOption: w.ra_option })),
    });
  } finally {
    db.close();
  }
});

router.put('/', (req, res) => {
  const db = openDb();
  try {
    const { sources = [], widgets = [], modifiedBy = 'Admin' } = req.body;
    const now = new Date().toISOString();

    const updateSource = db.prepare(`
      UPDATE duplication_settings
      SET ra_enabled = ?, ra_selected = ?, report_enabled = ?, modified_on = ?, modified_by = ?
      WHERE source_key = ?
    `);
    const updateWidget = db.prepare('UPDATE widget_ra_config SET ra_option = ? WHERE id = ?');

    db.exec('BEGIN');
    for (const s of sources) {
      const existing = db.prepare('SELECT report_eligible FROM duplication_settings WHERE source_key = ?').get(s.sourceKey);
      if (!existing) continue;
      const reportEnabled = existing.report_eligible ? (s.reportEnabled ? 1 : 0) : null;
      updateSource.run(s.raEnabled ? 1 : 0, s.raSelected, reportEnabled, now, modifiedBy, s.sourceKey);
    }
    for (const w of widgets) {
      updateWidget.run(w.raOption, w.id);
    }
    db.exec('COMMIT');

    res.json({ ok: true });
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    db.close();
  }
});

module.exports = router;
