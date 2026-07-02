// Imports Leads Listing.csv into the `leads` table verbatim - exact columns, exact values.
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const { openDb, DB_PATH } = require('../db/connection');
const { buildColumnNames, q } = require('../db/leadColumns');

const CSV_PATH = path.join(
  __dirname,
  '..', '..', '..',
  'Leads Listing.csv'
);

const BATCH_SIZE = 2000;

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV not found at ${CSV_PATH}`);
    process.exit(1);
  }

  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    console.log('Removed existing database to reimport fresh.');
  }

  const db = openDb();

  const parser = fs.createReadStream(CSV_PATH).pipe(
    parse({
      bom: true,
      relax_column_count: true,
      skip_empty_lines: true,
    })
  );

  let insertStmt = null;
  let expectedLen = 0;
  let batch = [];
  let rowCount = 0;
  let isFirst = true;

  db.exec('BEGIN');

  for await (const record of parser) {
    if (isFirst) {
      isFirst = false;
      const columnNames = buildColumnNames(record);
      expectedLen = columnNames.length;

      const createSql = `CREATE TABLE leads (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  ${columnNames.map((c) => `${q(c)} TEXT`).join(',\n  ')}\n);`;
      db.exec(createSql);

      const insertSql = `INSERT INTO leads (${columnNames.map(q).join(', ')}) VALUES (${columnNames.map(() => '?').join(', ')})`;
      insertStmt = db.prepare(insertSql);
      continue;
    }

    batch.push(record);
    rowCount++;
    if (batch.length >= BATCH_SIZE) {
      flushBatch(insertStmt, batch, expectedLen);
      batch = [];
      db.exec('COMMIT');
      db.exec('BEGIN');
      process.stdout.write(`\rImported ${rowCount} rows...`);
    }
  }
  if (batch.length) {
    flushBatch(insertStmt, batch, expectedLen);
  }
  db.exec('COMMIT');

  console.log(`\nDone. Imported ${rowCount} lead rows into ${DB_PATH}`);

  console.log('Creating indexes...');
  db.exec(`CREATE INDEX idx_leads_email ON leads (${q('Registered Email')});`);
  db.exec(`CREATE INDEX idx_leads_mobile ON leads (${q('Registered Mobile')});`);
  db.exec(`CREATE INDEX idx_leads_aadhaar ON leads (${q('Aadhaar Card')});`);
  db.exec(`CREATE INDEX idx_leads_leadid ON leads (${q('Lead Id')});`);
  db.exec(`CREATE INDEX idx_leads_regdate ON leads (${q('User Registration Date')});`);
  console.log('Indexes created.');

  db.close();
}

function flushBatch(stmt, rows, expectedLen) {
  for (const row of rows) {
    let values = row;
    if (values.length < expectedLen) {
      values = values.concat(Array(expectedLen - values.length).fill(''));
    } else if (values.length > expectedLen) {
      values = values.slice(0, expectedLen);
    }
    stmt.run(...values);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
