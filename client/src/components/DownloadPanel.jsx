import { useEffect, useState } from 'react';
import { api } from '../api';
import { DOWNLOAD_COLUMNS } from '../constants';

export default function DownloadPanel({ open, onClose, filterParams, showToast }) {
  const [animOpen, setAnimOpen] = useState(false);
  const [colState, setColState] = useState(() =>
    Object.fromEntries(DOWNLOAD_COLUMNS.map((c) => [c.label, c.defaultOn]))
  );
  const [queuing, setQueuing] = useState(false);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => setAnimOpen(true), 10);
      return () => clearTimeout(t);
    }
    setAnimOpen(false);
  }, [open]);

  if (!open) return null;

  const handleClose = () => {
    setAnimOpen(false);
    setTimeout(onClose, 260);
  };

  const toggleCol = (label) => setColState((prev) => ({ ...prev, [label]: !prev[label] }));

  const handleQueue = () => {
    const columns = DOWNLOAD_COLUMNS.filter((c) => colState[c.label]).map((c) => c.label);
    if (!columns.length) {
      showToast('Select at least one column.', false);
      return;
    }
    setQueuing(true);
    api.queueDownload(columns, filterParams)
      .then((res) => {
        showToast(`Download ready — ${res.rowCount.toLocaleString()} record${res.rowCount === 1 ? '' : 's'}.`);
        const link = document.createElement('a');
        link.href = res.fileUrl;
        link.download = '';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        handleClose();
      })
      .catch((err) => showToast(err.message, false))
      .finally(() => setQueuing(false));
  };

  return (
    <div className="dwo open" onClick={handleClose}>
      <div className={`dw ${animOpen ? 'open' : ''}`} style={{ width: 360 }} onClick={(e) => e.stopPropagation()}>
        <div className="dw-hd">
          <div>
            <div className="dw-t">Download Records</div>
            <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2 }}>Select columns to include in the CSV</div>
          </div>
          <div className="dw-cl" onClick={handleClose}><i className="ti ti-x" /></div>
        </div>
        <div className="dw-body" style={{ padding: 0 }}>
          <div style={{ padding: '13px 20px', background: '#F9FAFB', borderBottom: '1px solid var(--bd)', fontSize: 12, color: 'var(--t2)', lineHeight: 1.6 }}>
            The export will be queued as a <strong>Download Log Request</strong> and applies your current active filters.
          </div>
          <div style={{ padding: '10px 20px 4px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--t3)' }}>Columns</div>
          <div style={{ padding: '0 20px 16px' }}>
            {DOWNLOAD_COLUMNS.map((c) => (
              <div key={c.label} className="co-item" onClick={() => toggleCol(c.label)}>
                <div className={`cb ${colState[c.label] ? 'on' : ''}`} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13 }}>{c.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="dw-footer">
          <button className="btn-s" style={{ flex: 1 }} onClick={handleClose}>Cancel</button>
          <button className="btn-p" style={{ flex: 2 }} onClick={handleQueue} disabled={queuing}>
            <i className="ti ti-download" style={{ fontSize: 13 }} /> {queuing ? 'Queuing…' : 'Queue Download'}
          </button>
        </div>
      </div>
    </div>
  );
}
