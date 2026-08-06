import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';

// Handles a lead's whole duplicate group in one pass, whether it has 1 duplicate or 19.
// Instead of an N-wide comparison table (unreadable past 3-4 columns), each field collapses
// to a short list of distinct candidate values with a "used by N lead(s)" count - that list
// stays the same length no matter how big the group gets.
const FIELD_PREVIEW_COUNT = 6;
const KEY_FIELDS = ['Name', 'Registered Email', 'Registered Mobile', 'Aadhaar Card', 'Lead Stage', 'Country', 'State', 'City'];

// Indian states — used to enforce Country → State → City dependency when Country = India.
// Non-India country selections show all available state options (no filtering).
const INDIA_STATES = new Set([
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan',
  'Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu',
  'Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry',
]);

function isIndianCountry(val) {
  if (!val) return false;
  const v = val.trim().toLowerCase();
  return v === 'india' || v === 'in';
}

export default function GroupMergeModal({ leadId, anchorName, open, onClose, onMerged, showToast }) {
  const [animOpen, setAnimOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState(null);
  const [excluded, setExcluded] = useState(() => new Set());
  const [selections, setSelections] = useState({});
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldSearch, setFieldSearch] = useState('');
  const [showAllFields, setShowAllFields] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAnimOpen(false);
    setLoading(true);
    setConfirmed(false);
    setExcluded(new Set());
    setFieldSearch('');
    setShowAllFields(false);
    const t = setTimeout(() => setAnimOpen(true), 10);
    api.getDuplicateGroup(leadId)
      .then((data) => {
        setGroup(data);
        const initial = {};
        data.fieldsToReview.forEach((f) => {
          const anchorOpt = f.options.find((o) => o.isAnchor) || f.options[0];
          initial[f.field] = anchorOpt.leadIds[0];
        });
        setSelections(initial);
      })
      .catch((err) => showToast(err.message, false))
      .finally(() => setLoading(false));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, leadId]);

  const includedDuplicates = useMemo(() => {
    if (!group) return [];
    return group.duplicates.filter((d) => !excluded.has(d.duplicateRecordId));
  }, [group, excluded]);

  const includedLeadIds = useMemo(() => new Set([leadId, ...includedDuplicates.map((d) => d.leadId)]), [leadId, includedDuplicates]);

  // Options are computed once against the full group; filter each one down to leads still
  // in play so excluding a duplicate can't leave a stale count or a selection pointing at
  // a lead that's no longer part of this merge.
  const visibleFields = useMemo(() => {
    if (!group) return [];
    return group.fieldsToReview
      .map((f) => ({
        ...f,
        options: f.options
          .map((o) => ({ ...o, leadIds: o.leadIds.filter((id) => includedLeadIds.has(id)) }))
          .filter((o) => o.leadIds.length > 0),
      }))
      .filter((f) => f.options.length > 1);
  }, [group, includedLeadIds]);

  // Filtering options above can strand a selection on a lead that just got excluded -
  // snap that field back to its anchor value so the dropdown never renders with nothing picked.
  useEffect(() => {
    setSelections((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const f of visibleFields) {
        const stillValid = f.options.some((o) => o.leadIds.includes(next[f.field]));
        if (!stillValid) {
          const anchorOpt = f.options.find((o) => o.isAnchor) || f.options[0];
          next[f.field] = anchorOpt.leadIds[0];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [visibleFields]);

  // Identifying fields (Name/Email/Mobile/...) surface first regardless of how many other
  // fields differ - a 19-way junk-data group can produce 80+ differing fields, and the ones
  // that actually matter for a merge decision shouldn't be buried in that list.
  const orderedFields = useMemo(() => {
    const rank = (f) => {
      const i = KEY_FIELDS.indexOf(f.field);
      return i === -1 ? KEY_FIELDS.length : i;
    };
    return [...visibleFields].sort((a, b) => rank(a) - rank(b));
  }, [visibleFields]);

  const filteredFields = useMemo(() => {
    const term = fieldSearch.trim().toLowerCase();
    if (!term) return orderedFields;
    return orderedFields.filter((f) => f.field.toLowerCase().includes(term));
  }, [orderedFields, fieldSearch]);

  const isSearching = fieldSearch.trim().length > 0;
  const displayFields = isSearching || showAllFields ? filteredFields : filteredFields.slice(0, FIELD_PREVIEW_COUNT);
  const hiddenCount = filteredFields.length - displayFields.length;

  if (!open) return null;

  const handleClose = () => {
    setAnimOpen(false);
    setTimeout(onClose, 260);
  };

  const toggleExclude = (duplicateRecordId) => {
    setExcluded((s) => {
      const next = new Set(s);
      if (next.has(duplicateRecordId)) next.delete(duplicateRecordId);
      else next.add(duplicateRecordId);
      return next;
    });
  };

  const pickOption = (field, sourceLeadId) => {
    setSelections((s) => ({ ...s, [field]: sourceLeadId }));
  };

  const resetAllToCurrent = () => {
    const next = {};
    visibleFields.forEach((f) => {
      const anchorOpt = f.options.find((o) => o.isAnchor) || f.options[0];
      next[f.field] = anchorOpt.leadIds[0];
    });
    setSelections(next);
  };

  const handleSave = () => {
    if (!group || !confirmed || includedDuplicates.length === 0) return;
    setSaving(true);
    const fieldSelections = visibleFields
      .filter((f) => selections[f.field] !== undefined)
      .map((f) => ({ field: f.field, sourceLeadId: selections[f.field] }));
    api.mergeDuplicateGroup(leadId, {
      duplicateRecordIds: includedDuplicates.map((d) => d.duplicateRecordId),
      fieldSelections,
    })
      .then((res) => {
        showToast(`Lead updated. ${res.fieldsChanged} field(s) changed, ${res.removedLeadIds.length} duplicate lead(s) removed.`);
        onMerged();
      })
      .catch((err) => showToast(err.message, false))
      .finally(() => setSaving(false));
  };

  return (
    <div className="dwo open" onClick={handleClose}>
      <div className={`dw ${animOpen ? 'open' : ''}`} style={{ width: 620 }} onClick={(e) => e.stopPropagation()}>
        <div className="dw-hd">
          <div className="dw-t">Review and Update Lead Details</div>
          <div className="dw-cl" onClick={handleClose}><i className="ti ti-x" /></div>
        </div>
        <div className="dw-body">
          {loading ? (
            <div className="empty">Loading duplicate group…</div>
          ) : !group || group.duplicates.length === 0 ? (
            <div className="empty">No duplicate leads to review.</div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 14 }}>
                <strong>{anchorName}</strong> matched <strong>{group.duplicates.length}</strong> other lead{group.duplicates.length === 1 ? '' : 's'} on <span className="tag t-blue">{group.matchedField}</span>. Uncheck any you want to leave for later.
              </div>

              <div className="dw-sec-t">Duplicate leads ({includedDuplicates.length} of {group.duplicates.length} selected)</div>
              {group.duplicates.map((d) => (
                <div key={d.duplicateRecordId} className={`gm-dup-item ${excluded.has(d.duplicateRecordId) ? 'excluded' : ''}`}>
                  <div className={`cb ${!excluded.has(d.duplicateRecordId) ? 'on' : ''}`} onClick={() => toggleExclude(d.duplicateRecordId)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="gm-dup-name">{d.name || 'No Name'}</div>
                    <div className="gm-dup-meta">{d.matchedValue} · {d.leadInflowSource} · {d.userRegistrationDate || 'NA'}</div>
                  </div>
                </div>
              ))}

              <div className="dw-div" />

              {visibleFields.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 14 }}>
                  No differing fields among the selected leads — saving will just remove the duplicate(s).
                </div>
              ) : (
                <>
                  <div className="gm-fields-hd">
                    <div className="dw-sec-t" style={{ marginBottom: 0 }}>Fields to reconcile ({visibleFields.length})</div>
                    <span className="widget-expand-link" onClick={resetAllToCurrent}>Reset all to current values</span>
                  </div>

                  {visibleFields.length > FIELD_PREVIEW_COUNT && (
                    <div className="sw gm-field-search">
                      <i className="ti ti-search" />
                      <input
                        placeholder={`Search ${visibleFields.length} fields…`}
                        value={fieldSearch}
                        onChange={(e) => setFieldSearch(e.target.value)}
                      />
                    </div>
                  )}

                  {displayFields.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--t3)', margin: '10px 0' }}>No fields match "{fieldSearch}".</div>
                  ) : (() => {
                    // Resolve the currently selected Country value (if Country is in the reconcile list)
                    const countryField = visibleFields.find((f) => f.field === 'Country');
                    let selectedCountryVal = null;
                    if (countryField) {
                      const selLeadId = selections['Country'];
                      const selOpt = countryField.options.find((o) => o.leadIds.includes(selLeadId));
                      selectedCountryVal = selOpt ? selOpt.value : null;
                    }
                    const indiaSelected = isIndianCountry(selectedCountryVal);

                    return (
                      <div className="gm-field-tbl">
                        {displayFields.map((f) => {
                          // For State: if Country is being reconciled and India is selected,
                          // filter to only Indian state options. Show an info note if filtered.
                          let options = f.options;
                          let dependencyNote = null;
                          if (f.field === 'State' && countryField && indiaSelected) {
                            const filtered = f.options.filter((o) => !o.value || INDIA_STATES.has(o.value.trim()));
                            if (filtered.length < f.options.length) {
                              options = filtered.length > 0 ? filtered : f.options;
                              dependencyNote = `Showing Indian states only (Country = ${selectedCountryVal})`;
                            }
                          }
                          // For City: no global city list — just show a dependency note that City
                          // should correspond to the selected State.
                          if (f.field === 'City' && countryField && indiaSelected) {
                            dependencyNote = 'Select a city consistent with the chosen State';
                          }

                          return (
                            <div key={f.field} className="gm-field-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                              <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8 }}>
                                <div className="gm-field-name">{f.field}</div>
                                <select
                                  className="sel"
                                  style={{ flex: 1 }}
                                  value={String(selections[f.field])}
                                  onChange={(e) => pickOption(f.field, Number(e.target.value))}
                                >
                                  {options.map((o) => (
                                    <option key={o.leadIds[0]} value={o.leadIds[0]}>
                                      {o.isAnchor ? `Current: ${o.value || '—'}` : `${o.value || '—'} (used by ${o.count} lead${o.count === 1 ? '' : 's'})`}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              {dependencyNote && (
                                <div style={{ fontSize: 11, color: '#6B7280', paddingLeft: 100, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <i className="ti ti-info-circle" style={{ fontSize: 11 }} /> {dependencyNote}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {!isSearching && hiddenCount > 0 && (
                    <span className="widget-expand-link" style={{ marginLeft: 0, marginTop: 8, display: 'inline-flex' }} onClick={() => setShowAllFields(true)}>
                      Show {hiddenCount} more field{hiddenCount === 1 ? '' : 's'} <i className="ti ti-chevron-down" style={{ fontSize: 11 }} />
                    </span>
                  )}
                </>
              )}

              <div className="cb-row" style={{ marginTop: 16 }}>
                <div className={`cb ${confirmed ? 'on' : ''}`} onClick={() => setConfirmed((c) => !c)} />
                <span style={{ fontSize: 12 }}>I understand {includedDuplicates.length} duplicate lead{includedDuplicates.length === 1 ? '' : 's'} will be permanently deleted.</span>
              </div>
            </>
          )}
        </div>
        <div className="dw-footer">
          <button className="btn-s" style={{ flex: 1 }} onClick={handleClose}>Cancel</button>
          <button
            className="btn-p"
            style={{ flex: 2 }}
            disabled={loading || saving || !group || includedDuplicates.length === 0 || !confirmed}
            onClick={handleSave}
          >
            {saving ? 'Saving…' : `Save & Remove ${includedDuplicates.length || ''} Duplicate${includedDuplicates.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
