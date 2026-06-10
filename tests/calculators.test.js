const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calculateDilution,
  calculate12HEAWorkingSolution,
  calculateDntpMix,
  calculateReactionMasterMix,
  calculateAgaroseGel,
} = require('../js/calculators.js');

test('12HEA working solution converts mM stock to microliters correctly', () => {
  const result = calculate12HEAWorkingSolution({
    workingConcentrationUm: 10,
    workingVolumeMl: 50,
    stockConcentrationMm: 10,
  });

  assert.deepEqual(result, {
    stockVolumeUl: 50,
    solventPercent: 0.1,
  });
});

test('dilution rejects a target concentration above the stock concentration', () => {
  assert.throws(
    () => calculateDilution({
      targetConcentration: 10,
      finalVolume: 100,
      stockConcentration: 5,
    }),
    /目标浓度不能高于母液浓度/,
  );
});

test('dilution rejects zero stock concentration instead of silently substituting one', () => {
  assert.throws(
    () => calculateDilution({
      targetConcentration: 0.5,
      finalVolume: 100,
      stockConcentration: 0,
    }),
    /母液浓度必须大于 0/,
  );
});

test('dNTP mix rejects component volumes that exceed final volume', () => {
  assert.throws(
    () => calculateDntpMix({
      finalVolumeUl: 100,
      eachFinalConcentrationMm: 30,
      individualStockConcentrationMm: 100,
    }),
    /组分总体积不能超过终体积/,
  );
});

test('Taq master mix scales ten reactions with ten percent overage', () => {
  const result = calculateReactionMasterMix({
    reactionCount: 10,
    reactionVolumeUl: 25,
    referenceVolumeUl: 25,
    componentsPerReference: {
      buffer: 2.5,
      dntp: 0.5,
      forwardPrimer: 1,
      reversePrimer: 1,
      enzyme: 0.25,
    },
    templatePerReference: 1,
  });

  assert.equal(result.components.buffer, 27.5);
  assert.ok(Math.abs(result.waterVolumeUl - 206.25) < 1e-9);
  assert.ok(Math.abs(result.masterMixVolumeUl - 57.75) < 1e-9);
});

test('agarose gel uses 10 uL dye for 100 mL at 1:10000', () => {
  const result = calculateAgaroseGel({
    percentage: 1,
    volumeMl: 100,
  });

  assert.deepEqual(result, {
    agaroseMassG: 1,
    dyeVolumeUl: 10,
  });
});
