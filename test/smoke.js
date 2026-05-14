'use strict';

const path = require('path');
const wcocr = require('../src');

const img = path.resolve(__dirname, '..', '.probe', 'native-test', 'test.png');
console.log('[smoke] image:', img);

const env = wcocr.init();
console.log('[smoke] init ok:', env);

const result = wcocr.ocr(img);
const raw = result.raw || {};
console.log(`[smoke] engine=${result.engine} textLen=${result.text.length} lines=${result.lines.length} errcode=${raw.errcode} blocks=${(raw.ocr_response||[]).length}`);
for (const b of (raw.ocr_response||[]).slice(0, 6)) {
  console.log(`  [${b.left.toFixed(0)},${b.top.toFixed(0)},${b.right.toFixed(0)},${b.bottom.toFixed(0)}] ${b.text}`);
}

wcocr.stop();
console.log('[smoke] done');
