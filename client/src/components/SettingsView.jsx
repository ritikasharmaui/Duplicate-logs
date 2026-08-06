import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api';

export default function SettingsView({ showToast, openListingSameTab, openListingNewTab }) {
  const [duplicationOpen, setDuplicationOpen] = useState(true);
  const [sources, setSources] = useState([]);
  const [widgets, setWidgets] = useState([]);
  const [widgetSubOpen, setWidgetSubOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.getSettings()
      .then((data) => {
        setSources(data.sources);
        setWidgets(data.widgets);
      })
      .catch((err) => showToast(err.message, false))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const updateSource = (sourceKey, patch) => {
    setSources((prev) => prev.map((s) => (s.sourceKey === sourceKey ? { ...s, ...patch } : s)));
  };

  const updateWidget = (id, raOption) => {
    setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, raOption } : w)));
  };

  const handleSave = () => {
    setSaving(true);
    api.saveSettings({ sources, widgets, modifiedBy: 'Ritika Sharma' })
      .then(() => {
        showToast('Changes saved successfully!');
        load();
      })
      .catch((err) => showToast(err.message, false))
      .finally(() => setSaving(false));
  };

  const handleCancel = () => {
    load();
    showToast('No unsaved changes.', false);
  };

  return (
    <>
      <div className="snav">
        <div className="sn-title">Configure</div>
        <div className="sn-item on">CRM</div>
        <div className="sn-item">Security</div>
        <div className="sn-item">Account Setup</div>
        <div className="sn-item">Communication</div>
        <div className="sn-item">Campaign Management</div>
        <div className="sn-item">Query Manager</div>
        <div className="sn-item">Integrations</div>
      </div>
      <div className="rc">
        <div className="tabs">
          <div className="tab on">Lead Flow</div>
          <div className="tab">Lead Stage</div>
          <div className="tab">Conversion Funnel</div>
          <div className="tab">Campaign Settings</div>
          <div className="tab">Lead Allocation</div>
          <div className="tab">Lead Score</div>
          <div className="tab">Custom</div>
        </div>
        <div className="ca">
          <div className="acc">
            <div className="acc-hd">
              <div>
                <div className="acc-t">Lead Verification Settings</div>
                <div className="acc-st">Configure your settings for Lead verification before registration</div>
              </div>
              <i className="acc-ic ti ti-chevron-down" />
            </div>
            <div className="acc-bd" />
          </div>

          <div className="acc">
            <div className="acc-hd">
              <div>
                <div className="acc-t">Mobile Number Validations</div>
                <div className="acc-st">Configure your rules on Lead creation via Mobile Number</div>
              </div>
              <i className="acc-ic ti ti-chevron-down" />
            </div>
            <div className="acc-bd" />
          </div>

          <div className="acc">
            <div className="acc-hd" onClick={() => setDuplicationOpen((o) => !o)}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="acc-t">Lead Duplication Settings</div>
                  <span style={{ fontSize: 10, padding: '2px 8px', background: '#EEEDFE', color: '#5B4EFF', borderRadius: 10, fontWeight: 600 }}>New</span>
                </div>
                <div className="acc-st">Configure how duplicate leads are handled per inflow — log registration attempts, report to Duplicate Lead Records, or both</div>
              </div>
              <i className="acc-ic ti ti-chevron-down" style={{ transform: duplicationOpen ? 'rotate(180deg)' : 'none' }} />
            </div>
            <div className={`acc-bd ${duplicationOpen ? 'open' : ''}`}>
              {loading ? (
                <div style={{ padding: 24, color: 'var(--t2)' }}>Loading settings…</div>
              ) : (
                <>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th style={{ width: 220 }}>Lead Origin</th>
                          <th style={{ width: 260 }}>
                            Registration Attempt{' '}
                            <i className="ti ti-info-circle" style={{ fontSize: 12, color: '#9CA3AF' }} title="When checked, logs a Registration Attempt on duplicate events for this source" />
                          </th>
                          <th style={{ width: 80 }}>
                            Report{' '}
                            <i className="ti ti-info-circle" style={{ fontSize: 12, color: '#9CA3AF' }} title="When checked, generates a Duplicate Lead Record entry (opens in new tab)" />
                          </th>
                          <th style={{ width: 170 }}>Modified On</th>
                          <th style={{ width: 120 }}>Modified By</th>
                          <th style={{ width: 140 }}>Duplicate Records</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sources.map((s) => (
                          <SourceRow
                            key={s.sourceKey}
                            source={s}
                            widgets={widgets}
                            widgetSubOpen={widgetSubOpen}
                            onToggleWidgetSub={() => setWidgetSubOpen((o) => !o)}
                            onChangeRaEnabled={(v) => updateSource(s.sourceKey, { raEnabled: v })}
                            onChangeRaSelected={(v) => updateSource(s.sourceKey, { raSelected: v })}
                            onChangeReportEnabled={(v) => updateSource(s.sourceKey, { reportEnabled: v })}
                            onChangeWidget={updateWidget}
                            onViewRecords={() => openListingSameTab(s.sourceLabel)}
                            onViewRecordsNewTab={() => openListingNewTab(s.sourceLabel)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="save-bar">
                    <button className="btn-s" onClick={handleCancel}>Cancel</button>
                    <button className="btn-p" onClick={handleSave} disabled={saving}>
                      {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                  <div className="ptn-box">
                    <div className="ptn-title">Points to Note</div>
                    <div className="ptn-sec">
                      <div className="ptn-sec-t">APIs</div>
                      <p>Use the key <code className="ptn-code">field_duplicate_log</code> in your API payloads to explicitly trigger duplicate logging for a lead event:</p>
                      <ul className="ptn-list">
                        <li>If <code className="ptn-code">field_duplicate_log</code> is present and set to <strong>Yes</strong>, the event is written to Duplicate Lead Records.</li>
                        <li>If not present, the system follows the configured per-source behaviour.</li>
                      </ul>
                      <p style={{ marginTop: 6 }}>Values accepted: <strong>Yes</strong> | <strong>No</strong>. This field is optional and maintains backward compatibility.</p>
                    </div>
                    <div className="ptn-sec" style={{ marginTop: 12 }}>
                      <div className="ptn-sec-t">Report</div>
                      <p>Sources with the <strong>Report</strong> checkbox enabled (Widget, Landing Page, FB Lead, Google Lead, Zapier Lead) write a Duplicate Lead Record on every duplicate. Use this when you want to log the Duplicate record from the lead creation/inflow sources.</p>
                    </div>
                    <div className="ptn-sec" style={{ marginTop: 12 }}>
                      <div className="ptn-sec-t">Bulk Offline Upload</div>
                      <p>Use the <code className="ptn-code">Field Registration Attempt</code> key to pass a registration attempt during Bulk Offline Upload. Refer to Bulk Offline Upload guidelines for details.</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function SourceRow({
  source, widgets, widgetSubOpen, onToggleWidgetSub,
  onChangeRaEnabled, onChangeRaSelected, onChangeReportEnabled,
  onViewRecords, onViewRecordsNewTab, onChangeWidget,
}) {
  const isWidget = source.specialConfig === 'per_widget';

  let vrCell;
  if (!source.reportEligible) {
    vrCell = <span style={{ fontSize: 12, color: 'var(--t3)' }}>—</span>;
  } else if (!source.reportEnabled) {
    vrCell = <span className="vr-btn off"><i className="ti ti-external-link" style={{ fontSize: 11 }} /> View records</span>;
  } else {
    vrCell = (
      <span className="vr-btn" onClick={onViewRecordsNewTab} title="Opens in a new tab">
        View records ({source.recordCount}) <i className="ti ti-external-link" style={{ fontSize: 11 }} />
      </span>
    );
  }

  return (
    <>
      <tr>
        <td style={{ fontWeight: 500 }}>{source.sourceLabel}</td>
        <td>
          {isWidget && source.raEnabled ? (
            <div className="cb-row">
              <div className="cb on" onClick={() => onChangeRaEnabled(false)} />
              <span>Configured per widget</span>
              <span className="widget-expand-link" onClick={onToggleWidgetSub}>
                {widgetSubOpen ? 'Collapse' : 'Expand'} <i className={`ti ti-chevron-${widgetSubOpen ? 'up' : 'down'}`} style={{ fontSize: 11 }} />
              </span>
            </div>
          ) : (
            <div className="cb-row">
              <div className={`cb ${source.raEnabled ? 'on' : ''}`} onClick={() => onChangeRaEnabled(!source.raEnabled)} />
              <select
                className="sel"
                disabled={!source.raEnabled}
                value={source.raSelected}
                onChange={(e) => onChangeRaSelected(e.target.value)}
              >
                {source.raOptions.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          )}
        </td>
        <td>
          {source.reportEligible ? (
            <div className={`cb ${source.reportEnabled ? 'on' : ''}`} onClick={() => onChangeReportEnabled(!source.reportEnabled)} />
          ) : (
            <span style={{ fontSize: 12, color: 'var(--t3)' }}>—</span>
          )}
        </td>
        <td style={{ color: 'var(--t2)', fontSize: 12 }}>
          {source.modifiedOn ? new Date(source.modifiedOn).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
        </td>
        <td style={{ color: 'var(--t2)', fontSize: 12 }}>{source.modifiedBy || '—'}</td>
        <td>{vrCell}</td>
      </tr>

      {isWidget && source.raEnabled && (
        <tr className="widget-sub-row" style={{ display: widgetSubOpen ? undefined : 'none' }}>
          <td colSpan={6} style={{ padding: 0 }}>
            <div className="widget-sub-inner">
              <table className="widget-sub-tbl">
                <tbody>
                  {WIDGET_RA_ACTIONS.map((action, i) => (
                    <tr key={action}>
                      {i === 0 && (
                        <td rowSpan={WIDGET_RA_ACTIONS.length} style={{ width: 220, verticalAlign: 'top', fontWeight: 600 }}>
                          Select Widget Name{' '}
                          <i className="ti ti-info-circle" style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 400 }} title="Assign widgets to the Registration Attempt behaviour that should apply to them" />
                        </td>
                      )}
                      <td style={{ width: 200 }}>{action}</td>
                      <td>
                        <WidgetMultiSelect widgets={widgets} action={action} onAssign={onChangeWidget} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

const WIDGET_RA_ACTIONS = ['Lead Create or Update', 'Lead Create Only', 'Never'];
const WIDGET_RA_DEFAULT = 'Lead Create or Update';

function WidgetMultiSelect({ widgets, action, onAssign }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const PANEL_HEIGHT_ESTIMATE = 300;
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < PANEL_HEIGHT_ESTIMATE && rect.top > spaceBelow;
      const width = Math.max(rect.width, 260);
      setPos({
        top: openUpward ? undefined : rect.bottom + 4,
        bottom: openUpward ? window.innerHeight - rect.top + 4 : undefined,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        width,
      });
    };
    place();

    const onDocClick = (e) => {
      if (triggerRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onScroll = (e) => {
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    document.addEventListener('mousedown', onDocClick);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const selected = widgets.filter((w) => w.raOption === action);
  const allSelected = widgets.length > 0 && selected.length === widgets.length;
  const filtered = widgets.filter((w) => w.widgetName.toLowerCase().includes(search.toLowerCase()));

  const label = selected.length === 0
    ? 'Select a Widget'
    : selected.length === 1
      ? selected[0].widgetName
      : `${selected.length} widgets selected`;

  const toggleWidget = (w) => {
    if (w.raOption === action) {
      if (action !== WIDGET_RA_DEFAULT) onAssign(w.id, WIDGET_RA_DEFAULT);
    } else {
      onAssign(w.id, action);
    }
  };

  const toggleAll = () => {
    if (allSelected) {
      if (action !== WIDGET_RA_DEFAULT) widgets.forEach((w) => onAssign(w.id, WIDGET_RA_DEFAULT));
    } else {
      widgets.forEach((w) => onAssign(w.id, action));
    }
  };

  return (
    <div className="wms" ref={triggerRef}>
      <div className={`wms-trigger ${selected.length === 0 ? 'placeholder' : ''}`} onClick={() => setOpen((o) => !o)}>
        <span>{label}</span>
        <i className={`ti ti-chevron-${open ? 'up' : 'down'}`} style={{ fontSize: 12 }} />
      </div>
      {open && pos && createPortal(
        <div className="wms-panel" ref={panelRef} style={{ top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width }}>
          <div className="wms-search">
            <i className="ti ti-search" />
            <input
              autoFocus
              placeholder="Search widgets…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="wms-list">
            {filtered.length === 0 ? (
              <div className="wms-empty">No widgets found</div>
            ) : (
              <>
                {!search && (
                  <div
                    className={`wms-item all ${allSelected ? 'checked' : ''}`}
                    onClick={toggleAll}
                  >
                    All Widget <i className="ti ti-check" />
                  </div>
                )}
                {filtered.map((w) => (
                  <div
                    key={w.id}
                    className={`wms-item ${w.raOption === action ? 'checked' : ''}`}
                    onClick={() => toggleWidget(w)}
                  >
                    {w.widgetName} <i className="ti ti-check" />
                  </div>
                ))}
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
