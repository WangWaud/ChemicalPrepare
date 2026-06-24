const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
const appJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

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

test('memo lists the correct square plate medium volumes', () => {
  assert.match(
    html,
    /10×10 cm 方皿[\s\S]*?固体培养基 <strong>30 mL<\/strong>/,
  );
  assert.match(
    html,
    /13×13 cm 方皿[\s\S]*?固体培养基 <strong>40 mL<\/strong>/,
  );
});

test('double-tube protocol uses 6 cm plates without rinse-water sterility checks', () => {
  const protocol = html.match(
    /<div class="recipe-card" id="card-proto-double-tube">([\s\S]*?)<!-- ==================== 最近更新/,
  )?.[1] || '';

  assert.match(protocol, /无菌培养皿<\/td><td class="mono">60 mm<\/td><td>预萌发容器/);
  assert.match(protocol, /含有无菌湿润滤纸的 6 cm 圆皿中/);
  assert.doesNotMatch(protocol, /取最后一次冲洗的 250 µL 水涂布 TSA 平板/);
  assert.doesNotMatch(protocol, /第 24 h 和 48 h 时各取 250 µL 冲洗水涂布 TSA 平板/);
  assert.doesNotMatch(protocol, /无菌检测/);
});

test('paired maize leaf microbiome protocol preserves sampling order and key parameters', () => {
  const protocol = html.match(
    /<div class="recipe-card" id="card-proto-leaf-microbiome">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<!-- ==================== 最近更新/,
  )?.[1] || '';

  assert.match(protocol, /同一株玉米/);
  assert.match(protocol, /同一叶位/);
  assert.match(protocol, /先洗脱叶表微生物[\s\S]*再对同一批叶片进行表面灭菌/);
  assert.match(protocol, /0\.01%[\s\S]*Tween-20-PBS/);
  assert.match(protocol, /0\.22 μm/);
  assert.match(protocol, /75% ethanol/);
  assert.match(protocol, /2% NaClO/);
  assert.match(protocol, /无菌水冲洗 5 次/);
  assert.match(protocol, /Final_rinse/);
  assert.match(protocol, /MP FastDNA SPIN Kit for Soil/);
  assert.match(protocol, /16S V5-V7/);
});

test('word export controls are injected by JavaScript instead of hand-written per card', () => {
  assert.match(appJs, /function initWordExportButtons\(\)/);
  assert.match(appJs, /function exportCardToWord\(cardId, event\)/);
  assert.match(appJs, /function buildDocxPackage\(/);
  assert.match(appJs, /function createZip\(/);
  assert.match(appJs, /function crc32\(/);
  assert.match(appJs, /Blob/);
  assert.match(appJs, /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/);
  assert.match(appJs, /\.docx/);
  assert.match(appJs, /event\.stopPropagation\(\)/);
  assert.match(appJs, /\[Content_Types\]\.xml/);
  assert.match(appJs, /word\/document\.xml/);
  assert.match(appJs, /word\/styles\.xml/);
  assert.match(appJs, /word\/settings\.xml/);
  assert.match(appJs, /w:document/);
  assert.match(appJs, /w:tbl/);
  assert.match(appJs, /w:rFonts/);
  assert.match(appJs, /Songti SC/);
  assert.match(appJs, /SimSun/);
  assert.match(appJs, /Heiti SC/);
  assert.match(appJs, /SimHei/);
  assert.match(appJs, /sanitizeFileName\(title\)/);
  assert.match(appJs, /initWordExportButtons\(\)/);
  assert.doesNotMatch(appJs, /application\/msword/);
  assert.doesNotMatch(appJs, /@page WordSection1/);
  assert.doesNotMatch(appJs, /window\.print\(\)/);
  assert.doesNotMatch(appJs, /afterprint/);

  assert.equal((html.match(/class="print-card-btn"/g) || []).length, 0);
  assert.equal((html.match(/class="word-export-btn"/g) || []).length, 0);
});

test('word export button has dedicated styling without print-only layout dependency', () => {
  assert.match(css, /\.word-export-btn/);
  assert.doesNotMatch(css, /\.print-card-btn/);
  assert.doesNotMatch(css, /\.recipe-card\.print-target/);
  assert.doesNotMatch(css, /\.recipe-card\.print-hidden/);
});
