(function initCalculators(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ChemicalCalculators = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createCalculators() {
  function finiteNumber(value, label) {
    const number = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(number)) throw new RangeError(`${label}必须是有效数字`);
    return number;
  }

  function nonNegative(value, label) {
    const number = finiteNumber(value, label);
    if (number < 0) throw new RangeError(`${label}不能小于 0`);
    return number;
  }

  function positive(value, label) {
    const number = finiteNumber(value, label);
    if (number <= 0) throw new RangeError(`${label}必须大于 0`);
    return number;
  }

  function calculateDilution({
    targetConcentration,
    finalVolume,
    stockConcentration,
  }) {
    const target = nonNegative(targetConcentration, '目标浓度');
    const volume = nonNegative(finalVolume, '目标体积');
    const stock = positive(stockConcentration, '母液浓度');
    if (target > stock) throw new RangeError('目标浓度不能高于母液浓度');

    const stockVolume = (target * volume) / stock;
    return {
      stockVolume,
      diluentVolume: volume - stockVolume,
    };
  }

  function calculateMass({ concentration, volume, factor = 1 }) {
    return nonNegative(concentration, '浓度')
      * nonNegative(volume, '体积')
      * positive(factor, '换算系数');
  }

  function calculate12HEAStock({
    concentrationMm,
    volumeMl,
    molecularWeight,
  }) {
    return {
      massMg: calculateMass({
        concentration: concentrationMm,
        volume: volumeMl,
        factor: positive(molecularWeight, '分子量') / 1000,
      }),
    };
  }

  function calculate12HEAWorkingSolution({
    workingConcentrationUm,
    workingVolumeMl,
    stockConcentrationMm,
  }) {
    const result = calculateDilution({
      targetConcentration: workingConcentrationUm,
      finalVolume: workingVolumeMl,
      stockConcentration: positive(stockConcentrationMm, '母液浓度') * 1000,
    });
    const stockVolumeUl = result.stockVolume * 1000;
    return {
      stockVolumeUl,
      solventPercent: workingVolumeMl === 0
        ? 0
        : (stockVolumeUl / (workingVolumeMl * 1000)) * 100,
    };
  }

  function calculateDntpMix({
    finalVolumeUl,
    eachFinalConcentrationMm,
    individualStockConcentrationMm,
  }) {
    const volume = nonNegative(finalVolumeUl, '终体积');
    const concentration = nonNegative(eachFinalConcentrationMm, '单种 dNTP 终浓度');
    const stock = positive(individualStockConcentrationMm, '单种 dNTP 母液浓度');
    const eachVolumeUl = (concentration * volume) / stock;
    const componentsVolumeUl = eachVolumeUl * 4;
    if (componentsVolumeUl > volume) {
      throw new RangeError('组分总体积不能超过终体积');
    }
    return {
      eachVolumeUl,
      waterVolumeUl: volume - componentsVolumeUl,
    };
  }

  function calculateReactionMasterMix({
    reactionCount,
    reactionVolumeUl,
    referenceVolumeUl,
    componentsPerReference,
    templatePerReference,
    overage = 0.1,
  }) {
    const count = positive(reactionCount, '反应数');
    const volume = positive(reactionVolumeUl, '单反应体积');
    const reference = positive(referenceVolumeUl, '参考反应体积');
    const extra = nonNegative(overage, '余量比例');
    const scale = volume / reference;
    const multiplier = count * (1 + extra) * scale;
    const componentTotal = Object.values(componentsPerReference)
      .reduce((sum, value) => sum + nonNegative(value, '组分体积'), 0);
    const template = nonNegative(templatePerReference, '模板体积');
    const waterPerReaction = volume - ((componentTotal + template) * scale);
    if (waterPerReaction < 0) throw new RangeError('反应组分总体积不能超过单反应体积');

    return {
      components: Object.fromEntries(
        Object.entries(componentsPerReference)
          .map(([key, value]) => [key, value * multiplier]),
      ),
      waterVolumeUl: waterPerReaction * count * (1 + extra),
      masterMixVolumeUl: componentTotal * multiplier,
    };
  }

  function calculateAgaroseGel({ percentage, volumeMl, dyeDilution = 10000 }) {
    const pct = nonNegative(percentage, '凝胶浓度');
    const volume = nonNegative(volumeMl, '凝胶体积');
    const dilution = positive(dyeDilution, '染料稀释倍数');
    return {
      agaroseMassG: (pct / 100) * volume,
      dyeVolumeUl: (volume * 1000) / dilution,
    };
  }

  return {
    finiteNumber,
    nonNegative,
    positive,
    calculateDilution,
    calculateMass,
    calculate12HEAStock,
    calculate12HEAWorkingSolution,
    calculateDntpMix,
    calculateReactionMasterMix,
    calculateAgaroseGel,
  };
}));
