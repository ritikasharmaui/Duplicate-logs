import { useEffect, useState } from 'react';
import { api } from '../api';

export default function MergeFromDuplicateModal({ leadId, match, onClose, onMerged, showToast }) {
  const [animOpen, setAnimOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [compare, setCompare] = useState(null);
  const [selections, setSelections] = useState({});
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!match) return;
    setAnimOpen(false);
    setLoading(true);
    setConfirmed(false);
    const t = setTimeout(() => setAnimOpen(true), 10);
    api.compareLeadWithDuplicate(leadId, match.duplicateRecordId)
      .then((data) => {
        setCompare(data);
        const initial = {};
        data.fields.forEach((f) => { initial[f.field] = 'original'; });
        setSelections(initial);
      })
      .catch((err) => showToast(err.message, false))
      .finally(() => setLoading(false));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match]);

  if (!match) return null;

  const handleClose = () => {
    setAnimOpen(false);
    setTimeout(onClose, 260);
  };

  const setAll = (source) => {
    if (!compare) return;
    const next = {};
    compare.fields.forEach((f) => { next[f.field] = source; });
    setSelections(next);
  };

  const handleSave = () => {
    if (!compare || !confirmed) return;
    setSaving(true);
    const fieldSelections = Object.entries(selections).map(([field, source]) => ({ field, source }));
    api.mergeLeadFromDuplicate(leadId, { duplicateRecordId: match.duplicateRecordId, fieldSelections })
      .then((res) => {
        showToast(`Lead updated. ${res.fieldsChanged} field(s) changed, duplicate lead removed.`);
        onMerged();
      })
      .catch((err) => showToast(err.message, false))
      .finally(() => setSaving(false));
  };

  return (
    <div className="dwo open" onClick={handleClose}>
      <div className={`dw ${animOpen ? 'open' : ''}`} style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="dw-hd">
          <div className="dw-t">Update Lead Details from Duplicate</div>
          <div className="dw-cl" onClick={handleClose}><i className="ti ti-x" /></div>
        </div>
        <div className="dw-body">
          {loading ? (
            <div className="empty">Loading comparison…</div>
          ) : !compare || compare.fields.length === 0 ? (
            <div className="empty">No differing fields — this lead and its duplicate already match.</div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 12 }}>
                Comparing against <strong>{compare.otherLeadName}</strong>. Choose which value to keep for each field.
              </div>
              <div style={{ display: 'flex', gap: 14, marginBottom: 12 }}>
                <span className="widget-expand-link" onClick={() => setAll('original')}>Keep all Original</span>
                <span className="widget-expand-link" onClick={() => setAll('duplicate')}>Use all from Duplicate</span>
              </div>

              {compare.cascadeCount > 0 && (
                <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 6, padding: '10px 12px', fontSize: 12, color: '#92400E', marginBottom: 14 }}>
                  <i className="ti ti-alert-triangle" style={{ marginRight: 6 }} />
                  Saving will also permanently remove {compare.cascadeCount} other duplicate record{compare.cascadeCount === 1 ? '' : 's'} that reference this duplicate lead.
                </div>
              )}

              {compare.fields.map((f) => (
                <div key={f.field} className="dw-sec" style={{ marginBottom: 14 }}>
                  <div className="dw-sec-t" style={{ marginBottom: 6 }}>{f.field}</div>
                  <div
                    className="dd-item"
                    style={{ borderRadius: 6, border: '1px solid var(--bd)', marginBottom: 4 }}
                    onClick={() => setSelections((s) => ({ ...s, [f.field]: 'original' }))}
                  >
                    <div className={`cb ${selections[f.field] === 'original' ? 'on' : ''}`} />
                    <div><div style={{ fontSize: 11, color: 'var(--t3)' }}>Keep Original</div>{f.originalValue || '—'}</div>
                  </div>
                  <div
                    className="dd-item"
                    style={{ borderRadius: 6, border: '1px solid var(--bd)' }}
                    onClick={() => setSelections((s) => ({ ...s, [f.field]: 'duplicate' }))}
                  >
                    <div className={`cb ${selections[f.field] === 'duplicate' ? 'on' : ''}`} />
                    <div><div style={{ fontSize: 11, color: 'var(--t3)' }}>Use Duplicate</div>{f.duplicateValue || '—'}</div>
                  </div>
                </div>
              ))}

              <div className="cb-row" style={{ marginTop: 4 }}>
                <div className={`cb ${confirmed ? 'on' : ''}`} onClick={() => setConfirmed((c) => !c)} />
                <span style={{ fontSize: 12 }}>I understand the duplicate lead will be permanently deleted.</span>
              </div>
            </>
          )}
        </div>
        <div className="dw-footer">
          <button className="btn-s" style={{ flex: 1 }} onClick={handleClose}>Cancel</button>
          <button
            className="btn-p"
            style={{ flex: 2 }}
            disabled={loading || saving || !compare || compare.fields.length === 0 || !confirmed}
            onClick={handleSave}
          >
            {saving ? 'Saving…' : 'Save & Remove Duplicate Lead'}
          </button>
        </div>
      </div>
    </div>
  );
}
