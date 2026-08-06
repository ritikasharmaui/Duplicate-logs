export const SOURCE_LIST = [
  'Add Quick Lead', 'Widget', 'Landing Page', 'Telephony Inbound',
  'FB Lead', 'Google Lead', 'Zapier Lead', 'AM / Single Upload', 'Publisher',
  'Niaa Web (Web, Facebook)', 'WABA (Whatsapp Message)', 'Publisher API',
  'Gmail Connector', 'Outlook Connector',
];

// Sources that can generate Duplicate Lead Records (Report-eligible)
export const REPORT_SOURCE_LIST = [
  'Widget', 'Landing Page', 'FB Lead', 'Google Lead', 'Zapier Lead',
  'Niaa Web (Web, Facebook)',
];

export const UNIQUE_FIELD_LIST = ['Registered Email', 'Registered Mobile', 'Aadhaar Card'];

export const DATE_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7days', label: 'Last 7 Days' },
  { key: '30days', label: 'Last 30 Days' },
  { key: 'thismonth', label: 'This Month' },
  { key: 'lastmonth', label: 'Last Month' },
  { key: 'custom', label: 'Custom Range' },
];

export function dateRangeForPreset(key, fromStr, toStr) {
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
  const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

  if (key === 'today') return { from: startOfDay(now).getTime(), to: endOfDay(now).getTime() };
  if (key === 'yesterday') {
    const y = new Date(now); y.setDate(y.getDate() - 1);
    return { from: startOfDay(y).getTime(), to: endOfDay(y).getTime() };
  }
  if (key === '7days') {
    const start = new Date(now); start.setDate(start.getDate() - 6);
    return { from: startOfDay(start).getTime(), to: endOfDay(now).getTime() };
  }
  if (key === '30days') {
    const start = new Date(now); start.setDate(start.getDate() - 29);
    return { from: startOfDay(start).getTime(), to: endOfDay(now).getTime() };
  }
  if (key === 'thismonth') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: startOfDay(start).getTime(), to: endOfDay(now).getTime() };
  }
  if (key === 'lastmonth') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: startOfDay(start).getTime(), to: endOfDay(end).getTime() };
  }
  if (key === 'custom' && fromStr && toStr) {
    return { from: startOfDay(new Date(fromStr)).getTime(), to: endOfDay(new Date(toStr)).getTime() };
  }
  return { from: null, to: null };
}

export const DOWNLOAD_COLUMNS = [
  { label: 'Incoming Duplicate Lead Name', defaultOn: true },
  { label: 'Incoming Duplicate Lead Number', defaultOn: true },
  { label: 'Matched Lead Name', defaultOn: true },
  { label: 'Matched Lead ID', defaultOn: true },
  { label: 'Matched Unique Field', defaultOn: true },
  { label: 'User Registration Date', defaultOn: true },
  { label: 'Lead Inflow Source', defaultOn: true },
  { label: 'Source (UTM)', defaultOn: false },
  { label: 'Medium', defaultOn: false },
  { label: 'Campaign', defaultOn: false },
  { label: 'Custom Lead Field', defaultOn: false },
  { label: 'Initiated By', defaultOn: false },
  { label: 'Primary Registration Campaign', defaultOn: false },
  { label: 'Event Status', defaultOn: false },
  { label: 'Secondary Registration Campaign', defaultOn: false },
];
