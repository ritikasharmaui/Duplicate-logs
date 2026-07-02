// Infers each lead's "Lead Inflow Source" (one of the 9 Lead Duplication Settings sources) from
// proxy columns, since the CSV's own "Source" column is blank for 99.9% of rows.
// [inferred] heuristic, approved by PM in lieu of an exact Source column - see duplicate_logs_feature.md
// Open Item #8. Kept in one place so the mapping is auditable/adjustable without touching the engine.

const SOURCES = {
  ADD_QUICK_LEAD: 'Add Quick Lead',
  WIDGET: 'Widget',
  LANDING_PAGE: 'Landing Page',
  TELEPHONY_INBOUND: 'Telephony Inbound',
  FB_LEAD: 'FB Lead',
  GOOGLE_LEAD: 'Google Lead',
  ZAPIER_LEAD: 'Zapier Lead',
  AM_SINGLE_UPLOAD: 'AM / Single Upload',
  PUBLISHER: 'Publisher',
};

const PUBLISHER_LIKE_NAMES = new Set([
  'NPF', 'NPF1', 'Not Mapped', 'Source Not Set', 'Internal Campaign',
  'Careers360', 'Autosave Data', 'Organic', 'Others', 'Other',
  'Email Connect', 'Demo', 'Test',
]);

// Offline rows are bulk-uploaded when one "Created By" account accounts for a large volume;
// smaller, name-attributed counts read as one-by-one counsellor entry (Add Quick Lead).
const BULK_UPLOAD_THRESHOLD = 300;

function na(v) {
  return !v || v.trim() === '' || v.trim().toUpperCase() === 'NA';
}

function inferSource(lead, createdByCounts) {
  const widgetName = lead['Widget Name'];
  const leadOrigin = (lead['Lead Origin(Primary)'] || '').trim();
  const publisherName = (lead['Publisher Name'] || '').trim();
  const createdBy = (lead['Created By'] || '').trim();

  if (!na(widgetName)) return { source: SOURCES.WIDGET, signal: `Widget Name=${widgetName}` };

  if (leadOrigin === 'Chat') return { source: SOURCES.WIDGET, signal: 'Lead Origin(Primary)=Chat (behaves as Widget)' };

  if (publisherName === 'Facebook') return { source: SOURCES.FB_LEAD, signal: 'Publisher Name=Facebook' };
  if (publisherName === 'Google Ads') return { source: SOURCES.GOOGLE_LEAD, signal: 'Publisher Name=Google Ads' };
  if (publisherName === 'Telephony Inbound') return { source: SOURCES.TELEPHONY_INBOUND, signal: 'Publisher Name=Telephony Inbound' };

  if (leadOrigin === 'Telephony') return { source: SOURCES.TELEPHONY_INBOUND, signal: 'Lead Origin(Primary)=Telephony' };

  if (leadOrigin === 'Online') return { source: SOURCES.LANDING_PAGE, signal: 'Lead Origin(Primary)=Online' };

  if (leadOrigin === 'API') {
    if (PUBLISHER_LIKE_NAMES.has(publisherName)) {
      return { source: SOURCES.PUBLISHER, signal: `Lead Origin(Primary)=API, Publisher Name=${publisherName}` };
    }
    return { source: SOURCES.ZAPIER_LEAD, signal: 'Lead Origin(Primary)=API (unmapped publisher)' };
  }

  // Remaining bucket - overwhelmingly "Offline". Split by Created By volume: a dominant
  // creator handling hundreds+ of rows reads as a bulk upload job; a small count reads as
  // manual one-by-one counsellor entry.
  const countForCreator = createdByCounts.get(createdBy) || 0;
  if (!na(createdBy) && countForCreator > 0 && countForCreator <= BULK_UPLOAD_THRESHOLD) {
    return { source: SOURCES.ADD_QUICK_LEAD, signal: `Created By=${createdBy} (${countForCreator} rows, below bulk threshold)` };
  }
  return { source: SOURCES.AM_SINGLE_UPLOAD, signal: `Lead Origin(Primary)=${leadOrigin || 'NA'}, Created By=${createdBy || 'NA'} (${countForCreator} rows)` };
}

// Outcome shown in the record's drawer - [inferred] mapping per source, since the CSV has
// no outcome column. Mirrors the source-behaviour rules locked in the Unique Fields PRD.
const EVENT_STATUS_BY_SOURCE = {
  [SOURCES.WIDGET]: 'Registration Attempt',
  [SOURCES.LANDING_PAGE]: 'Lead Updated',
  [SOURCES.ADD_QUICK_LEAD]: 'Registration Attempt',
  [SOURCES.TELEPHONY_INBOUND]: 'Registration Attempt',
  [SOURCES.FB_LEAD]: 'Registration Attempt',
  [SOURCES.GOOGLE_LEAD]: 'Registration Attempt',
  [SOURCES.ZAPIER_LEAD]: 'Registration Attempt',
  [SOURCES.AM_SINGLE_UPLOAD]: 'Registration Attempt',
  [SOURCES.PUBLISHER]: 'Blocked',
};

// Sources where the incoming event was triggered by a specific human (shown in drawer "Initiated by").
const MANUAL_SOURCES = new Set([SOURCES.ADD_QUICK_LEAD, SOURCES.AM_SINGLE_UPLOAD, SOURCES.PUBLISHER]);

module.exports = { SOURCES, inferSource, EVENT_STATUS_BY_SOURCE, MANUAL_SOURCES, na };
