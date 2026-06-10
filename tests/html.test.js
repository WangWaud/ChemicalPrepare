const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('HTML ids are unique', () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);

  assert.deepEqual([...new Set(duplicates)], []);
});

test('page loads extracted stylesheet and scripts', () => {
  assert.match(html, /<link rel="stylesheet" href="styles\.css">/);
  assert.match(html, /<script src="js\/calculators\.js"><\/script>/);
  assert.match(html, /<script src="js\/data\.js"><\/script>/);
  assert.match(html, /<script src="js\/app\.js"><\/script>/);
  assert.doesNotMatch(html, /<style>/);
});

test('legacy duplicate V8 calculator is removed', () => {
  assert.equal((html.match(/id="v8-vol"/g) || []).length, 1);
  assert.equal((html.match(/id="v8-diy-vol"/g) || []).length, 1);
});
