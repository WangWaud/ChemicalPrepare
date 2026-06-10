const {
  calculateDilution,
  calculateMass,
  calculate12HEAStock,
  calculate12HEAWorkingSolution,
  calculateDntpMix,
  calculateReactionMasterMix,
  calculateAgaroseGel,
  nonNegative,
  positive,
} = ChemicalCalculators;
const { antibiotics } = ChemicalData;

function inputNumber(id, label, { allowZero = true } = {}) {
  const input = document.getElementById(id);
  try {
    const value = allowZero
      ? nonNegative(input.value, label)
      : positive(input.value, label);
    input.removeAttribute('aria-invalid');
    return value;
  } catch (error) {
    input.setAttribute('aria-invalid', 'true');
    throw error;
  }
}

function showCalculationError(resultId, error) {
  const result = document.getElementById(resultId);
  if (!result) return;
  result.classList.add('result-error');
  result.querySelectorAll('.calculation-error').forEach(el => el.remove());
  const message = document.createElement('div');
  message.className = 'calculation-error';
  message.setAttribute('role', 'alert');
  message.textContent = error.message;
  result.prepend(message);
}

function clearCalculationError(resultId) {
  const result = document.getElementById(resultId);
  if (!result) return;
  result.classList.remove('result-error');
  result.querySelectorAll('.calculation-error').forEach(el => el.remove());
}

function runCalculation(resultId, callback) {
  try {
    callback();
    clearCalculationError(resultId);
  } catch (error) {
    showCalculationError(resultId, error);
  }
}

function setActivePanel(panelName) {
  document.querySelectorAll('.nav-btn').forEach(button => {
    const active = button.dataset.panel === panelName;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('.panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `panel-${panelName}`);
  });
}

// --- Nav ---
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.setAttribute('role', 'tab');
  btn.setAttribute('aria-controls', `panel-${btn.dataset.panel}`);
  btn.setAttribute('aria-selected', String(btn.classList.contains('active')));
  btn.addEventListener('click', () => {
    setActivePanel(btn.dataset.panel);

    // Hide back button when manually switching tabs
    hideBackButton();
    sessionStorage.removeItem('protocolScrollPos');
    sessionStorage.removeItem('jumpedFromProtocol');
  });
});

// --- Toggle Card ---
function toggleCard(id) {
  const card = document.getElementById(id);
  card.classList.toggle('open');
  card.querySelector('.recipe-header')
    ?.setAttribute('aria-expanded', String(card.classList.contains('open')));
}

// --- Search ---
const searchableCards = [];
let searchState = null;
function buildSearchIndex() {
  searchableCards.length = 0;
  document.querySelectorAll('.recipe-card').forEach(card => {
    searchableCards.push({
      el: card,
      panel: card.closest('.panel')?.id || '',
      text: card.textContent.toLowerCase(),
    });
  });
}

function clearHighlights() {
  document.querySelectorAll('.search-highlight').forEach(mark => {
    const parent = mark.parentNode;
    parent.replaceChild(document.createTextNode(mark.textContent), mark);
    parent.normalize();
  });
}

function highlightInElement(el, query) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  const re = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
  textNodes.forEach(node => {
    if (!re.test(node.textContent)) return;
    re.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let lastIdx = 0;
    let match;
    while ((match = re.exec(node.textContent)) !== null) {
      if (match.index > lastIdx) frag.appendChild(document.createTextNode(node.textContent.slice(lastIdx, match.index)));
      const mark = document.createElement('mark');
      mark.className = 'search-highlight';
      mark.textContent = match[0];
      frag.appendChild(mark);
      lastIdx = re.lastIndex;
    }
    if (lastIdx < node.textContent.length) frag.appendChild(document.createTextNode(node.textContent.slice(lastIdx)));
    node.parentNode.replaceChild(frag, node);
  });
}

function onSearch() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  const clearBtn = document.getElementById('searchClear');
  const info = document.getElementById('searchResultsInfo');
  clearBtn.classList.toggle('show', q.length > 0);

  clearHighlights();

  if (!q) {
    searchableCards.forEach(c => {
      c.el.classList.remove('search-hidden', 'search-match');
    });
    info.classList.remove('show');
    if (searchState) {
      setActivePanel(searchState.panel);
      searchableCards.forEach(card => {
        card.el.classList.toggle('open', searchState.openCards.has(card.el.id));
        card.el.querySelector('.recipe-header')
          ?.setAttribute('aria-expanded', String(card.el.classList.contains('open')));
      });
      searchState = null;
    }
    return;
  }

  if (!searchState) {
    searchState = {
      panel: document.querySelector('.nav-btn.active')?.dataset.panel || 'media',
      openCards: new Set(
        [...document.querySelectorAll('.recipe-card.open')].map(card => card.id),
      ),
    };
  }

  document.querySelectorAll('.panel').forEach(p => p.classList.add('active'));

  let matchCount = 0;
  searchableCards.forEach(c => {
    if (c.text.includes(q)) {
      c.el.classList.remove('search-hidden');
      c.el.classList.add('search-match');
      c.el.classList.add('open');
      c.el.querySelector('.recipe-header')?.setAttribute('aria-expanded', 'true');
      highlightInElement(c.el, q);
      matchCount++;
    } else {
      c.el.classList.add('search-hidden');
      c.el.classList.remove('search-match');
    }
  });

  info.classList.add('show');
  info.textContent = matchCount > 0
    ? `找到 ${matchCount} 个匹配结果`
    : '未找到匹配结果，试试其他关键词';
}

function clearSearch() {
  clearHighlights();
  document.getElementById('searchInput').value = '';
  onSearch();
  document.getElementById('searchInput').focus();
}

// --- Media State ---
const mediaState = { pda: false, tsb: false, lb: false, r2a: false, kb: false, ms: false, v8: false };

function toggleMedia(prefix, isSolid) {
  mediaState[prefix] = isSolid;
  const card = document.getElementById('card-' + prefix);
  const btns = card.querySelectorAll('.media-toggle-btn');
  btns[0].classList.toggle('active', !isSolid);
  btns[1].classList.toggle('active', isSolid);

  // Toggle agar visibility
  const agarRow = document.getElementById(prefix + '-agar-row');
  const agarRef = document.getElementById(prefix + '-agar-ref');
  const tableAgar = document.getElementById(prefix + '-table-agar');
  if (agarRow) agarRow.style.display = isSolid ? 'flex' : 'none';
  if (agarRef) agarRef.style.display = isSolid ? '' : 'none';
  if (tableAgar) tableAgar.style.display = isSolid ? '' : 'none';

  // Toggle agar step
  const agarStep = document.getElementById(prefix + '-step-agar');
  const pourStep = document.getElementById(prefix + '-step-pour');
  if (agarStep) agarStep.style.display = isSolid ? '' : 'none';
  if (pourStep) pourStep.style.display = isSolid ? '' : 'none';

  // V8 special handling — two calculators
  if (prefix === 'v8') {
    const diyAgarRow = document.getElementById('v8-diy-agar-row');
    const diyAgarStep = document.getElementById('v8-diy-step-agar');
    const diyPourStep = document.getElementById('v8-diy-step-pour');
    if (diyAgarRow) diyAgarRow.style.display = isSolid ? 'flex' : 'none';
    if (diyAgarStep) diyAgarStep.style.display = isSolid ? '' : 'none';
    if (diyPourStep) diyPourStep.style.display = isSolid ? '' : 'none';
    // Toggle solid vs liquid steps for 2× method
    const agarStep1 = document.getElementById('v8-agar-step-1');
    const agarStep2 = document.getElementById('v8-agar-step-2');
    const agarStep3 = document.getElementById('v8-agar-step-3');
    const liqStep = document.getElementById('v8-liq-step');
    if (agarStep1) agarStep1.style.display = isSolid ? '' : 'none';
    if (agarStep2) agarStep2.style.display = isSolid ? '' : 'none';
    if (agarStep3) agarStep3.style.display = isSolid ? '' : 'none';
    if (liqStep) liqStep.style.display = isSolid ? 'none' : '';
  }

  // Update titles
  const titleMap = {
    pda: { liquid: 'PDB', solid: 'PDA' },
    tsb: { liquid: 'TSB', solid: 'TSA' },
    lb:  { liquid: 'LB',  solid: 'LBA' },
    r2a: { liquid: 'R2A', solid: 'R2A' },
    kb:  { liquid: 'KB',  solid: 'KB' },
    ms:  { liquid: 'MS',  solid: 'MS' },
    v8:  { liquid: 'V8',  solid: 'V8' }
  };
  const subtitleMap = {
    pda: { liquid: 'Potato Dextrose Broth — 用于 Bm 液体扩培', solid: 'Potato Dextrose Agar — 用于 Bm 培养与产孢' },
    tsb: { liquid: 'Half-Strength Tryptic Soy Broth — 用于 Sphingobium 常规培养', solid: 'Half-Strength Tryptic Soy Agar — 用于 Sphingobium 平板培养' },
    lb:  { liquid: 'Luria-Bertani Broth — 通用液体细菌培养基', solid: 'Luria-Bertani Agar — 通用固体细菌培养基' },
    r2a: { liquid: "Reasoner's 2A Broth — 环境微生物液体培养", solid: "Reasoner's 2A Agar — 环境微生物平板培养" },
    kb:  { liquid: "King's B Broth — 假单胞菌液体培养", solid: "King's B Agar — 假单胞菌平板培养" },
    ms:  { liquid: 'Half-Strength MS Liquid — 种子萌发液体培养', solid: 'Half-Strength MS Agar — 植物组培固体培养' },
    v8:  { liquid: 'V8 Juice Broth — 卵菌/真菌液体培养', solid: 'V8 Juice Agar — 卵菌/真菌平板培养' }
  };
  const t = isSolid ? 'solid' : 'liquid';
  const titleEl = document.getElementById(prefix + '-title');
  const subtitleEl = document.getElementById(prefix + '-subtitle');
  if (titleEl) titleEl.textContent = titleMap[prefix][t];
  if (subtitleEl) subtitleEl.textContent = subtitleMap[prefix][t];

  // Recalculate
  const calcFn = { pda: calcPDA, tsb: calcTSB, lb: calcLB, r2a: calcR2A };
  if (calcFn[prefix]) calcFn[prefix]();
}

// --- PDA / PDB ---
function calcPDA() {
  const v = parseFloat(document.getElementById('pda-vol').value) || 0;
  const isSolid = mediaState.pda;
  const powderRate = isSolid ? 39 : 26;
  const powderLabel = isSolid ? 'PDA 粉剂' : 'PDB 粉剂';
  document.getElementById('pda-powder-label').textContent = powderLabel;
  document.getElementById('pda-powder').textContent = (powderRate * v).toFixed(1) + ' g';
  document.getElementById('pda-agar').textContent = (15 * v).toFixed(1) + ' g';
  document.getElementById('pda-water').textContent = (1000 * v).toFixed(0) + ' mL';
  document.getElementById('pda-formula').textContent = isSolid
    ? 'PDA粉剂(g) = 39 × 体积(L) &emsp; 琼脂(g) = 15 × 体积(L)'
    : 'PDB粉剂(g) = 26 × 体积(L)';
}

// --- MM ---
function calcMM() {
  const v = parseFloat(document.getElementById('mm-vol').value) || 0;
  const glu = parseFloat(document.getElementById('mm-glu').value) || 0;
  document.getElementById('mm-k2hpo4').textContent = (7.0 * v).toFixed(2) + ' g';
  document.getElementById('mm-kh2po4').textContent = (2.0 * v).toFixed(2) + ' g';
  document.getElementById('mm-nh4').textContent = (1.0 * v).toFixed(2) + ' g';
  document.getElementById('mm-citrate').textContent = (0.5 * v).toFixed(2) + ' g';
  document.getElementById('mm-mgso4').textContent = (0.1 * v).toFixed(2) + ' g';
  document.getElementById('mm-water').textContent = (1000 * v).toFixed(0) + ' mL';
  const gluRow = document.getElementById('mm-glu-row');
  if (glu > 0) {
    gluRow.style.display = 'flex';
    document.getElementById('mm-glucose').textContent = (glu * 10 * v).toFixed(2) + ' g';
  } else {
    gluRow.style.display = 'none';
  }
}

// --- TSB / TSA ---
function calcTSB() {
  const v = parseFloat(document.getElementById('tsb-vol').value) || 0;
  document.getElementById('tsb-powder').textContent = (7.5 * v).toFixed(1) + ' g';
  document.getElementById('tsb-agar').textContent = (15 * v).toFixed(1) + ' g';
  document.getElementById('tsb-water').textContent = (1000 * v).toFixed(0) + ' mL';
  document.getElementById('tsb-formula').textContent = mediaState.tsb
    ? 'TSB粉剂(g) = 7.5 × 体积(L) &emsp; 琼脂(g) = 15 × 体积(L)'
    : 'TSB粉剂(g) = 7.5 × 体积(L)';
}

// --- LB / LBA ---
function calcLB() {
  const v = parseFloat(document.getElementById('lb-vol').value) || 0;
  document.getElementById('lb-tryp').textContent = (10.0 * v).toFixed(1) + ' g';
  document.getElementById('lb-yeast').textContent = (5.0 * v).toFixed(1) + ' g';
  document.getElementById('lb-nacl').textContent = (10.0 * v).toFixed(1) + ' g';
  document.getElementById('lb-agar').textContent = (15.0 * v).toFixed(1) + ' g';
  document.getElementById('lb-water').textContent = (1000 * v).toFixed(0) + ' mL';
  document.getElementById('lb-formula').textContent = mediaState.lb
    ? '胰蛋白胨(g) = 10 × 体积(L) &emsp; 酵母(g) = 5 × 体积(L) &emsp; NaCl(g) = 10 × 体积(L) &emsp; 琼脂(g) = 15 × 体积(L)'
    : '胰蛋白胨(g) = 10 × 体积(L) &emsp; 酵母(g) = 5 × 体积(L) &emsp; NaCl(g) = 10 × 体积(L)';
}

// --- R2A ---
function calcR2A() {
  const v = parseFloat(document.getElementById('r2a-vol').value) || 0;
  document.getElementById('r2a-yeast').textContent = (0.5 * v).toFixed(2) + ' g';
  document.getElementById('r2a-peptone').textContent = (0.5 * v).toFixed(2) + ' g';
  document.getElementById('r2a-casamino').textContent = (0.5 * v).toFixed(2) + ' g';
  document.getElementById('r2a-glucose').textContent = (0.5 * v).toFixed(2) + ' g';
  document.getElementById('r2a-starch').textContent = (0.5 * v).toFixed(2) + ' g';
  document.getElementById('r2a-pyruvate').textContent = (0.3 * v).toFixed(2) + ' g';
  document.getElementById('r2a-k2hpo4').textContent = (0.3 * v).toFixed(2) + ' g';
  document.getElementById('r2a-mgso4').textContent = (0.05 * v).toFixed(3) + ' g';
  document.getElementById('r2a-agar').textContent = (15.0 * v).toFixed(1) + ' g';
  document.getElementById('r2a-water').textContent = (1000 * v).toFixed(0) + ' mL';
}

// --- KB ---
function calcKB() {
  const v = parseFloat(document.getElementById('kb-vol').value) || 0;
  document.getElementById('kb-peptone').textContent = (20.0 * v).toFixed(1) + ' g';
  document.getElementById('kb-glycerol').textContent = (10.0 * v).toFixed(1) + ' mL';
  document.getElementById('kb-k2hpo4').textContent = (1.5 * v).toFixed(2) + ' g';
  document.getElementById('kb-mgso4').textContent = (1.5 * v).toFixed(2) + ' g';
  document.getElementById('kb-agar').textContent = (15.0 * v).toFixed(1) + ' g';
  document.getElementById('kb-water').textContent = (1000 * v).toFixed(0) + ' mL';
}

// --- 1/2 MS ---
function calcMS() {
  const v = parseFloat(document.getElementById('ms-vol').value) || 0;
  document.getElementById('ms-salt').textContent = (2.15 * v).toFixed(2) + ' g';
  document.getElementById('ms-sucrose').textContent = (15.0 * v).toFixed(1) + ' g';
  document.getElementById('ms-agar').textContent = (8.0 * v).toFixed(1) + ' g';
  document.getElementById('ms-water').textContent = (1000 * v).toFixed(0) + ' mL';
}

// --- V8 (2× 母液稀释) ---
function calcV8() {
  const v = parseFloat(document.getElementById('v8-vol').value) || 0;
  document.getElementById('v8-stock').textContent = (v * 500).toFixed(0) + ' mL';
  document.getElementById('v8-agar').textContent = (15.0 * v).toFixed(1) + ' g';
  document.getElementById('v8-water').textContent = (v * 500).toFixed(0) + ' mL';
}

// --- V8 自配法 ---
function calcV8diy() {
  const v = parseFloat(document.getElementById('v8-diy-vol').value) || 0;
  document.getElementById('v8-diy-juice').textContent = (200 * v).toFixed(0) + ' mL';
  document.getElementById('v8-diy-caco3').textContent = (3.0 * v).toFixed(1) + ' g';
  document.getElementById('v8-diy-agar').textContent = (15.0 * v).toFixed(1) + ' g';
  document.getElementById('v8-diy-water').textContent = (800 * v).toFixed(0) + ' mL';
}

// --- MgCl2 ---
function calcMgCl2() {
  const v = parseFloat(document.getElementById('mgcl2-vol').value) || 0;
  document.getElementById('mgcl2-powder').textContent = (2.033 * v).toFixed(3) + ' g';
  document.getElementById('mgcl2-water').textContent = (1000 * v).toFixed(0) + ' mL';
}

// --- HgCl2 ---
function calcHgCl2() {
  const v = parseFloat(document.getElementById('hg-vol').value) || 0;
  document.getElementById('hg-powder').textContent = (1.0 * v).toFixed(3) + ' g';
  document.getElementById('hg-water').textContent = (1000 * v).toFixed(0) + ' mL';
}

// --- NaClO ---
function calcNaClO() {
  runCalculation('naclo-result', () => {
    const stock = inputNumber('naclo-stock', '母液浓度', { allowZero: false });
    const target = inputNumber('naclo-target', '工作浓度');
    const vol = inputNumber('naclo-vol', '目标体积');
    const result = calculateDilution({
      targetConcentration: target,
      finalVolume: vol,
      stockConcentration: stock,
    });
    document.getElementById('naclo-stock-vol').textContent = `${result.stockVolume.toFixed(1)} mL`;
    document.getElementById('naclo-water-vol').textContent = `${result.diluentVolume.toFixed(1)} mL`;
  });
}

// --- Bm Spore ---
function calcBmSpore() {
  runCalculation('bm-result', () => {
    const result = calculateDilution({
      targetConcentration: inputNumber('bm-target', '目标浓度'),
      finalVolume: inputNumber('bm-vol', '目标体积'),
      stockConcentration: inputNumber('bm-stock', '原液浓度', { allowZero: false }),
    });
    document.getElementById('bm-stock-vol').textContent = `${result.stockVolume.toFixed(1)} mL`;
    document.getElementById('bm-water-vol').textContent = `${result.diluentVolume.toFixed(1)} mL`;
  });
}

// --- 12HEA ---
function calc12HEA() {
  runCalculation('hea-result', () => {
    const volume = inputNumber('hea-vol', '母液体积');
    const result = calculate12HEAStock({
      concentrationMm: inputNumber('hea-conc', '母液浓度'),
      volumeMl: volume,
      molecularWeight: inputNumber('hea-mw', '分子量', { allowZero: false }),
    });
    document.getElementById('hea-powder').textContent = `${result.massMg.toFixed(3)} mg`;
    document.getElementById('hea-dmso').textContent = `${volume.toFixed(1)} mL`;
  });
}

function calc12HEAwork() {
  runCalculation('hea-work-result', () => {
    const result = calculate12HEAWorkingSolution({
      workingConcentrationUm: inputNumber('hea-wc', '工作浓度'),
      workingVolumeMl: inputNumber('hea-wv', '工作体积'),
      stockConcentrationMm: inputNumber('hea-sc', '母液浓度', { allowZero: false }),
    });
    document.getElementById('hea-work-stock').textContent = `${result.stockVolumeUl.toFixed(1)} μL`;
    document.getElementById('hea-work-dmso').textContent = `${result.solventPercent.toFixed(4)}%`;
  });
}

// --- Tween-20 ---
function calcTween() {
  runCalculation('tw-result', () => {
    const result = calculateDilution({
      targetConcentration: inputNumber('tw-conc', '工作浓度'),
      finalVolume: inputNumber('tw-vol', '目标体积'),
      stockConcentration: inputNumber('tw-stock', '母液浓度', { allowZero: false }),
    });
    document.getElementById('tw-stock-vol').textContent = `${result.stockVolume.toFixed(2)} mL`;
    document.getElementById('tw-water-vol').textContent = `${result.diluentVolume.toFixed(2)} mL`;
  });
}

// --- Antibiotics ---
function selectedAntibiotic(selectId) {
  const id = document.getElementById(selectId).value;
  return antibiotics.find(item => item.id === id) || antibiotics[0];
}

function renderAntibiotics() {
  const tbody = document.querySelector('#card-antibiotics .comp-table tbody');
  tbody.innerHTML = antibiotics.map(item => `
    <tr>
      <td>${item.name}</td><td class="mono">${item.abbreviation}</td>
      <td>${item.type}</td>
      <td class="mono">${item.stockConcentrationMgMl} mg/mL</td>
      <td class="mono">${item.workingConcentrationUgMl} μg/mL</td>
      <td>${item.solvent}</td><td>${item.storage}</td><td>${item.use}</td>
    </tr>
  `).join('');

  for (const selectId of ['abx-type', 'ws-type']) {
    document.getElementById(selectId).innerHTML = antibiotics.map(item => (
      `<option value="${item.id}">${item.name}</option>`
    )).join('');
  }
}

function calcAbx() {
  runCalculation('abx-result', () => {
    const antibiotic = selectedAntibiotic('abx-type');
    const concentration = inputNumber('abx-stock-conc', '母液浓度', { allowZero: false });
    const volume = inputNumber('abx-vol', '配制体积');
    const mass = calculateMass({ concentration, volume });
    document.getElementById('abx-powder').textContent = `${mass.toFixed(0)} mg`;
    document.getElementById('abx-solvent').textContent = `${volume.toFixed(1)} mL ${antibiotic.solvent}`;
  });
}

function onAbxTypeChange() {
  const antibiotic = selectedAntibiotic('abx-type');
  document.getElementById('abx-stock-conc').value = antibiotic.stockConcentrationMgMl;
  calcAbx();
}

function onWsTypeChange() {
  const antibiotic = selectedAntibiotic('ws-type');
  document.getElementById('ws-stock-conc').value = antibiotic.stockConcentrationMgMl;
  document.getElementById('ws-work-conc').value = antibiotic.workingConcentrationUgMl;
  calcWs();
}

function calcWs() {
  runCalculation('ws-result', () => {
    const stockConc = inputNumber('ws-stock-conc', '母液浓度', { allowZero: false });
    const workConc = inputNumber('ws-work-conc', '工作浓度');
    const mediaVol = inputNumber('ws-media-vol', '培养基体积');
    const result = calculateDilution({
      targetConcentration: workConc,
      finalVolume: mediaVol,
      stockConcentration: stockConc * 1000,
    });
    const volumeUl = result.stockVolume * 1000;
    document.getElementById('ws-vol').textContent = `${volumeUl.toFixed(1)} μL`;
    document.getElementById('ws-vol-ml').textContent = `${result.stockVolume.toFixed(3)} mL`;
  });
}

// --- PBS ---
function calcPBS() {
  const v = parseFloat(document.getElementById('pbs-vol').value) || 0;
  document.getElementById('pbs-nacl').textContent = (8.0 * v).toFixed(1) + ' g';
  document.getElementById('pbs-kcl').textContent = (0.2 * v).toFixed(2) + ' g';
  document.getElementById('pbs-na2hpo4').textContent = (1.44 * v).toFixed(2) + ' g';
  document.getElementById('pbs-kh2po4').textContent = (0.24 * v).toFixed(2) + ' g';
  document.getElementById('pbs-water').textContent = (1000 * v).toFixed(0) + ' mL';
}

// --- Taq PCR ---
function calcTaq() {
  runCalculation('taq-result', () => {
    const result = calculateReactionMasterMix({
      reactionCount: inputNumber('taq-n', '反应数', { allowZero: false }),
      reactionVolumeUl: inputNumber('taq-vol', '单反应体积', { allowZero: false }),
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
    document.getElementById('taq-buf').textContent = `${result.components.buffer.toFixed(1)} μL`;
    document.getElementById('taq-dntp').textContent = `${result.components.dntp.toFixed(1)} μL`;
    document.getElementById('taq-fp').textContent = `${result.components.forwardPrimer.toFixed(1)} μL`;
    document.getElementById('taq-rp').textContent = `${result.components.reversePrimer.toFixed(1)} μL`;
    document.getElementById('taq-enzyme').textContent = `${result.components.enzyme.toFixed(2)} μL`;
    document.getElementById('taq-water').textContent = `${result.waterVolumeUl.toFixed(1)} μL`;
    document.getElementById('taq-mm').textContent = `${result.masterMixVolumeUl.toFixed(1)} μL`;
  });
}

// --- Phusion PCR ---
function calcPhusion() {
  runCalculation('phu-result', () => {
    const result = calculateReactionMasterMix({
      reactionCount: inputNumber('phu-n', '反应数', { allowZero: false }),
      reactionVolumeUl: inputNumber('phu-vol', '单反应体积', { allowZero: false }),
      referenceVolumeUl: 50,
      componentsPerReference: {
        buffer: 10,
        dntp: 1,
        forwardPrimer: 2.5,
        reversePrimer: 2.5,
        enzyme: 0.5,
      },
      templatePerReference: 1,
    });
    document.getElementById('phu-buf').textContent = `${result.components.buffer.toFixed(1)} μL`;
    document.getElementById('phu-dntp').textContent = `${result.components.dntp.toFixed(1)} μL`;
    document.getElementById('phu-fp').textContent = `${result.components.forwardPrimer.toFixed(1)} μL`;
    document.getElementById('phu-rp').textContent = `${result.components.reversePrimer.toFixed(1)} μL`;
    document.getElementById('phu-enzyme').textContent = `${result.components.enzyme.toFixed(1)} μL`;
    document.getElementById('phu-water').textContent = `${result.waterVolumeUl.toFixed(1)} μL`;
    document.getElementById('phu-mm').textContent = `${result.masterMixVolumeUl.toFixed(1)} μL`;
  });
}

// --- dNTP Mix ---
function calcDNTP() {
  runCalculation('dntp-result', () => {
    const result = calculateDntpMix({
      finalVolumeUl: inputNumber('dntp-vol', '终体积'),
      eachFinalConcentrationMm: inputNumber('dntp-conc', '单种 dNTP 终浓度'),
      individualStockConcentrationMm: inputNumber('dntp-stock', '单种 dNTP 母液浓度', { allowZero: false }),
    });
    for (const id of ['dntp-datp', 'dntp-dttp', 'dntp-dctp', 'dntp-dgtp']) {
      document.getElementById(id).textContent = `${result.eachVolumeUl.toFixed(1)} μL`;
    }
    document.getElementById('dntp-water').textContent = `${result.waterVolumeUl.toFixed(1)} μL`;
  });
}

// --- Agarose Gel ---
function calcGel() {
  runCalculation('gel-result', () => {
    const volume = inputNumber('gel-vol', '凝胶体积');
    const result = calculateAgaroseGel({
      percentage: inputNumber('gel-pct', '凝胶浓度'),
      volumeMl: volume,
    });
    document.getElementById('gel-agarose').textContent = `${result.agaroseMassG.toFixed(2)} g`;
    document.getElementById('gel-tae').textContent = `${volume.toFixed(0)} mL`;
    document.getElementById('gel-dye').textContent = `${result.dyeVolumeUl.toFixed(1)} μL (1:10000)`;
  });
}

renderAntibiotics();
onAbxTypeChange();
onWsTypeChange();
buildSearchIndex();

document.querySelectorAll('.recipe-header').forEach(header => {
  header.setAttribute('role', 'button');
  header.setAttribute('tabindex', '0');
  header.setAttribute('aria-expanded', String(header.closest('.recipe-card').classList.contains('open')));
  header.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      header.click();
    }
  });
});

document.querySelectorAll('.input-field').forEach(input => {
  const label = input.closest('.input-row')?.querySelector('.input-label')?.textContent?.trim();
  if (label && !input.getAttribute('aria-label')) input.setAttribute('aria-label', label);
});

document.addEventListener('input', event => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.type !== 'number') return;

  const result = input.closest('.calc-section')?.querySelector('.result-box');
  const value = Number(input.value);
  const min = input.min === '' ? -Infinity : Number(input.min);
  const max = input.max === '' ? Infinity : Number(input.max);
  let message = '';

  if (input.value.trim() === '' || !Number.isFinite(value)) {
    message = '请输入有效数字';
  } else if (value < min) {
    message = `输入值不能小于 ${min}`;
  } else if (value > max) {
    message = `输入值不能大于 ${max}`;
  }

  if (message) {
    input.setAttribute('aria-invalid', 'true');
    if (result?.id) showCalculationError(result.id, new RangeError(message));
    event.stopImmediatePropagation();
  } else {
    input.removeAttribute('aria-invalid');
    if (result?.id) clearCalculationError(result.id);
  }
}, true);

// Init all
calcPDA(); calcMM(); calcTSB(); calcLB(); calcR2A(); calcKB(); calcMS(); calcV8(); calcV8diy(); calcMgCl2(); calcHgCl2(); calcNaClO(); calcBmSpore(); calc12HEA(); calc12HEAwork(); calcTween(); calcAbx(); calcPBS(); calcTaq(); calcPhusion(); calcDNTP(); calcGel();

// --- Jump to Recipe (Protocol 内部链接) ---
function jumpToRecipe(panelName, cardId) {
  // 1. 记录来源页面和滚动位置
  const protocolPanel = document.getElementById('panel-protocol');
  const currentScrollPos = protocolPanel.scrollTop;
  sessionStorage.setItem('protocolScrollPos', currentScrollPos);
  sessionStorage.setItem('jumpedFromProtocol', 'true');

  // 2. 切换到目标标签页
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const targetBtn = document.querySelector(`.nav-btn[data-panel="${panelName}"]`);
  const targetPanel = document.getElementById('panel-' + panelName);
  if (targetBtn) targetBtn.classList.add('active');
  if (targetPanel) targetPanel.classList.add('active');

  // 3. 展开目标卡片
  const targetCard = document.getElementById(cardId);
  if (targetCard && !targetCard.classList.contains('open')) {
    targetCard.classList.add('open');
  }

  // 4. 滚动到目标卡片
  if (targetCard) {
    setTimeout(() => {
      targetCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  // 5. 显示返回按钮
  showBackButton();
}

// Show Back Button
function showBackButton() {
  const backBtn = document.getElementById('backToProtocol');
  if (backBtn) {
    backBtn.classList.add('visible');
  }
}

// Hide Back Button
function hideBackButton() {
  const backBtn = document.getElementById('backToProtocol');
  if (backBtn) {
    backBtn.classList.remove('visible');
  }
}

// Go Back to Protocol
function goBackToProtocol() {
  // 1. 切换回Protocol标签页
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const protocolBtn = document.querySelector('.nav-btn[data-panel="protocol"]');
  const protocolPanel = document.getElementById('panel-protocol');
  if (protocolBtn) protocolBtn.classList.add('active');
  if (protocolPanel) protocolPanel.classList.add('active');

  // 2. 恢复滚动位置
  const savedScrollPos = sessionStorage.getItem('protocolScrollPos');
  if (savedScrollPos !== null) {
    setTimeout(() => {
      protocolPanel.scrollTop = parseInt(savedScrollPos);
    }, 100);
  }

  // 3. 隐藏返回按钮
  hideBackButton();

  // 4. 清除存储的状态
  sessionStorage.removeItem('protocolScrollPos');
  sessionStorage.removeItem('jumpedFromProtocol');
}

// Check if should show back button on page load
function checkBackButtonState() {
  const jumpedFromProtocol = sessionStorage.getItem('jumpedFromProtocol');
  if (jumpedFromProtocol === 'true') {
    showBackButton();
  }
}

// Initialize back button state
checkBackButtonState();

// --- Scroll to Top ---
function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

// Show/Hide Scroll to Top button based on scroll position
function toggleScrollToTopButton() {
  const scrollBtn = document.getElementById('scrollToTop');
  if (scrollBtn) {
    if (window.scrollY > 300) {
      scrollBtn.classList.add('visible');
    } else {
      scrollBtn.classList.remove('visible');
    }
  }
}

// Add scroll event listener
window.addEventListener('scroll', toggleScrollToTopButton);

// Initialize scroll button state
toggleScrollToTopButton();

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    document.getElementById('searchInput').focus();
  }
  if (e.key === 'Escape') {
    const si = document.getElementById('searchInput');
    if (si === document.activeElement) {
      clearSearch();
      si.blur();
    }
  }
});
