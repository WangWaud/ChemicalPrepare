const test = require('node:test');
const assert = require('node:assert/strict');

const { antibiotics } = require('../js/data.js');

test('antibiotic identifiers are unique and required defaults are valid', () => {
  const ids = antibiotics.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);

  for (const item of antibiotics) {
    assert.ok(item.stockConcentrationMgMl > 0, `${item.id} stock concentration`);
    assert.ok(item.workingConcentrationUgMl > 0, `${item.id} working concentration`);
    assert.ok(item.solvent, `${item.id} solvent`);
    assert.ok(['external', 'internal', 'review'].includes(item.sourceLevel));
  }
});

test('Streptomycin defaults to 50 mg/mL stock and 50 ug/mL working concentration', () => {
  const streptomycin = antibiotics.find((item) => item.id === 'streptomycin');

  assert.ok(streptomycin);
  assert.equal(streptomycin.stockConcentrationMgMl, 50);
  assert.equal(streptomycin.workingConcentrationUgMl, 50);
});
