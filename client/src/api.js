const BASE = import.meta.env.VITE_API_BASE || '/api';

async function req(path, opts) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  getSettings: () => req('/settings'),
  saveSettings: (payload) => req('/settings', { method: 'PUT', body: JSON.stringify(payload) }),

  getRecords: (params) => req(`/duplicate-records?${new URLSearchParams(params).toString()}`),
  bulkDelete: (incomingLeadIds) => req('/duplicate-records/bulk-delete', { method: 'POST', body: JSON.stringify({ incoming_lead_ids: incomingLeadIds }) }),
  getMatches: (incomingLeadId) => req(`/duplicate-records/matches/${incomingLeadId}`),

  queueDownload: (columns, filters) =>
    req('/download-requests', { method: 'POST', body: JSON.stringify({ columns, filters }) }),

  getLeads: (params) => req(`/leads?${new URLSearchParams(params).toString()}`),
  getLeadFacets: () => req('/leads/facets'),
  getLead: (id) => req(`/leads/${id}`),
  getLeadAuditTrail: (id) => req(`/leads/${id}/audit-trail`),
  getLeadTimeline: (id) => req(`/leads/${id}/timeline`),
  getDuplicateGroup: (id) => req(`/leads/${id}/duplicate-group`),
  mergeDuplicateGroup: (id, payload) =>
    req(`/leads/${id}/merge-group`, { method: 'POST', body: JSON.stringify(payload) }),
};

export const DOWNLOAD_BASE = BASE;
