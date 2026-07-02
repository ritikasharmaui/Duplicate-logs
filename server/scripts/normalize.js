// Unique-field normalization, matching the locked Unique Fields rules:
// case-insensitive, whitespace-trimmed, "NA"/blank = NULL (no dedup), mobile is dial-code aware
// (default +91 applied when absent). Returns null when a value can't participate in matching.

function isBlankOrNA(v) {
  if (v === null || v === undefined) return true;
  const t = String(v).trim();
  return t === '' || t.toUpperCase() === 'NA';
}

function normalizeEmail(raw) {
  if (isBlankOrNA(raw)) return null;
  return raw.trim().toLowerCase();
}

// Strips export artifacts (leading backtick used to force text formatting), then extracts
// a 10-digit local number with a dial code (default 91 / India when absent).
function normalizeMobile(raw) {
  if (isBlankOrNA(raw)) return null;
  const cleaned = raw.replace(/[`'"]/g, '').trim();
  const digits = cleaned.replace(/[^\d]/g, '');
  if (digits.length === 10) return { dialCode: '91', local: digits };
  if (digits.length === 12 && digits.startsWith('91')) return { dialCode: '91', local: digits.slice(2) };
  if (digits.length === 11 && digits.startsWith('0')) return { dialCode: '91', local: digits.slice(1) };
  if (digits.length >= 11 && digits.length <= 14) {
    // Assume the leading digits (all but the last 10) are the dial code.
    return { dialCode: digits.slice(0, digits.length - 10), local: digits.slice(-10) };
  }
  return null; // not a plausible mobile number - excluded from matching
}

function mobileKey(raw) {
  const m = normalizeMobile(raw);
  return m ? `${m.dialCode}-${m.local}` : null;
}

function formatMobileDisplay(raw) {
  const m = normalizeMobile(raw);
  if (!m) return isBlankOrNA(raw) ? 'NA' : raw;
  return `+${m.dialCode}-${m.local}`;
}

function normalizeAadhaar(raw) {
  if (isBlankOrNA(raw)) return null;
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length === 12) return digits;
  return raw.trim().toLowerCase();
}

// "DD/MM/YYYY, hh:mm:ss AM/PM" -> sortable epoch ms. Returns null (and sorts last) if unparsable.
function parseRegistrationDate(raw) {
  if (isBlankOrNA(raw)) return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4}),\s*(\d{2}):(\d{2}):(\d{2})\s*(AM|PM)$/i.exec(raw.trim());
  if (!match) return null;
  let [, dd, mm, yyyy, hh, min, ss, ampm] = match;
  let hour = parseInt(hh, 10) % 12;
  if (ampm.toUpperCase() === 'PM') hour += 12;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd), hour, Number(min), Number(ss));
  return date.getTime();
}

module.exports = {
  isBlankOrNA,
  normalizeEmail,
  normalizeMobile,
  mobileKey,
  formatMobileDisplay,
  normalizeAadhaar,
  parseRegistrationDate,
};
