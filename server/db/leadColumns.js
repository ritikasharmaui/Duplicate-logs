// Derives unique, exact-as-possible SQLite column names from the Leads Listing.csv header row.
// SQLite identifiers are case-insensitive, so collisions (e.g. 'Course' x2, blank x3,
// 'Current total work experience' vs 'Current Total Work Experience') are disambiguated
// by appending the 1-based CSV column position - every other column name is preserved verbatim.
function buildColumnNames(header) {
  const seen = new Map();
  const columnNames = header.map((rawName, idx) => {
    const csvPos = idx + 1;
    const base = rawName === '' ? `(blank col ${csvPos})` : rawName;
    const key = base.toLowerCase();
    const count = seen.get(key) || 0;
    seen.set(key, count + 1);
    if (count === 0) return base;
    return `${base} (col ${csvPos})`;
  });
  return columnNames;
}

// Quote an identifier for safe use in SQL (SQLite double-quote escaping).
function q(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

module.exports = { buildColumnNames, q };
