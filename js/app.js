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

// --- Card Word Export ---
function initWordExportButtons() {
  document.querySelectorAll('.recipe-card').forEach(card => {
    const header = card.querySelector('.recipe-header');
    const toggle = card.querySelector('.recipe-toggle');
    if (!header || header.querySelector('.word-export-btn')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'word-export-btn';
    button.textContent = '导出 Word';
    button.setAttribute('aria-label', `导出${card.querySelector('.recipe-title')?.textContent?.trim() || '当前卡片'}为 Word`);
    button.addEventListener('click', event => exportCardToWord(card.id, event));
    header.insertBefore(button, toggle || null);
  });
}

function sanitizeFileName(name) {
  return (name || '实验卡片')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '')
    .slice(0, 80) || '实验卡片';
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function normalizeText(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function textFromElement(el) {
  if (!el) return '';
  if (el.matches?.('input, select, textarea')) {
    if (el.tagName === 'SELECT') {
      return normalizeText(el.options[el.selectedIndex]?.textContent || el.value);
    }
    return normalizeText(el.value);
  }
  return normalizeText(el.textContent);
}

function xmlEscape(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wordRun(text, options = {}) {
  const font = options.mono ? 'Courier New' : 'Arial';
  const eastAsia = options.heading ? 'Heiti SC' : 'Songti SC';
  const size = options.size || 22;
  const bold = options.bold ? '<w:b/>' : '';
  const preserve = /^\s|\s$/.test(text) ? ' xml:space="preserve"' : '';

  return `<w:r><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:eastAsia="${eastAsia}" w:cs="${font}"/>${bold}<w:color w:val="000000"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t${preserve}>${xmlEscape(text)}</w:t></w:r>`;
}

function paragraphProperties(options = {}) {
  const parts = [];
  if (options.style) parts.push(`<w:pStyle w:val="${options.style}"/>`);
  if (options.numId) {
    parts.push(`<w:numPr><w:ilvl w:val="${options.ilvl || 0}"/><w:numId w:val="${options.numId}"/></w:numPr>`);
  }
  parts.push(`<w:spacing w:before="${options.before ?? 80}" w:after="${options.after ?? 120}" w:line="276" w:lineRule="auto"/>`);
  return `<w:pPr>${parts.join('')}</w:pPr>`;
}

function wordParagraph(text, options = {}) {
  const normalized = normalizeText(text);
  if (!normalized) return '';

  return `<w:p>${paragraphProperties(options)}${wordRun(normalized, {
    bold: options.bold,
    heading: options.heading,
    mono: options.mono,
    size: options.size,
  })}</w:p>`;
}

function wordTable(rows) {
  const filteredRows = rows
    .map(row => row.map(cell => normalizeText(cell)))
    .filter(row => row.some(Boolean));
  if (!filteredRows.length) return '';

  const tableRows = filteredRows.map((row, rowIndex) => {
    const cells = row.map(cell => {
      const shading = rowIndex === 0 ? '<w:shd w:fill="F2F2F2"/>' : '';
      const paragraph = cell ? wordParagraph(cell, { bold: rowIndex === 0, after: 40 }) : '<w:p/>';
      return `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/><w:tcMar><w:top w:w="100" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar>${shading}</w:tcPr>${paragraph}</w:tc>`;
    }).join('');
    return `<w:tr>${cells}</w:tr>`;
  }).join('');

  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="single" w:sz="6" w:space="0" w:color="666666"/><w:left w:val="single" w:sz="6" w:space="0" w:color="666666"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="666666"/><w:right w:val="single" w:sz="6" w:space="0" w:color="666666"/><w:insideH w:val="single" w:sz="6" w:space="0" w:color="666666"/><w:insideV w:val="single" w:sz="6" w:space="0" w:color="666666"/></w:tblBorders><w:tblCellMar><w:top w:w="100" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tblCellMar></w:tblPr>${tableRows}</w:tbl>`;
}

function readTableRows(table) {
  return [...table.querySelectorAll('tr')].map(row => (
    [...row.querySelectorAll('th, td')].map(cell => textFromElement(cell))
  ));
}

function readQuickRefRows(section) {
  return [...section.querySelectorAll('.quick-ref-item')].map(item => {
    const label = textFromElement(item.querySelector('.quick-ref-label'));
    const value = textFromElement(item.querySelector('.quick-ref-value'));
    return [label, value];
  });
}

function shouldSkipExportNode(el) {
  return !el
    || el.matches?.('.word-export-btn, .recipe-toggle, .media-toggle, script, style, button, .recipe-icon');
}

function elementToWordBlocks(el) {
  if (shouldSkipExportNode(el)) return [];

  if (el.matches?.('.recipe-title')) {
    return [wordParagraph(textFromElement(el), { style: 'Title', heading: true, bold: true, size: 36, before: 0, after: 120 })];
  }
  if (el.matches?.('.recipe-subtitle')) {
    return [wordParagraph(textFromElement(el), { style: 'Subtitle', size: 20, before: 0, after: 180 })];
  }
  if (el.matches?.('.protocol-tags')) {
    return [];
  }
  if (el.matches?.('table')) {
    return [wordTable(readTableRows(el))];
  }
  if (el.matches?.('.quick-ref')) {
    return [wordTable([['项目', '内容'], ...readQuickRefRows(el)])];
  }
  if (el.matches?.('ol, ul')) {
    const ordered = el.tagName === 'OL';
    return [...el.children]
      .filter(child => child.tagName === 'LI')
      .map((item, index) => wordParagraph(textFromElement(item), {
        numId: ordered ? 1 : 2,
        before: 40,
        after: 60,
        bold: false,
        ilvl: 0,
      }));
  }
  if (el.matches?.('input, select, textarea')) {
    return [wordParagraph(textFromElement(el), { mono: true })];
  }
  if (el.matches?.('.protocol-section-title, .calc-title, .divider, .box-title, .result-title, h2, h3, h4')) {
    return [wordParagraph(textFromElement(el), { style: 'Heading2', heading: true, bold: true, size: 24, before: 180, after: 80 })];
  }

  const childBlocks = [...el.children].flatMap(child => elementToWordBlocks(child));
  if (childBlocks.length) return childBlocks;

  const text = textFromElement(el);
  if (!text) return [];
  return [wordParagraph(text, {
    mono: el.classList?.contains('mono'),
    before: 60,
    after: 100,
  })];
}

function cardToWordXml(card) {
  const title = textFromElement(card.querySelector('.recipe-title')) || '实验卡片';
  const subtitle = textFromElement(card.querySelector('.recipe-subtitle'));
  const tags = [...card.querySelectorAll('.protocol-tags .tag')].map(tag => textFromElement(tag)).filter(Boolean);
  const body = card.querySelector('.recipe-content') || card.querySelector('.recipe-body') || card;
  const blocks = [
    wordParagraph(title, { style: 'Title', heading: true, bold: true, size: 36, before: 0, after: 120 }),
    subtitle ? wordParagraph(subtitle, { style: 'Subtitle', size: 20, before: 0, after: 180 }) : '',
    tags.length ? wordParagraph(`标签：${tags.join(' / ')}`) : '',
    ...[...body.children].flatMap(child => elementToWordBlocks(child)),
  ].filter(Boolean);

  return blocks.join('');
}

function buildDocumentXml(card) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${cardToWordXml(card)}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}

function buildStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Songti SC" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="000000"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Songti SC" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Heiti SC" w:cs="Arial"/><w:b/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Songti SC" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="333333"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="Heading 2"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Heiti SC" w:cs="Arial"/><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style><!-- SimSun fallback for Songti SC; SimHei fallback for Heiti SC --></w:styles>`;
}

function buildNumberingXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum><w:abstractNum w:abstractNumId="2"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="2"/></w:num></w:numbering>`;
}

function buildSettingsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:displayBackgroundShape/><w:defaultTabStop w:val="420"/><w:characterSpacingControl w:val="doNotCompress"/></w:settings>`;
}

function buildContentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`;
}

function buildRootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
}

function buildDocumentRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`;
}

function buildDocxPackage(card) {
  return createZip({
    '[Content_Types].xml': buildContentTypesXml(),
    '_rels/.rels': buildRootRelsXml(),
    'word/_rels/document.xml.rels': buildDocumentRelsXml(),
    'word/document.xml': buildDocumentXml(card),
    'word/styles.xml': buildStylesXml(),
    'word/settings.xml': buildSettingsXml(),
    'word/numbering.xml': buildNumberingXml(),
  });
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
  }
  return crc >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function encodeUtf8(value) {
  return new TextEncoder().encode(value);
}

function concatBytes(chunks) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  chunks.forEach(chunk => {
    output.set(chunk, offset);
    offset += chunk.length;
  });
  return output;
}

function createZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  Object.entries(files).forEach(([fileName, content]) => {
    const nameBytes = encodeUtf8(fileName);
    const data = content instanceof Uint8Array ? content : encodeUtf8(content);
    const checksum = crc32(data);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    offset += localHeader.length + data.length;
  });

  const centralDirectory = concatBytes(centralParts);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, centralParts.length, true);
  endView.setUint16(10, centralParts.length, true);
  endView.setUint32(12, centralDirectory.length, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  return concatBytes([...localParts, centralDirectory, endRecord]);
}

function exportCardToWord(cardId, event) {
  event.stopPropagation();
  const targetCard = document.getElementById(cardId);
  if (!targetCard) return;

  const title = targetCard.querySelector('.recipe-title')?.textContent?.trim();
  const docxBytes = buildDocxPackage(targetCard);
  const blob = new Blob([docxBytes], { type: DOCX_MIME });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFileName(title)}.docx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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
initWordExportButtons();

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
