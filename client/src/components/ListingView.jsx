import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { REPORT_SOURCE_LIST, UNIQUE_FIELD_LIST, DATE_PRESETS, dateRangeForPreset } from '../constants';
import RecordDrawer from './RecordDrawer';

const SEARCH_TYPES = [
  { key: 'email',   label: 'Email',   placeholder: 'Search by email…' },
  { key: 'mobile',  label: 'Mobile',  placeholder: 'Search by mobile…' },
  { key: 'name',    label: 'Name',    placeholder: 'Search by name…' },
  { key: 'lead_id', label: 'Lead Id', placeholder: 'Search by Lead ID…' },
];

const FIXED_DOWNLOAD_COLS = [
  'Incoming Lead Name', 'Incoming Lead Email', 'Incoming Lead Mobile',
  'Matched Lead Name', 'Matched Lead ID', 'Matched Unique Field',
  'Duplicate Value', 'Lead Origin', 'Detected On',
];

export default function ListingView({ initialSource, showToast, goSettings, openLeadProfile }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);

  // search
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchType, setSearchType] = useState('email');
  const [searchTypeOpen, setSearchTypeOpen] = useState(false);
  const [q, setQ] = useState('');
  const searchInputRef = useRef(null);

  // filter bar
  const [filterBarOpen, setFilterBarOpen] = useState(false);
  const [activeBarFilter, setActiveBarFilter] = useState(null); // 'date' | 'origin' | 'field' | null

  // applied filters (no draft — bar applies immediately)
  const [appliedSource, setAppliedSource] = useState(initialSource ? [initialSource] : []);
  const [appliedUniqueField, setAppliedUniqueField] = useState([]);
  const [appliedDatePreset, setAppliedDatePreset] = useState(null);
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');

  // selection — keyed by incomingLeadId
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [drawerRow, setDrawerRow] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // close dropdowns on outside click
  useEffect(() => {
    function onDocClick(e) {
      if (!e.target.closest('.filter-bar') && !e.target.closest('.filter-btn')) {
        setActiveBarFilter(null);
      }
      if (!e.target.closest('.kebab-ic')) setBulkMenuOpen(false);
      if (!e.target.closest('.search-type-wrap')) setSearchTypeOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => { setQ(searchInput); setPage(1); setRevealed(false); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // focus input when search expands
  useEffect(() => {
    if (searchExpanded) setTimeout(() => searchInputRef.current?.focus(), 50);
  }, [searchExpanded]);

  const filterParams = useMemo(() => {
    const params = { page, pageSize };
    if (appliedSource.length) params.source = appliedSource.join(',');
    if (appliedUniqueField.length) params.uniqueField = appliedUniqueField.join(',');
    if (q.trim()) { params.q = q.trim(); params.searchField = searchType; }
    if (appliedDatePreset) {
      const { from, to } = dateRangeForPreset(appliedDatePreset, appliedFrom, appliedTo);
      if (from) params.dateFrom = from;
      if (to) params.dateTo = to;
    }
    return params;
  }, [page, pageSize, appliedSource, appliedUniqueField, q, searchType, appliedDatePreset, appliedFrom, appliedTo]);

  useEffect(() => {
    setLoading(true);
    api.getRecords(filterParams)
      .then((data) => { setRows(data.rows); setTotal(data.total); })
      .catch((err) => showToast(err.message, false))
      .finally(() => setLoading(false));
  }, [filterParams]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const activeFilterCount =
    (appliedSource.length ? 1 : 0) +
    (appliedUniqueField.length ? 1 : 0) +
    (appliedDatePreset ? 1 : 0);
  const dateLabel = appliedDatePreset
    ? DATE_PRESETS.find((d) => d.key === appliedDatePreset)?.label
    : null;
  const currentSearchType = SEARCH_TYPES.find((t) => t.key === searchType);

  const resetAllFilters = () => {
    setAppliedSource([]);
    setAppliedUniqueField([]);
    setAppliedDatePreset(null);
    setAppliedFrom('');
    setAppliedTo('');
    setPage(1);
    setRevealed(false);
    setActiveBarFilter(null);
  };

  // row selection — keyed by incomingLeadId
  const toggleRow = (incomingLeadId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(incomingLeadId)) next.delete(incomingLeadId);
      else next.add(incomingLeadId);
      return next;
    });
  };
  const allOnPageSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.incomingLeadId));
  const toggleAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) rows.forEach((r) => next.delete(r.incomingLeadId));
      else rows.forEach((r) => next.add(r.incomingLeadId));
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkDelete = () => {
    const ids = [...selectedIds];
    api.bulkDelete(ids)
      .then(() => {
        showToast(`Deleted ${ids.length} record group${ids.length === 1 ? '' : 's'}.`);
        clearSelection();
        setBulkMenuOpen(false);
        api.getRecords(filterParams).then((data) => { setRows(data.rows); setTotal(data.total); });
      })
      .catch((err) => showToast(err.message, false));
  };

  const handleDownload = () => {
    setDownloading(true);
    setBulkMenuOpen(false);
    api.queueDownload(FIXED_DOWNLOAD_COLS, { ...filterParams })
      .then((res) => {
        showToast(`Download ready — ${res.rowCount.toLocaleString()} record${res.rowCount === 1 ? '' : 's'}.`);
        if (res.fileUrl) {
          const link = document.createElement('a');
          link.href = res.fileUrl;
          link.download = '';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      })
      .catch((err) => showToast(err.message, false))
      .finally(() => setDownloading(false));
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => showToast('Copied!'));
  };

  // filter bar field label/value helpers
  const dateFieldLabel = appliedDatePreset ? dateLabel : null;
  const originFieldLabel = appliedSource.length === 0
    ? null
    : appliedSource.length === 1
      ? appliedSource[0]
      : `${appliedSource.length} selected`;
  const fieldFieldLabel = appliedUniqueField.length === 0
    ? null
    : appliedUniqueField.length === 1
      ? appliedUniqueField[0]
      : `${appliedUniqueField.length} selected`;

  return (
    <>
      <div className="lp-hd">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="bcrumb">
            <span className="blink" onClick={goSettings}>
              <i className="ti ti-arrow-left" style={{ fontSize: 12 }} /> Lead Duplication Settings
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="lp-t">Duplicate Lead Records</div>
            {appliedSource.length === 1 && <span className="lp-src-badge">{appliedSource[0]}</span>}
          </div>

          {/* Search + Filter toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Search */}
            {!searchExpanded ? (
              <button className="icon-btn" title="Search" onClick={() => setSearchExpanded(true)}>
                <i className="ti ti-search" style={{ fontSize: 15 }} />
              </button>
            ) : (
              <div className="search-type-wrap" style={{ display: 'flex', alignItems: 'center', gap: 0, background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 6, overflow: 'visible', position: 'relative' }}>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRight: '1px solid var(--bd)', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: 'var(--t1)', userSelect: 'none', position: 'relative' }}
                  onClick={(e) => { e.stopPropagation(); setSearchTypeOpen((o) => !o); }}
                >
                  {currentSearchType.label}
                  <i className="ti ti-chevron-down" style={{ fontSize: 10, color: 'var(--t3)' }} />
                  {searchTypeOpen && (
                    <div className="dd open" style={{ top: 'calc(100% + 4px)', left: 0, minWidth: 140, padding: '4px 0' }} onClick={(e) => e.stopPropagation()}>
                      {SEARCH_TYPES.map((t) => (
                        <div
                          key={t.key}
                          className="dd-item"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                          onClick={() => { setSearchType(t.key); setSearchTypeOpen(false); setQ(''); setSearchInput(''); setPage(1); }}
                        >
                          <span>{t.label}</span>
                          {t.key === searchType
                            ? <i className="ti ti-star-filled" style={{ fontSize: 13, color: '#F59E0B' }} />
                            : <i className="ti ti-star" style={{ fontSize: 13, color: 'var(--t3)' }} />
                          }
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={currentSearchType.placeholder}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  style={{ border: 'none', outline: 'none', background: 'transparent', padding: '5px 10px', fontSize: 12, width: 200, color: 'var(--t1)' }}
                />
                <i
                  className="ti ti-x"
                  style={{ fontSize: 13, color: 'var(--t3)', cursor: 'pointer', padding: '0 10px' }}
                  onClick={() => { setSearchExpanded(false); setSearchInput(''); setQ(''); setPage(1); setRevealed(false); }}
                />
              </div>
            )}

            {/* Filter icon — toggles horizontal filter bar */}
            <button
              className={`icon-btn filter-btn ${activeFilterCount > 0 ? 'act' : ''}`}
              title="Filters"
              style={{ position: 'relative' }}
              onClick={() => { setFilterBarOpen((o) => !o); setActiveBarFilter(null); }}
            >
              <i className="ti ti-filter" style={{ fontSize: 15 }} />
              {activeFilterCount > 0 && (
                <span style={{ position: 'absolute', top: -4, right: -4, background: 'var(--acc)', color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal filter bar */}
      {filterBarOpen && (
        <div className="filter-bar">
          {/* Date Range */}
          <div
            className={`fbar-field ${activeBarFilter === 'date' || appliedDatePreset ? 'act' : ''}`}
            onClick={(e) => { e.stopPropagation(); setActiveBarFilter(activeBarFilter === 'date' ? null : 'date'); }}
          >
            <div className="fbar-lbl">Date Range</div>
            <div className={`fbar-val${!dateFieldLabel ? ' ph' : ''}`}>
              <span>{dateFieldLabel || 'Select Here'}</span>
              <i className="ti ti-calendar" style={{ fontSize: 12, flexShrink: 0 }} />
            </div>
            {activeBarFilter === 'date' && (
              <div className="dd open" style={{ top: 'calc(100% + 4px)', left: 0, minWidth: 190, padding: '4px 0', zIndex: 200 }} onClick={(e) => e.stopPropagation()}>
                {DATE_PRESETS.map((d) => (
                  <div
                    key={d.key}
                    className={`dd-item ${appliedDatePreset === d.key ? 'on' : ''}`}
                    onClick={() => {
                      setAppliedDatePreset(appliedDatePreset === d.key ? null : d.key);
                      if (d.key !== 'custom') setActiveBarFilter(null);
                      setPage(1); setRevealed(false);
                    }}
                  >
                    {d.label}
                    {appliedDatePreset === d.key && <i className="ti ti-check" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--acc)' }} />}
                  </div>
                ))}
                {appliedDatePreset === 'custom' && (
                  <div style={{ padding: '4px 14px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 3 }}>From</div>
                      <input type="date" className="sel" style={{ width: '100%', padding: '4px 6px', fontSize: 11 }} value={appliedFrom} onChange={(e) => { setAppliedFrom(e.target.value); setPage(1); }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 3 }}>To</div>
                      <input type="date" className="sel" style={{ width: '100%', padding: '4px 6px', fontSize: 11 }} value={appliedTo} onChange={(e) => { setAppliedTo(e.target.value); setPage(1); }} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Lead Origin */}
          <div
            className={`fbar-field ${activeBarFilter === 'origin' || appliedSource.length > 0 ? 'act' : ''}`}
            onClick={(e) => { e.stopPropagation(); setActiveBarFilter(activeBarFilter === 'origin' ? null : 'origin'); }}
          >
            <div className="fbar-lbl">Lead Origin</div>
            <div className={`fbar-val${!originFieldLabel ? ' ph' : ''}`}>
              <span>{originFieldLabel || 'Select Here'}</span>
              <i className="ti ti-chevron-down" style={{ fontSize: 12, flexShrink: 0 }} />
            </div>
            {activeBarFilter === 'origin' && (
              <div className="dd open" style={{ top: 'calc(100% + 4px)', left: 0, minWidth: 230, padding: '4px 0', zIndex: 200 }} onClick={(e) => e.stopPropagation()}>
                {REPORT_SOURCE_LIST.map((s) => (
                  <div
                    key={s}
                    className="dd-item"
                    onClick={() => {
                      setAppliedSource((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
                      setPage(1); setRevealed(false);
                    }}
                  >
                    <div className={`cb ${appliedSource.includes(s) ? 'on' : ''}`} style={{ flexShrink: 0 }} />{s}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Unique Field */}
          <div
            className={`fbar-field ${activeBarFilter === 'field' || appliedUniqueField.length > 0 ? 'act' : ''}`}
            onClick={(e) => { e.stopPropagation(); setActiveBarFilter(activeBarFilter === 'field' ? null : 'field'); }}
          >
            <div className="fbar-lbl">Unique Field</div>
            <div className={`fbar-val${!fieldFieldLabel ? ' ph' : ''}`}>
              <span>{fieldFieldLabel || 'Select Here'}</span>
              <i className="ti ti-chevron-down" style={{ fontSize: 12, flexShrink: 0 }} />
            </div>
            {activeBarFilter === 'field' && (
              <div className="dd open" style={{ top: 'calc(100% + 4px)', left: 0, minWidth: 200, padding: '4px 0', zIndex: 200 }} onClick={(e) => e.stopPropagation()}>
                {UNIQUE_FIELD_LIST.map((f) => (
                  <div
                    key={f}
                    className="dd-item"
                    onClick={() => {
                      setAppliedUniqueField((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);
                      setPage(1); setRevealed(false);
                    }}
                  >
                    <div className={`cb ${appliedUniqueField.includes(f) ? 'on' : ''}`} style={{ flexShrink: 0 }} />{f}
                  </div>
                ))}
              </div>
            )}
          </div>

          {activeFilterCount > 0 && (
            <div className="fbar-reset" onClick={resetAllFilters}>Reset all</div>
          )}
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="bbar">
          <span className="bbar-cnt">{selectedIds.size} selected</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, position: 'relative' }}>
            <div className="kebab-ic" onClick={() => setBulkMenuOpen((o) => !o)}>
              <i className="ti ti-dots-vertical" />
              {bulkMenuOpen && (
                <div className="dd open" style={{ minWidth: 160, right: 0, left: 'auto', top: 'calc(100% + 6px)' }} onClick={(e) => e.stopPropagation()}>
                  <div className="dd-item" onClick={handleDownload}>
                    <i className="ti ti-download" style={{ fontSize: 14, color: 'var(--acc)' }} /> {downloading ? 'Downloading…' : 'Download'}
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
                <th style={{ width: 160 }}>Incoming Duplicate Lead</th>
                <th style={{ width: 160 }}>Duplicate Value</th>
                <th style={{ width: 200 }}>Matched Lead</th>
                <th style={{ width: 150 }}>Matched Unique Field</th>
                <th style={{ width: 130 }}>Lead Origin</th>
                <th style={{ width: 145 }}>Detected On</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}><div className="empty">Loading…</div></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7}><div className="empty"><i className="ti ti-search-off" />No records match your filters.</div></td></tr>
              ) : (
                rows.map((r) => {
                  const isMulti = r.matchCount > 1;
                  return (
                    <tr
                      key={r.incomingLeadId}
                      onClick={() => setDrawerRow(r)}
                    >
                      <td style={{ padding: '11px 10px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <div className={`cb ${selectedIds.has(r.incomingLeadId) ? 'on' : ''}`} onClick={() => toggleRow(r.incomingLeadId)} style={{ margin: 'auto' }} />
                      </td>

                      {/* Incoming Duplicate Lead */}
                      <td style={{ fontSize: 12, color: 'var(--t1)' }}>
                        {r.incomingLeadName || '—'}
                      </td>

                      {/* Duplicate Value */}
                      <td style={{ fontSize: 12, color: 'var(--t2)', fontFamily: 'monospace' }}>
                        {r.incomingValue || '—'}
                      </td>

                      {/* Matched Lead */}
                      <td>
                        {isMulti ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div>
                              <div className="lid" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                {r.matchedLeadRef}
                                <i
                                  className="ti ti-copy"
                                  style={{ fontSize: 11, color: 'var(--t3)', cursor: 'pointer' }}
                                  title="Copy Lead ID"
                                  onClick={(e) => { e.stopPropagation(); copyToClipboard(r.matchedLeadRef); }}
                                />
                              </div>
                              <span
                                className="multi-lead-badge"
                                style={{ marginTop: 3, display: 'inline-block' }}
                                onClick={(e) => { e.stopPropagation(); setDrawerRow(r); }}
                              >
                                +{r.matchCount - 1} more
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div>
                              <div className="ln" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {r.matchedLeadName}
                              </div>
                              <div className="lid" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                {r.matchedLeadRef}
                                <i
                                  className="ti ti-copy"
                                  style={{ fontSize: 11, color: 'var(--t3)', cursor: 'pointer' }}
                                  title="Copy Lead ID"
                                  onClick={(e) => { e.stopPropagation(); copyToClipboard(r.matchedLeadRef); }}
                                />
                              </div>
                            </div>
                            <div className="lead-ics" onClick={(e) => e.stopPropagation()}>
                              <span className="lead-ic" onClick={(e) => { e.stopPropagation(); setDrawerRow(r); }} title="View details"><i className="ti ti-eye" /></span>
                              <span className="lead-ic" onClick={(e) => { e.stopPropagation(); openLeadProfile(r.matchedLeadId); }} title="Open lead profile"><i className="ti ti-external-link" /></span>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Matched Unique Field */}
                      <td><span className="tag t-blue">{r.matchedField}</span></td>

                      {/* Lead Origin */}
                      <td style={{ fontSize: 12, color: 'var(--t2)' }}>{r.leadInflowSource}</td>

                      {/* Detected On */}
                      <td style={{ fontSize: 12, color: 'var(--t2)', whiteSpace: 'nowrap' }}>{r.userRegistrationDate}</td>
                    </tr>
                  );
                })
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
        <select className="sel" style={{ padding: '3px 8px', fontSize: 12 }} value={pageSize} onChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(1); }}>
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
          {totalPages > 3 && <div className={`pb ${page === totalPages ? 'on' : ''}`} onClick={() => setPage(totalPages)}>{totalPages}</div>}
          <div className={`pb ${page >= totalPages ? 'disabled' : ''}`} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            <i className="ti ti-chevron-right" style={{ fontSize: 12 }} />
          </div>
        </div>
      </div>

      <RecordDrawer row={drawerRow} onClose={() => setDrawerRow(null)} showToast={showToast} openLeadProfile={openLeadProfile} />
    </>
  );
}
