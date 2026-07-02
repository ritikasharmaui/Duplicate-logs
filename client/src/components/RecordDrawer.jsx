import { useEffect, useState } from 'react';

export default function RecordDrawer({ row, onClose, showToast }) {
  const [animOpen, setAnimOpen] = useState(false);

  useEffect(() => {
    if (row) {
      const t = setTimeout(() => setAnimOpen(true), 10);
      return () => clearTimeout(t);
    }
    setAnimOpen(false);
  }, [row]);

  if (!row) return null;

  const sameValue = row.incomingValue === row.matchedValue;

  const handleClose = () => {
    setAnimOpen(false);
    setTimeout(onClose, 260);
  };

  return (
    <div className="dwo open" onClick={handleClose}>
      <div className={`dw ${animOpen ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="dw-hd">
          <div className="dw-t">Duplicate Record Details</div>
          <div className="dw-cl" onClick={handleClose}><i className="ti ti-x" /></div>
        </div>
        <div className="dw-body">
          <div className="dw-sec">
            <div className="dw-sec-t">Matched Lead</div>
            <div className="dw-field">
              <div className="dw-lbl">Lead Name</div>
              <div className="dw-val">{row.matchedLeadName}</div>
            </div>
            <div className="dw-field">
              <div className="dw-lbl">Lead ID</div>
              <div className="dw-val">
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); showToast('Redirecting to lead profile...'); }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  {row.matchedLeadRef} <i className="ti ti-external-link" style={{ fontSize: 12 }} />
                </a>
              </div>
            </div>
            <div className="dw-div" style={{ margin: '12px 0' }} />
            <div className="dw-field">
              <div className="dw-lbl">Matched unique field</div>
              <div className="dw-val"><span className="tag t-blue">{row.matchedField}</span></div>
            </div>
            <div className="dw-field">
              <div className="dw-lbl">Incoming value</div>
              <div className="dw-val">{row.incomingValue}</div>
            </div>
            <div className="dw-field">
              <div className="dw-lbl">Value on matched lead</div>
              <div className="dw-val">
                {row.matchedValue}{' '}
                {sameValue && <span style={{ fontSize: 11, color: 'var(--t3)' }}>(same — write-once rule applied)</span>}
              </div>
            </div>
          </div>
          <div className="dw-div" />
          <div className="dw-sec">
            <div className="dw-sec-t">Incoming Duplicate Lead</div>
            <div className="dw-field"><div className="dw-lbl">Name</div><div className="dw-val">{row.incomingLeadName}</div></div>
            <div className="dw-field"><div className="dw-lbl">{row.matchedField}</div><div className="dw-val">{row.incomingValue}</div></div>
            <div className="dw-field"><div className="dw-lbl">Lead inflow source</div><div className="dw-val">{row.leadInflowSource}</div></div>
            <div className="dw-field"><div className="dw-lbl">Lead entry timestamp</div><div className="dw-val">{row.userRegistrationDate}</div></div>
            {row.initiatedBy && (
              <div className="dw-field"><div className="dw-lbl">Initiated by</div><div className="dw-val">{row.initiatedBy}</div></div>
            )}
            <div className="dw-field"><div className="dw-lbl">Outcome</div><div className="dw-val">{row.eventStatus}</div></div>
          </div>
        </div>
        <div className="dw-footer">
          <button className="btn-s" style={{ flex: 1 }} onClick={handleClose}>Close</button>
          <button className="btn-p" style={{ flex: 2 }} onClick={() => showToast('View Lead — available in full build')}>
            View Matched Lead <i className="ti ti-external-link" style={{ fontSize: 13 }} />
          </button>
        </div>
      </div>
    </div>
  );
}
