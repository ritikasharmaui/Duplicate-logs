import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import MergeFromDuplicateModal from './MergeFromDuplicateModal';

export default function LeadProfile({ leadId, showToast, goLeadManager }) {
  const [lead, setLead] = useState(null);
  const [auditTrail, setAuditTrail] = useState([]);
  const [tab, setTab] = useState('details');
  const [loading, setLoading] = useState(true);
  const [mergeMatch, setMergeMatch] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.getLead(leadId), api.getLeadAuditTrail(leadId)])
      .then(([leadData, auditData]) => {
        setLead(leadData);
        setAuditTrail(auditData.rows);
      })
      .catch((err) => showToast(err.message, false))
      .finally(() => setLoading(false));
  }, [leadId, showToast]);

  useEffect(() => { load(); }, [load]);

  if (loading || !lead) {
    return (
      <>
        <div className="lp-hd">
          <div className="bcrumb"><span className="blink" onClick={goLeadManager}><i className="ti ti-arrow-left" style={{ fontSize: 12 }} /> Lead Manager</span></div>
          <div className="lp-t">Lead Details</div>
        </div>
        <div className="empty">Loading…</div>
      </>
    );
  }

  const { applicant, allFields, duplicateMatches } = lead;

  return (
    <>
      <div className="lp-hd">
        <div className="bcrumb"><span className="blink" onClick={goLeadManager}><i className="ti ti-arrow-left" style={{ fontSize: 12 }} /> Lead Manager</span></div>
        <div className="lp-t">{applicant.name || 'No Name'}</div>
      </div>

      <div className="lb" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="tw" style={{ padding: 18 }}>
            <div className="dw-sec-t">Applicant Info</div>
            <div className="dw-field"><div className="dw-lbl">Name</div><div className="dw-val">{applicant.name || 'No Name'}</div></div>
            <div className="dw-field"><div className="dw-lbl">Email</div><div className="dw-val">{applicant.email || 'NA'}</div></div>
            <div className="dw-field"><div className="dw-lbl">Mobile</div><div className="dw-val">{applicant.mobile || 'NA'}</div></div>
            <div className="dw-field"><div className="dw-lbl">State</div><div className="dw-val">{applicant.state || 'State Not Available'}</div></div>
            <div className="dw-field"><div className="dw-lbl">City</div><div className="dw-val">{applicant.city || 'City Not Available'}</div></div>
            <div className="dw-field"><div className="dw-lbl">Lead Stage</div><div className="dw-val"><span className="tag t-blue">{applicant.leadStage || 'Unknown'}</span></div></div>
            <div className="dw-field"><div className="dw-lbl">User Registration Date</div><div className="dw-val">{applicant.userRegistrationDate || 'NA'}</div></div>
            <div className="dw-field"><div className="dw-lbl">Lead Id</div><div className="dw-val">{applicant.leadId || 'NA'}</div></div>
          </div>

          <div className="tw" style={{ padding: 18 }}>
            <div className="dw-sec-t">Duplicate Match{duplicateMatches.length !== 1 ? 'es' : ''}</div>
            {duplicateMatches.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--t3)' }}>No duplicate matches found for this lead.</div>
            ) : (
              duplicateMatches.map((m) => (
                <div key={m.duplicateRecordId} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--bdl)' }}>
                  <div className="dw-field">
                    <div className="dw-lbl">{m.role === 'matched' ? 'Duplicate found' : 'Flagged as duplicate of'}</div>
                    <div className="dw-val">{m.otherLeadName}</div>
                  </div>
                  <div className="dw-field">
                    <div className="dw-lbl">Matched on</div>
                    <div className="dw-val"><span className="tag t-blue">{m.matchedField}</span></div>
                  </div>
                  {m.role === 'matched' ? (
                    <button className="btn-p" style={{ marginTop: 6, fontSize: 12, padding: '6px 12px' }} onClick={() => setMergeMatch(m)}>
                      Update Lead Details from Duplicate
                    </button>
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>
                      This lead was flagged as a duplicate — resolve it from {m.otherLeadName}'s profile.
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="tabs" style={{ padding: 0, marginBottom: 12 }}>
            <div className={`tab ${tab === 'details' ? 'on' : ''}`} onClick={() => setTab('details')}>Lead Details</div>
            <div className={`tab ${tab === 'audit' ? 'on' : ''}`} onClick={() => setTab('audit')}>Audit Trail</div>
          </div>

          {tab === 'details' && (
            <div className="tw" style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px' }}>
              {allFields.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--t3)' }}>No additional fields on record.</div>
              ) : (
                allFields.map((f) => (
                  <div className="dw-field" key={f.label}>
                    <div className="dw-lbl">{f.label}</div>
                    <div className="dw-val">{f.value}</div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'audit' && (
            <div className="tw">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Old Value</th>
                    <th>New Value</th>
                    <th>Changed By</th>
                    <th>Changed At</th>
                  </tr>
                </thead>
                <tbody>
                  {auditTrail.length === 0 ? (
                    <tr><td colSpan={5}><div className="empty">No changes logged yet.</div></td></tr>
                  ) : (
                    auditTrail.map((a) => (
                      <tr key={a.id}>
                        <td>{a.field_name}</td>
                        <td style={{ color: 'var(--t2)' }}>{a.old_value || '—'}</td>
                        <td>{a.new_value || '—'}</td>
                        <td>{a.changed_by}</td>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--t2)' }}>{a.changed_at}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <MergeFromDuplicateModal
        leadId={leadId}
        match={mergeMatch}
        onClose={() => setMergeMatch(null)}
        onMerged={() => { setMergeMatch(null); load(); }}
        showToast={showToast}
      />
    </>
  );
}
