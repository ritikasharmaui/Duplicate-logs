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
  bulkDelete: (ids) => req('/duplicate-records/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) }),

  queueDownload: (columns, filters) =>
    req('/download-requests', { method: 'POST', body: JSON.stringify({ columns, filters }) }),

  getLeads: (params) => req(`/leads?${new URLSearchParams(params).toString()}`),
  getLeadFacets: () => req('/leads/facets'),
  getLead: (id) => req(`/leads/${id}`),
  getLeadAuditTrail: (id) => req(`/leads/${id}/audit-trail`),
  compareLeadWithDuplicate: (id, duplicateRecordId) => req(`/leads/${id}/compare/${duplicateRecordId}`),
  mergeLeadFromDuplicate: (id, payload) =>
    req(`/leads/${id}/merge-from-duplicate`, { method: 'POST', body: JSON.stringify(payload) }),
};

export const DOWNLOAD_BASE = BASE;
