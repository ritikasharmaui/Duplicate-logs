import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';

export default function LeadManagerListing({ showToast, openLeadProfile }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');

  const [facets, setFacets] = useState({ states: [], stages: [] });
  const [appliedState, setAppliedState] = useState('');
  const [appliedStage, setAppliedStage] = useState('');
  const [appliedHasDuplicate, setAppliedHasDuplicate] = useState('');
  const [openDropdown, setOpenDropdown] = useState(null);

  useEffect(() => {
    api.getLeadFacets().then(setFacets).catch(() => {});
  }, []);

  useEffect(() => {
    function onDocClick(e) {
      if (!e.target.closest('.fbtn')) setOpenDropdown(null);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(searchInput);
      setPage(1);
      setRevealed(false);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filterParams = useMemo(() => {
    const params = { page, pageSize };
    if (q.trim()) params.q = q.trim();
    if (appliedState) params.state = appliedState;
    if (appliedStage) params.stage = appliedStage;
    if (appliedHasDuplicate) params.hasDuplicate = appliedHasDuplicate;
    return params;
  }, [page, pageSize, q, appliedState, appliedStage, appliedHasDuplicate]);

  useEffect(() => {
    setLoading(true);
    api.getLeads(filterParams)
      .then((data) => {
        setRows(data.rows);
        setTotal(data.total);
      })
      .catch((err) => showToast(err.message, false))
      .finally(() => setLoading(false));
  }, [filterParams]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const selectFilter = (setter, value) => {
    setter(value);
    setPage(1);
    setRevealed(false);
    setOpenDropdown(null);
  };

  const duplicateLabel = appliedHasDuplicate === 'yes' ? 'Has Duplicate' : appliedHasDuplicate === 'no' ? 'No Duplicate' : 'Duplicate Match';

  return (
    <>
      <div className="lp-hd">
        <div className="lp-t">Lead Manager</div>
      </div>

      <div className="tb">
        <div className="sw">
          <i className="ti ti-search" style={{ fontSize: 15, color: '#9CA3AF', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search by name, Lead ID, email or mobile..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <div className={`fbtn ${appliedState ? 'act' : ''}`} onClick={() => setOpenDropdown(openDropdown === 'state' ? null : 'state')}>
          <i className="ti ti-map-pin" style={{ fontSize: 13 }} /> {appliedState || 'State'}
          <i className="ti ti-chevron-down" style={{ fontSize: 11 }} />
          {openDropdown === 'state' && (
            <div className="dd open" style={{ width: 220, maxHeight: 280, overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
              <div className="dd-item" onClick={() => selectFilter(setAppliedState, '')}>All States</div>
              <div className="dd-sep" />
              {facets.states.map((s) => (
                <div key={s} className="dd-item" onClick={() => selectFilter(setAppliedState, s)}>{s}</div>
              ))}
            </div>
          )}
        </div>

        <div className={`fbtn ${appliedStage ? 'act' : ''}`} onClick={() => setOpenDropdown(openDropdown === 'stage' ? null : 'stage')}>
          <i className="ti ti-flag" style={{ fontSize: 13 }} /> {appliedStage || 'Lead Stage'}
          <i className="ti ti-chevron-down" style={{ fontSize: 11 }} />
          {openDropdown === 'stage' && (
            <div className="dd open" style={{ width: 220, maxHeight: 280, overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
              <div className="dd-item" onClick={() => selectFilter(setAppliedStage, '')}>All Stages</div>
              <div className="dd-sep" />
              {facets.stages.map((s) => (
                <div key={s} className="dd-item" onClick={() => selectFilter(setAppliedStage, s)}>{s}</div>
              ))}
            </div>
          )}
        </div>

        <div className={`fbtn ${appliedHasDuplicate ? 'act' : ''}`} onClick={() => setOpenDropdown(openDropdown === 'dup' ? null : 'dup')}>
          <i className="ti ti-copy" style={{ fontSize: 13 }} /> {duplicateLabel}
          <i className="ti ti-chevron-down" style={{ fontSize: 11 }} />
          {openDropdown === 'dup' && (
            <div className="dd open" style={{ width: 180 }} onClick={(e) => e.stopPropagation()}>
              <div className="dd-item" onClick={() => selectFilter(setAppliedHasDuplicate, '')}>All Leads</div>
              <div className="dd-item" onClick={() => selectFilter(setAppliedHasDuplicate, 'yes')}>Has Duplicate Match</div>
              <div className="dd-item" onClick={() => selectFilter(setAppliedHasDuplicate, 'no')}>No Duplicate Match</div>
            </div>
          )}
        </div>
      </div>

      <div className="lb">
        <div className="tw">
          <table className="tbl clk">
            <thead>
              <tr>
                <th style={{ width: 190 }}>Registered Name</th>
                <th style={{ width: 200 }}>Registered Email</th>
                <th style={{ width: 150 }}>Registered Mobile</th>
                <th style={{ width: 120 }}>State</th>
                <th style={{ width: 120 }}>City</th>
                <th style={{ width: 160 }}>User Registration Date</th>
                <th style={{ width: 120 }}>Lead Stage</th>
                <th style={{ width: 140 }}>Duplicate</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8}><div className="empty">Loading…</div></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8}><div className="empty"><i className="ti ti-search-off" />No leads match your filters.</div></td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} onClick={() => openLeadProfile(r.id)}>
                    <td><div className="ln">{r.name || 'No Name'}</div></td>
                    <td style={{ fontSize: 12, color: 'var(--t2)' }}>{r.email || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--t2)' }}>{r.mobile || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--t2)' }}>{r.state || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--t2)' }}>{r.city || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--t2)', whiteSpace: 'nowrap' }}>{r.regDate || '—'}</td>
                    <td><span className="tag t-blue">{r.leadStage || 'Unknown'}</span></td>
                    <td>
                      {r.hasDuplicate
                        ? <span className="tag t-red">Duplicate Match</span>
                        : <span style={{ color: 'var(--t3)', fontSize: 12 }}>—</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="pgr" style={{ justifyContent: 'flex-end', gap: 10 }}>
        {revealed ? (
          <button className="sr-btn expanded">Total Records&nbsp;<strong>{total.toLocaleString()}</strong></button>
        ) : (
          <button className="sr-btn" onClick={() => setRevealed(true)}>Show Records</button>
        )}
        <span style={{ fontSize: 12, color: 'var(--t2)' }}>Show Rows</span>
        <select
          className="sel"
          style={{ padding: '3px 8px', fontSize: 12 }}
          value={pageSize}
          onChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(1); }}
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
        </select>
        <div className="pcs">
          <div className={`pb ${page === 1 ? 'disabled' : ''}`} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            <i className="ti ti-chevron-left" style={{ fontSize: 12 }} />
          </div>
          {Array.from({ length: Math.min(3, totalPages) }, (_, i) => i + 1).map((n) => (
            <div key={n} className={`pb ${page === n ? 'on' : ''}`} onClick={() => setPage(n)}>{n}</div>
          ))}
          {totalPages > 3 && <div className="pb" style={{ border: 'none', cursor: 'default', color: '#9CA3AF' }}>…</div>}
          {totalPages > 3 && (
            <div className={`pb ${page === totalPages ? 'on' : ''}`} onClick={() => setPage(totalPages)}>{totalPages}</div>
          )}
          <div className={`pb ${page >= totalPages ? 'disabled' : ''}`} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            <i className="ti ti-chevron-right" style={{ fontSize: 12 }} />
          </div>
        </div>
      </div>
    </>
  );
}
