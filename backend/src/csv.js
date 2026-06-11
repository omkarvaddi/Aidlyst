const fs = require('fs');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) return [];

  const header = rows[0].map((value) => value.trim());
  return rows.slice(1)
    .filter((values) => values.some((value) => String(value).trim() !== ''))
    .map((values) => Object.fromEntries(header.map((name, index) => [name, values[index] || ''])));
}

function readCsvFile(filePath) {
  return parseCsv(fs.readFileSync(filePath, 'utf8'));
}

module.exports = {
  parseCsv,
  readCsvFile
};
