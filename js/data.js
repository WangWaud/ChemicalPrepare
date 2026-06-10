(function initData(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ChemicalData = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createData() {
  const antibiotics = [
    ['ampicillin', 'Ampicillin', 'Amp', 'β-内酰胺类', 100, 100, 'ddH₂O', '-20°C', '革兰氏阳性菌筛选'],
    ['carbenicillin', 'Carbenicillin', 'Carb', 'β-内酰胺类', 50, 50, 'ddH₂O', '-20°C', 'Amp 替代，更稳定'],
    ['piperacillin', 'Piperacillin', 'Pip', 'β-内酰胺类', 50, 50, 'ddH₂O', '-20°C', '广谱，抗铜绿假单胞菌'],
    ['kanamycin', 'Kanamycin', 'Kan', '氨基糖苷类', 50, 50, 'ddH₂O', '-20°C', '广谱，常用筛选标记'],
    ['gentamicin', 'Gentamicin', 'Gm', '氨基糖苷类', 50, 50, 'ddH₂O', '-20°C', '革兰氏阴性菌筛选'],
    ['streptomycin', 'Streptomycin', 'Sm', '氨基糖苷类', 50, 50, 'ddH₂O', '-20°C', '植物病原菌筛选'],
    ['spectinomycin', 'Spectinomycin', 'Spec', '氨基环醇类', 100, 100, 'ddH₂O', '-20°C', '植物病原菌筛选'],
    ['rifampicin', 'Rifampicin', 'Rif', '利福霉素类', 50, 50, 'DMSO', '-20°C 避光', '革兰氏阴性菌、内生菌筛选'],
    ['chloramphenicol', 'Chloramphenicol', 'Cm', '氯霉素类', 34, 34, '乙醇', '-20°C', '广谱、低背景筛选'],
    ['tetracycline', 'Tetracycline', 'Tet', '四环素类', 10, 10, '乙醇', '-20°C 避光', '广谱、四环素抗性筛选'],
    ['nystatin', 'Nystatin', 'Ny', '多烯类抗真菌', 50, 50, 'DMSO', '-20°C 避光', '分离细菌时抑制真菌'],
  ].map(([
    id,
    name,
    abbreviation,
    type,
    stockConcentrationMgMl,
    workingConcentrationUgMl,
    solvent,
    storage,
    use,
  ]) => ({
    id,
    name,
    abbreviation,
    type,
    stockConcentrationMgMl,
    workingConcentrationUgMl,
    solvent,
    storage,
    use,
    sourceLevel: 'review',
  }));

  return { antibiotics };
}));
