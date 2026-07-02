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
};

export const DOWNLOAD_BASE = BASE;
