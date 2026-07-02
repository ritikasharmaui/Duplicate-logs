import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { SOURCE_LIST, UNIQUE_FIELD_LIST, DATE_PRESETS, dateRangeForPreset } from '../constants';
import RecordDrawer from './RecordDrawer';
import DownloadPanel from './DownloadPanel';

export default function ListingView({ initialSource, showToast, goSettings }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const [appliedSource, setAppliedSource] = useState(initialSource ? [initialSource] : []);
  const [appliedUniqueField, setAppliedUniqueField] = useState([]);
  const [appliedDatePreset, setAppliedDatePreset] = useState(null);
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');

  const [draftSourceSel, setDraftSourceSel] = useState(() => {
    const init = {};
    if (initialSource) init[initialSource] = true;
    return init;
  });
  const [draftDatePreset, setDraftDatePreset] = useState(null);
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');

  const [openDropdown, setOpenDropdown] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [drawerRow, setDrawerRow] = useState(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    function onDocClick(e) {
      if (!e.target.closest('.fbtn') && !e.target.closest('.kebab-ic')) {
        setOpenDropdown(null);
        setBulkMenuOpen(false);
      }
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const filterParams = useMemo(() => {
    const params = { page, pageSize };
    if (appliedSource.length) params.source = appliedSource.join(',');
    if (appliedUniqueField.length) params.uniqueField = appliedUniqueField.join(',');
    if (q.trim()) params.q = q.trim();
    if (appliedDatePreset) {
      const { from, to } = dateRangeForPreset(appliedDatePreset, appliedFrom, appliedTo);
      if (from) params.dateFrom = from;
      if (to) params.dateTo = to;
    }
    return params;
  }, [page, pageSize, appliedSource, appliedUniqueField, q, appliedDatePreset, appliedFrom, appliedTo]);

  useEffect(() => {
    setLoading(true);
    api.getRecords(filterParams)
      .then((data) => {
        setRows(data.rows);
        setTotal(data.total);
      })
      .catch((err) => showToast(err.message, false))
      .finally(() => setLoading(false));
  }, [filterParams]);

  // debounce search
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(searchInput);
      setPage(1);
      setRevealed(false);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const applySourceFilter = () => {
    const selected = Object.keys(draftSourceSel).filter((k) => draftSourceSel[k]);
    setAppliedSource(selected);
    setPage(1);
    setRevealed(false);
    setOpenDropdown(null);
  };
  const clearSourceFilter = () => {
    setDraftSourceSel({});
    setAppliedSource([]);
    setPage(1);
    setRevealed(false);
  };

  const toggleUniqueField = (field) => {
    setAppliedUniqueField((prev) => (prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]));
    setPage(1);
    setRevealed(false);
  };
  const clearUniqueField = () => {
    setAppliedUniqueField([]);
    setPage(1);
    setRevealed(false);
  };

  const applyDateFilter = () => {
    if (!draftDatePreset) return;
    setAppliedDatePreset(draftDatePreset);
    setAppliedFrom(draftFrom);
    setAppliedTo(draftTo);
    setPage(1);
    setRevealed(false);
    setOpenDropdown(null);
  };
  const resetDateFilter = () => {
    setDraftDatePreset(null);
    setDraftFrom('');
    setDraftTo('');
    setAppliedDatePreset(null);
    setAppliedFrom('');
    setAppliedTo('');
    setPage(1);
    setRevealed(false);
  };

  const dateLabel = appliedDatePreset ? DATE_PRESETS.find((d) => d.key === appliedDatePreset)?.label : 'Date range';

  const toggleRow = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const allOnPageSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const toggleAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) rows.forEach((r) => next.delete(r.id));
      else rows.forEach((r) => next.add(r.id));
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkDelete = () => {
    const ids = [...selectedIds];
    api.bulkDelete(ids)
      .then(() => {
        showToast(`Deleted ${ids.length} record${ids.length === 1 ? '' : 's'}.`);
        clearSelection();
        setBulkMenuOpen(false);
        api.getRecords(filterParams).then((data) => { setRows(data.rows); setTotal(data.total); });
      })
      .catch((err) => showToast(err.message, false));
  };

  return (
    <>
      <div className="lp-hd">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="bcrumb">
              <span className="blink" onClick={goSettings}><i className="ti ti-arrow-left" style={{ fontSize: 12 }} /> Lead Duplication Settings</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="lp-t">Duplicate Lead Records</div>
          {appliedSource.length === 1 && <span className="lp-src-badge">{appliedSource[0]}</span>}
        </div>
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

        <div className={`fbtn ${appliedDatePreset ? 'act' : ''}`} onClick={() => setOpenDropdown(openDropdown === 'date' ? null : 'date')}>
          <i className="ti ti-calendar" style={{ fontSize: 13 }} /> <span>{dateLabel}</span>
          <i className="ti ti-chevron-down" style={{ fontSize: 11 }} />
          {openDropdown === 'date' && (
            <div className="dd open" style={{ width: 200, padding: '6px 0' }} onClick={(e) => e.stopPropagation()}>
              {DATE_PRESETS.map((d) => (
                <div
                  key={d.key}
                  className={`date-opt ${draftDatePreset === d.key ? 'on' : ''}`}
                  onClick={() => setDraftDatePreset(d.key)}
                >
                  {d.label}
                </div>
              ))}
              {draftDatePreset === 'custom' && (
                <div style={{ padding: '6px 14px 10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 3, textTransform: 'uppercase' }}>From</div>
                      <input type="date" className="sel" style={{ width: '100%', padding: '4px 6px', fontSize: 11 }} value={draftFrom} onChange={(e) => setDraftFrom(e.target.value)} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 3, textTransform: 'uppercase' }}>To</div>
                      <input type="date" className="sel" style={{ width: '100%', padding: '4px 6px', fontSize: 11 }} value={draftTo} onChange={(e) => setDraftTo(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}
              <div className="dd-sep" />
              <div className="dd-apply">
                <button className="btn-p" style={{ padding: '5px 14px', fontSize: 12 }} onClick={applyDateFilter}>Apply</button>
                <button className="btn-s" style={{ padding: '5px 10px', fontSize: 12 }} onClick={resetDateFilter}>Reset</button>
              </div>
            </div>
          )}
        </div>

        <div className={`fbtn ${appliedSource.length ? 'act' : ''}`} onClick={() => setOpenDropdown(openDropdown === 'source' ? null : 'source')}>
          <i className="ti ti-filter" style={{ fontSize: 13 }} /> Source
          <i className="ti ti-chevron-down" style={{ fontSize: 11 }} />
          {openDropdown === 'source' && (
            <div className="dd open" style={{ width: 220, maxHeight: 280, overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
              <div className="dd-hd">Lead Inflow Source</div>
              {SOURCE_LIST.map((s) => (
                <div key={s} className="dd-item" onClick={() => setDraftSourceSel((prev) => ({ ...prev, [s]: !prev[s] }))}>
                  <div className={`cb ${draftSourceSel[s] ? 'on' : ''}`} />{s}
                </div>
              ))}
              <div className="dd-sep" />
              <div className="dd-apply">
                <button className="btn-s" style={{ padding: '5px 10px', fontSize: 12 }} onClick={clearSourceFilter}>Clear</button>
                <button className="btn-p" style={{ padding: '5px 10px', fontSize: 12 }} onClick={applySourceFilter}>Apply</button>
              </div>
            </div>
          )}
        </div>

        <div className={`fbtn ${appliedUniqueField.length ? 'act' : ''}`} onClick={() => setOpenDropdown(openDropdown === 'field' ? null : 'field')}>
          <i className="ti ti-key" style={{ fontSize: 13 }} /> Unique Field
          <i className="ti ti-chevron-down" style={{ fontSize: 11 }} />
          {openDropdown === 'field' && (
            <div className="dd open" style={{ width: 220 }} onClick={(e) => e.stopPropagation()}>
              <div className="dd-hd">Matched Unique Field</div>
              {UNIQUE_FIELD_LIST.map((f) => (
                <div key={f} className="dd-item" onClick={() => toggleUniqueField(f)}>
                  <div className={`cb ${appliedUniqueField.includes(f) ? 'on' : ''}`} />{f}
                </div>
              ))}
              <div className="dd-sep" />
              <div className="dd-apply">
                <button className="btn-s" style={{ padding: '5px 10px', fontSize: 12 }} onClick={clearUniqueField}>Clear</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {(appliedDatePreset || appliedSource.length > 0 || appliedUniqueField.length > 0) && (
        <div className="fchips">
          {appliedDatePreset && (
            <div className="fchip">
              <i className="ti ti-calendar" style={{ fontSize: 12 }} /> {dateLabel}
              <span className="fchip-x" onClick={resetDateFilter}>×</span>
            </div>
          )}
          {appliedSource.length > 0 && (
            <div className="fchip">
              <i className="ti ti-filter" style={{ fontSize: 12 }} /> {appliedSource.length > 1 ? `${appliedSource.length} sources` : appliedSource[0]}
              <span className="fchip-x" onClick={clearSourceFilter}>×</span>
            </div>
          )}
          {appliedUniqueField.length > 0 && (
            <div className="fchip">
              <i className="ti ti-key" style={{ fontSize: 12 }} /> {appliedUniqueField.join(', ')}
              <span className="fchip-x" onClick={clearUniqueField}>×</span>
            </div>
          )}
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="bbar">
          <span className="bbar-cnt">{selectedIds.size} selected</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, position: 'relative' }}>
            <div className="kebab-ic" onClick={() => setBulkMenuOpen((o) => !o)}>
              <i className="ti ti-dots-vertical" />
              {bulkMenuOpen && (
                <div className="dd open" style={{ minWidth: 160, right: 0, left: 'auto', top: 'calc(100% + 6px)' }} onClick={(e) => e.stopPropagation()}>
                  <div className="dd-item" onClick={() => { setDownloadOpen(true); setBulkMenuOpen(false); }}>
                    <i className="ti ti-download" style={{ fontSize: 14, color: 'var(--acc)' }} /> Download
                  </div>
                  <div className="dd-sep" />
                  <div className="dd-item" style={{ color: '#991B1B' }} onClick={handleBulkDelete}>
                    <i className="ti ti-trash" style={{ fontSize: 14, color: '#991B1B' }} /> Delete
                  </div>
                </div>
              )}
            </div>
            <span style={{ cursor: 'pointer', color: 'var(--t3)', fontSize: 22, lineHeight: 1, padding: '0 4px' }} onClick={clearSelection}>×</span>
          </div>
        </div>
      )}

      <div className="lb">
        <div className="tw">
          <table className="tbl clk">
            <thead>
              <tr>
                <th style={{ width: 36, padding: '9px 10px', textAlign: 'center' }}>
                  <div className={`cb ${allOnPageSelected ? 'on' : ''}`} onClick={toggleAllOnPage} style={{ margin: 'auto' }} />
                </th>
                <th style={{ width: 175 }}>Incoming Duplicate Lead Name</th>
                <th style={{ width: 190 }}>Matched Lead</th>
                <th style={{ width: 150 }}>Matched Unique Field</th>
                <th style={{ width: 150 }}>Lead Inflow Source</th>
                <th style={{ width: 165 }}>User Registration Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6}><div className="empty">Loading…</div></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6}><div className="empty"><i className="ti ti-search-off" />No records match your filters.</div></td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} onClick={() => setDrawerRow(r)}>
                    <td style={{ padding: '11px 10px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <div className={`cb ${selectedIds.has(r.id) ? 'on' : ''}`} onClick={() => toggleRow(r.id)} style={{ margin: 'auto' }} />
                    </td>
                    <td><div className="ln">{r.incomingLeadName}</div></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div>
                          <div className="ln">{r.matchedLeadName}</div>
                          <div className="lid" onClick={(e) => { e.stopPropagation(); setDrawerRow(r); }} style={{ cursor: 'pointer' }}>{r.matchedLeadRef}</div>
                        </div>
                        <div className="lead-ics" onClick={(e) => e.stopPropagation()}>
                          <span className="lead-ic" onClick={(e) => { e.stopPropagation(); setDrawerRow(r); }} title="View matched lead details"><i className="ti ti-eye" /></span>
                          <span className="lead-ic" onClick={() => showToast('Redirecting to lead profile...')} title="Open lead profile"><i className="ti ti-external-link" /></span>
                        </div>
                      </div>
                    </td>
                    <td><span className="tag t-blue">{r.matchedField}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--t2)' }}>{r.leadInflowSource}</td>
                    <td style={{ fontSize: 12, color: 'var(--t2)', whiteSpace: 'nowrap' }}>{r.userRegistrationDate}</td>
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

      <RecordDrawer row={drawerRow} onClose={() => setDrawerRow(null)} showToast={showToast} />
      <DownloadPanel
        open={downloadOpen}
        onClose={() => setDownloadOpen(false)}
        filterParams={filterParams}
        showToast={showToast}
      />
    </>
  );
}
