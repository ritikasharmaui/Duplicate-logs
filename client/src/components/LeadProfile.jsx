import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import GroupMergeModal from './GroupMergeModal';

const CHROME_TABS = ['Lead Details', 'Timeline', 'Calendar Pro', 'Notes', 'Communication Logs'];
const tabKey = (label) => label.toLowerCase().replace(/\s+/g, '-');

export default function LeadProfile({ leadId, showToast, goLeadManager }) {
  const [lead, setLead] = useState(null);
  const [auditTrail, setAuditTrail] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [stages, setStages] = useState([]);
  const [tab, setTab] = useState('lead-details');
  const [loading, setLoading] = useState(true);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [accOpen, setAccOpen] = useState({});
  const [activityEvent, setActivityEvent] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.getLead(leadId), api.getLeadAuditTrail(leadId), api.getLeadFacets(), api.getLeadTimeline(leadId)])
      .then(([leadData, auditData, facets, timelineData]) => {
        setLead(leadData);
        setAuditTrail(auditData.rows);
        setStages(facets.stages || []);
        setTimeline(timelineData.rows);
      })
      .catch((err) => showToast(err.message, false))
      .finally(() => setLoading(false));
  }, [leadId, showToast]);

  useEffect(() => { load(); }, [load]);

  const notWired = () => showToast('Not wired up in this prototype', false);

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
  const matchedGroup = duplicateMatches.filter((m) => m.role === 'matched');
  const flaggedAsDup = duplicateMatches.filter((m) => m.role === 'incoming');
  const hasNoDuplicateInfo = matchedGroup.length === 0 && flaggedAsDup.length === 0;
  const initial = (applicant.name || '?').trim().charAt(0).toUpperCase() || '?';

  return (
    <>
      <div className="lp-hd">
        <div className="bcrumb"><span className="blink" onClick={goLeadManager}><i className="ti ti-arrow-left" style={{ fontSize: 12 }} /> Lead Manager</span></div>
        <div className="lp-t">Lead Details</div>
      </div>

      <div className="lb" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ width: 290, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

          <div className="tw" style={{ padding: 18 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div className="lp-avatar">{initial}</div>
              <div style={{ minWidth: 0 }}>
                <div className="lp-name">{applicant.name || 'No Name'}</div>
                <div className="lp-stage-line">Lead Stage: <b>{applicant.leadStage || 'Unknown'}</b> <i className="ti ti-pencil" onClick={notWired} /></div>
              </div>
            </div>

            <div className="lp-contact"><i className="ti ti-mail" />{applicant.email || 'NA'}</div>
            <div className="lp-contact"><i className="ti ti-phone" />{applicant.mobile || 'NA'}</div>

            <div className="lp-actions">
              <div className="lp-ac" onClick={notWired} title="Not wired up in this prototype"><i className="ti ti-arrows-shuffle" /></div>
              <div className="lp-ac" onClick={notWired} title="Not wired up in this prototype"><i className="ti ti-mail" /></div>
              <div className="lp-ac" onClick={notWired} title="Not wired up in this prototype"><i className="ti ti-affiliate" /></div>
              <div className="lp-ac" onClick={notWired} title="Not wired up in this prototype"><i className="ti ti-brand-whatsapp" /></div>
              <div className="lp-ac" onClick={notWired} title="Not wired up in this prototype"><i className="ti ti-layout-grid" /></div>
              <div className="lp-ac" onClick={notWired} title="Not wired up in this prototype"><i className="ti ti-dots" /></div>
            </div>
          </div>

          <div className="lp-stats">
            <div className="lp-stat">
              <div className="lp-stat-v">—</div>
              <div className="lp-stat-l"><i className="ti ti-info-circle" />Lead Strength</div>
            </div>
            <div className="lp-stat">
              <div className="lp-stat-v">—</div>
              <div className="lp-stat-l"><i className="ti ti-info-circle" />Lead Score</div>
            </div>
          </div>

          <div className={`lp-dup-card ${hasNoDuplicateInfo ? 'none' : ''}`}>
            <div className="lp-dup-t"><i className="ti ti-alert-triangle" />Duplicate Match{matchedGroup.length !== 1 ? 'es' : ''}</div>
            {hasNoDuplicateInfo && (
              <div style={{ fontSize: 12, color: 'var(--t3)' }}>No duplicate matches found for this lead.</div>
            )}
            {matchedGroup.length > 0 && (
              <>
                <div className="lp-dup-sub">{matchedGroup.length} duplicate lead{matchedGroup.length === 1 ? '' : 's'} matched on {matchedGroup[0].matchedField}</div>
                {matchedGroup.slice(0, 3).map((m) => (
                  <div className="lp-dup-row" key={m.duplicateRecordId}>
                    <span>{m.otherLeadName || 'No Name'}</span>
                  </div>
                ))}
                {matchedGroup.length > 3 && (
                  <div className="lp-dup-row"><span>+{matchedGroup.length - 3} more</span></div>
                )}
                <button
                  className="btn-p"
                  style={{ marginTop: 10, fontSize: 12, padding: '7px 12px', width: '100%', justifyContent: 'center' }}
                  onClick={() => setMergeOpen(true)}
                >
                  Review and Update Lead Details ({matchedGroup.length})
                </button>
              </>
            )}
            {flaggedAsDup.length > 0 && (
              <div style={{ fontSize: 11, color: '#92400E', marginTop: matchedGroup.length ? 10 : 0 }}>
                This lead was flagged as a duplicate of {flaggedAsDup[0].otherLeadName} — resolve it from that lead's profile.
              </div>
            )}
          </div>

          {['Assignment Details', 'Important Dates', 'Engagement Stats'].map((title) => (
            <div className="acc" key={title}>
              <div className="acc-hd" onClick={() => setAccOpen((s) => ({ ...s, [title]: !s[title] }))}>
                <div><div className="acc-t">{title}</div></div>
                <i className="acc-ic ti ti-chevron-down" style={{ transform: accOpen[title] ? 'rotate(180deg)' : 'none' }} />
              </div>
              <div className={`acc-bd ${accOpen[title] ? 'open' : ''}`}>
                <div style={{ padding: 16, fontSize: 12, color: 'var(--t3)' }}>Not tracked in this dataset.</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="tw" style={{ marginBottom: 12, padding: 0 }}>
            <div className="lp-pipeline">
              <div className="lp-pill done">Total Leads</div>
              {stages.slice(0, 8).map((s) => (
                <div key={s} className={`lp-pill ${s === applicant.leadStage ? 'current' : ''}`}>{s}</div>
              ))}
            </div>
            <div className="tabs" style={{ marginBottom: 0 }}>
              {CHROME_TABS.map((t) => (
                <div key={t} className={`tab ${tab === tabKey(t) ? 'on' : ''}`} onClick={() => setTab(tabKey(t))}>{t}</div>
              ))}
              <div className={`tab ${tab === 'audit-trail' ? 'on' : ''}`} onClick={() => setTab('audit-trail')} style={{ marginLeft: 'auto' }}>Audit Trail</div>
            </div>
          </div>

          {tab === 'lead-details' && (
            <div className="tw" style={{ padding: 18 }}>
              <div className="lp-sub-tab">Lead Details <i className="ti ti-pencil" style={{ fontSize: 11 }} onClick={notWired} /></div>
              <div className="lp-field-list">
                {allFields.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--t3)' }}>No additional fields on record.</div>
                ) : (
                  allFields.map((f) => (
                    <div className="lp-field-row" key={f.label}><b>{f.label}</b><span>: {f.value}</span></div>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === 'audit-trail' && (
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

          {tab === 'timeline' && (
            <div className="tw" style={{ padding: 0 }}>
              {timeline.length === 0 ? (
                <div className="empty" style={{ padding: 24 }}>No timeline events yet.</div>
              ) : (
                <div style={{ padding: '8px 0' }}>
                  {timeline.map((ev) => (
                    <div key={ev.id} style={{ display: 'flex', gap: 16, padding: '14px 20px', borderBottom: '1px solid var(--bdr)' }}>
                      <div style={{ flexShrink: 0, width: 96, fontSize: 11, color: 'var(--t3)', lineHeight: 1.5 }}>
                        <div>{new Date(ev.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                        <div>{new Date(ev.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                      <div style={{ width: 32, flexShrink: 0, display: 'flex', justifyContent: 'center', paddingTop: 2 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--acc-light,#EFF6FF)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <i className="ti ti-git-merge" style={{ fontSize: 13, color: 'var(--acc)' }} />
                        </div>
                      </div>
                      <div style={{ flex: 1, fontSize: 13, color: 'var(--t1)', lineHeight: 1.55 }}>
                        {ev.eventText}
                        {ev.fieldsChanged && ev.fieldsChanged.length > 0 && (
                          <span
                            style={{ marginLeft: 8, color: 'var(--acc)', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
                            onClick={() => setActivityEvent(ev)}
                          >
                            View Activity
                          </span>
                        )}
                      </div>
                      <div style={{ width: 24, flexShrink: 0, fontSize: 12, color: 'var(--t3)', display: 'flex', alignItems: 'flex-start', paddingTop: 3 }}>0</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {['calendar-pro', 'notes', 'communication-logs'].includes(tab) && (
            <div className="tw">
              <div className="empty">Not tracked in this prototype.</div>
            </div>
          )}
        </div>
      </div>

      <GroupMergeModal
        leadId={leadId}
        anchorName={applicant.name || 'This lead'}
        open={mergeOpen}
        onClose={() => setMergeOpen(false)}
        onMerged={() => { setMergeOpen(false); load(); }}
        showToast={showToast}
      />

      {activityEvent && (
        <div className="dwo open" onClick={() => setActivityEvent(null)}>
          <div
            className="dw open"
            style={{ width: 480 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dw-hd">
              <div className="dw-t">Profile Detail Activity</div>
              <div className="dw-cl" onClick={() => setActivityEvent(null)}><i className="ti ti-x" /></div>
            </div>
            <div className="dw-body" style={{ padding: 0 }}>
              <table className="tbl" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th style={{ width: 130 }}>Fields</th>
                    <th>Old Value</th>
                    <th>New Values</th>
                  </tr>
                </thead>
                <tbody>
                  {activityEvent.fieldsChanged.map((fc, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500 }}>{fc.field}</td>
                      <td style={{ color: '#991B1B', background: '#FEF2F2' }}>{fc.oldValue || '—'}</td>
                      <td style={{ color: '#065F46', background: '#F0FDF4' }}>{fc.newValue || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
