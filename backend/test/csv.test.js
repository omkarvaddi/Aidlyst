const assert = require('node:assert/strict');
const test = require('node:test');
const { parseCsv } = require('../src/csv');

test('parses quoted CSV fields with commas, quotes, and newlines', () => {
  const rows = parseCsv('id,name,note\n1,"Cuff, Large","Line one\nLine ""two"""\n');

  assert.deepEqual(rows, [{
    id: '1',
    name: 'Cuff, Large',
    note: 'Line one\nLine "two"'
  }]);
});
