import { useEffect, useState } from 'react';
import { api } from '../api';

export default function RecordDrawer({ row, onClose, showToast, openLeadProfile }) {
  const [animOpen, setAnimOpen] = useState(false);
  const [matchedLeads, setMatchedLeads] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  useEffect(() => {
    if (row) {
      const t = setTimeout(() => setAnimOpen(true), 10);
      if (row.matchCount > 1) {
        setLoadingMatches(true);
        api.getMatches(row.incomingLeadId)
          .then((data) => setMatchedLeads(data.matches || []))
          .catch((err) => showToast(err.message, false))
          .finally(() => setLoadingMatches(false));
      } else {
        setMatchedLeads([]);
      }
      return () => clearTimeout(t);
    }
    setAnimOpen(false);
    setMatchedLeads([]);
  }, [row]);

  if (!row) return null;

  const handleClose = () => {
    setAnimOpen(false);
    setTimeout(onClose, 260);
  };

  const isMultiMatch = row.matchCount > 1;
  const leads = isMultiMatch
    ? matchedLeads
    : [{
        id: row.id,
        matchedLeadId: row.matchedLeadId,
        matchedLeadName: row.matchedLeadName,
        matchedLeadRef: row.matchedLeadRef,
        matchedField: row.matchedField,
        matchedValue: row.matchedValue,
        incomingValue: row.incomingValue,
      }];

  const isPending = row.eventStatus === 'Matching in Progress';

  return (
    <div className="dwo open" onClick={handleClose}>
      <div className={`dw ${animOpen ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="dw-hd">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <div className="dw-t">Duplicate Record Details</div>
            {isPending && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
                fontSize: 11, fontWeight: 600, color: '#92400e',
                background: '#fef3c7', border: '1px solid #fde68a',
                borderRadius: 4, padding: '3px 8px',
              }}>
                <i className="ti ti-loader-2" style={{ fontSize: 11 }} />
                Matching in Progress
              </span>
            )}
          </div>
          <div className="dw-cl" onClick={handleClose}><i className="ti ti-x" /></div>
        </div>
        <div className="dw-body">
          {/* Matched Lead(s) */}
          <div className="dw-sec">
            <div className="dw-sec-t">
              {isMultiMatch ? `Matched Leads (${row.matchCount})` : 'Matched Lead'}
            </div>

            {isPending ? (
              <div style={{
                padding: '14px 12px', background: 'var(--bg2)', borderRadius: 6,
                border: '1px dashed var(--bdr)', textAlign: 'center',
              }}>
                <i className="ti ti-clock-hour-4" style={{ fontSize: 20, color: 'var(--t3)', display: 'block', marginBottom: 6 }} />
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', marginBottom: 4 }}>Match check in progress</div>
                <div style={{ fontSize: 11, color: 'var(--t3)', lineHeight: 1.5 }}>
                  This record was uploaded via Bulk Offline Upload. The system is checking for duplicates — this may take a few minutes.
                </div>
              </div>
            ) : loadingMatches ? (
              <div style={{ padding: '12px 0', color: 'var(--t3)', fontSize: 12 }}>Loading matched leads…</div>
            ) : leads.map((lead, idx) => (
              <div key={lead.id || idx}>
                {idx > 0 && <div className="dw-div" style={{ margin: '10px 0' }} />}
                {isMultiMatch && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                    Match {idx + 1}
                  </div>
                )}
                <div className="dw-field">
                  <div className="dw-lbl">Lead Name</div>
                  <div className="dw-val">{lead.matchedLeadName || '—'}</div>
                </div>
                <div className="dw-field">
                  <div className="dw-lbl">Lead ID</div>
                  <div className="dw-val" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <a
                      href="#"
                      onClick={(e) => { e.preventDefault(); openLeadProfile(lead.matchedLeadId); }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      {lead.matchedLeadRef} <i className="ti ti-external-link" style={{ fontSize: 12 }} />
                    </a>
                    <i
                      className="ti ti-copy"
                      style={{ fontSize: 13, color: 'var(--t3)', cursor: 'pointer' }}
                      title="Copy Lead ID"
                      onClick={() => { navigator.clipboard.writeText(lead.matchedLeadRef); showToast('Lead ID copied.'); }}
                    />
                  </div>
                </div>
                <div className="dw-field">
                  <div className="dw-lbl">Matched unique field</div>
                  <div className="dw-val"><span className="tag t-blue">{lead.matchedField}</span></div>
                </div>
                {!isMultiMatch && (
                  <>
                    <div className="dw-div" style={{ margin: '12px 0' }} />
                    <div className="dw-field">
                      <div className="dw-lbl">Incoming value</div>
                      <div className="dw-val">{lead.incomingValue}</div>
                    </div>
                    {lead.incomingValue !== lead.matchedValue && (
                      <div className="dw-field">
                        <div className="dw-lbl">Value on matched lead</div>
                        <div className="dw-val">{lead.matchedValue}</div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="dw-div" />

          {/* Incoming Duplicate Lead */}
          <div className="dw-sec">
            <div className="dw-sec-t">Incoming Duplicate Lead</div>
            <div className="dw-field"><div className="dw-lbl">Name</div><div className="dw-val">{row.incomingLeadName}</div></div>
            <div className="dw-field"><div className="dw-lbl">{row.matchedField}</div><div className="dw-val">{row.incomingValue}</div></div>
            <div className="dw-field"><div className="dw-lbl">Lead origin</div><div className="dw-val">{row.leadInflowSource}</div></div>
            <div className="dw-field"><div className="dw-lbl">Detected On</div><div className="dw-val">{row.userRegistrationDate}</div></div>
            {row.initiatedBy && (
              <div className="dw-field"><div className="dw-lbl">Initiated by</div><div className="dw-val">{row.initiatedBy}</div></div>
            )}
          </div>
        </div>

        <div className="dw-footer">
          <button className="btn-s" style={{ flex: 1 }} onClick={handleClose}>Close</button>
          {!isMultiMatch && !isPending && (
            <button className="btn-p" style={{ flex: 2 }} onClick={() => openLeadProfile(row.matchedLeadId)}>
              View Matched Lead <i className="ti ti-external-link" style={{ fontSize: 13 }} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
