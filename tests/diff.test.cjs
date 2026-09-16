const test = require('node:test');
const assert = require('node:assert/strict');
const { element: el, documentWith } = require('./dom-fixture.cjs');
const { filterDiff, updateCounters, showOverallCounter } = require('../diff.js');
const cell = (text, kind = 'addition', children = []) => el('td', {class: `blob-code blob-code-${kind}`}, text, children);
const comment = text => el('span', {class:'pl-c'}, text);

test('counts code but excludes comment-only and blank changes', () => {
  const commentRow = el('tr', {}, '', [cell('', 'addition', [comment('# explanation')])]);
  const card = el('div', {}, '', [commentRow,
    el('tr', {}, '', [cell('run()')]),
    el('tr', {}, '', [cell('old()', 'deletion')]),
    el('tr', {}, '', [cell('   ')]),
    el('tr', {}, '', [cell('context', 'context')])]);
  const hidden = [];
  assert.deepEqual(filterDiff(card, node => hidden.push(node)), {added:1, deleted:1});
  assert.ok(hidden.includes(commentRow));
});
test('split rows preserve code opposite a comment', () => {
  const token = comment('// removed explanation');
  const row = el('tr', {}, '', [cell('', 'deletion', [token]), cell('run()')]);
  const hidden = [];
  assert.deepEqual(filterDiff(el('div', {}, '', [row]), node => hidden.push(node)), {added:1, deleted:0});
  assert.ok(!hidden.includes(row));
  assert.ok(hidden.includes(token));
});
test('comment delimiters in strings are still counted as code', () => {
  const row = el('tr', {}, '', [cell('const url = "https://example.com/#fragment";')]);
  assert.deepEqual(filterDiff(row, () => {}), {added:1, deleted:0});
});
test('modern markers count once when nested in a code cell', () => {
  const marker = el('span', {'data-code-marker':'+'}, 'run()');
  const row = el('tr', {}, '', [cell('', 'addition', [marker])]);
  assert.deepEqual(filterDiff(row, () => {}), {added:1, deleted:0});
});
test('review threads are hidden only within the supplied card', () => {
  const thread = el('div', {'data-testid':'review-thread'}, 'review');
  const hidden = [];
  filterDiff(el('div', {}, '', [thread]), node => hidden.push(node));
  assert.deepEqual(hidden, [thread]);
});
test('summary replacement preserves native content and excludes file counters', () => {
  const native = el('span', {class:'diffstat'}, '+100 -20');
  const fileNative = el('span', {class:'diffstat'}, '+5 -1');
  const card = el('div', {}, '', [fileNative]);
  const anchor = el('a', {href:'/owner/repo/pull/1/changes'}, 'Files changed');
  anchor.getBoundingClientRect = () => ({top:140,left:400});
  native.getBoundingClientRect = () => ({top:140,left:1700});
  const doc = documentWith([anchor, native, card]);
  const created = [], hidden = [];
  updateCounters(doc, {added:2, deleted:1}, node => hidden.push(node), created, doc, [card]);
  assert.deepEqual(hidden, [native]);
  assert.equal(created.length, 1);
  assert.equal(created[0].textContent, 'Código carregado: +2 −1');
  assert.equal(native.textContent, '+100 -20');
  created.forEach(node => node.remove());
  assert.equal(doc.body.children.length, 3);
});
test('inline comments are hidden while their code line remains counted', () => {
  const token = comment(' // explanation');
  const row = el('tr', {}, '', [cell('run();', 'addition', [token])]);
  const hidden = [];
  assert.deepEqual(filterDiff(row, node => hidden.push(node)), {added:1, deleted:0});
  assert.ok(hidden.includes(token));
  assert.ok(!hidden.includes(row));
});

test('an unrecognized summary does not add a second counter to the tab', () => {
  const tab = el('a', {href:'/owner/repo/pull/1/changes'}, 'Files changed');
  const doc = documentWith([tab]);
  const created = [];
  assert.equal(showOverallCounter(doc, {added:3, deleted:2}, () => {}, created, []), false);
  assert.equal(created.length, 0);
  assert.equal(tab.textContent, 'Files changed');
});
test('React rows count changes and hide Ruby comment lines', () => {
  const rows = [
    el('div', {class:'DiffLine-module__line--hash addition'}, '43 + run()'),
    el('div', {class:'DiffLine-module__line--hash deletion'}, '44 - old()'),
    el('div', {class:'DiffLine-module__line--hash addition'}, '45 + # only explanation'),
    el('div', {class:'DiffLine-module__line--hash'}, '46 46 # unchanged comment')
  ];
  const hidden = [];
  assert.deepEqual(filterDiff(el('div', {}, '', rows), node => hidden.push(node), 'app.rb'), {added:1, deleted:1});
  assert.deepEqual(hidden, [rows[2], rows[3]]);
});
test('React rows keep non-comment code with a hash in a string', () => {
  const row = el('div', {class:'DiffLine-module__line--hash addition'}, '12 + puts "#value"');
  const hidden = [];
  assert.deepEqual(filterDiff(el('div', {}, '', [row]), node => hidden.push(node), 'app.rb'), {added:1, deleted:0});
  assert.deepEqual(hidden, []);
});
test('native top summary numbers are replaced without touching file headers', () => {
  const { replaceNativeNumbers } = require('../diff.js');
  const summary = {nodeValue:'+1,079 -34', isConnected:true};
  const cardNumber = {nodeValue:'+2 -1', isConnected:true};
  const outside = {contains: () => false, getBoundingClientRect: () => ({top:350,left:1700})};
  const inside = {contains: () => false, getBoundingClientRect: () => ({top:490,left:1700})};
  summary.parentElement = outside;
  cardNumber.parentElement = inside;
  const card = {contains: node => node === inside};
  const nodes = [summary, cardNumber]; let i = 0;
  const anchor = el('a', {href:'/owner/repo/pull/1/changes'}, 'Files changed');
  anchor.getBoundingClientRect = () => ({top:350,left:400});
  const doc = {body:{}, querySelectorAll: () => [anchor], createTreeWalker: () => ({nextNode: () => nodes[i++] || null})};
  const edits = [];
  assert.equal(replaceNativeNumbers(doc, {added:5, deleted:2}, [card], edits), true);
  assert.equal(summary.nodeValue, '+5 −2');
  assert.equal(cardNumber.nodeValue, '+2 -1');
  edits.forEach(({node, original}) => { node.nodeValue = original; });
  assert.equal(summary.nodeValue, '+1,079 -34');
});
test('review panel with Resolve comment is hidden within a file', () => {
  const button = el('button', {}, 'Resolve comment');
  const panel = el('div', {}, 'Comment on lines R52 to R54', [button]);
  const card = el('div', {}, '', [panel]);
  const hidden = [];
  filterDiff(card, node => hidden.push(node), 'app.rb');
  assert.ok(hidden.includes(panel));
});
test('separate top numbers can be paired by position', () => {
  const { replaceNativeNumbers } = require('../diff.js');
  const aParent = {getBoundingClientRect: () => ({top:144,left:1700})};
  const bParent = {getBoundingClientRect: () => ({top:144,left:1770})};
  const a = {nodeValue:'+493', parentElement:aParent};
  const b = {nodeValue:'-142', parentElement:bParent};
  const nodes = [a,b]; let i=0;
  const anchor = el('a', {href:'/owner/repo/pull/1/changes'}, 'Files changed');
  anchor.getBoundingClientRect = () => ({top:144,left:400});
  const doc = {body:{}, querySelectorAll: () => [anchor], createTreeWalker: () => ({nextNode: () => nodes[i++] || null})};
  const edits = [];
  assert.equal(replaceNativeNumbers(doc, {added:21,deleted:4}, [], edits), true);
  assert.equal(a.nodeValue, '+21');
  assert.equal(b.nodeValue, '−4');
});
test('React line counters read visible plus and minus markers without CSS kind classes', () => {
  const rows = [
    el('div', {class:'DiffLine-module__line--hash'}, '52 + run()'),
    el('div', {class:'DiffLine-module__line--hash'}, '53 - old()'),
    el('div', {class:'DiffLine-module__line--hash'}, '54 54 unchanged()')
  ];
  assert.deepEqual(filterDiff(el('div', {}, '', rows), () => {}, 'app.rb'), {added:1,deleted:1});
});

test('the original top numbers are edited in place and can be restored', () => {
  const { replaceNativeElements } = require('../diff.js');
  const plus = el('span', {}, '+493');
  const minus = el('span', {}, '-142');
  plus.getBoundingClientRect = () => ({top:140,left:1700});
  minus.getBoundingClientRect = () => ({top:140,left:1770});
  const anchor = el('a', {href:'/owner/repo/pull/1/changes'}, 'Files changed');
  anchor.getBoundingClientRect = () => ({top:140,left:400});
  const doc = documentWith([anchor, plus, minus]);
  const edits = [];
  assert.equal(replaceNativeElements(doc, {added:122,deleted:56}, [], edits), true);
  assert.equal(plus.textContent, '+122');
  assert.equal(minus.textContent, '−56');
  for (const edit of edits) edit.element.textContent = edit.originalText;
  assert.equal(plus.textContent, '+493');
  assert.equal(minus.textContent, '-142');
});
test('top number fallback ignores unrelated counts away from the PR tabs', () => {
  const { replaceNativeElements } = require('../diff.js');
  const anchor = el('a', {href:'/owner/repo/pull/1/changes'}, 'Files changed');
  const plus = el('span', {}, '+493');
  const minus = el('span', {}, '-142');
  anchor.getBoundingClientRect = () => ({top:140,left:400});
  plus.getBoundingClientRect = () => ({top:260,left:1700});
  minus.getBoundingClientRect = () => ({top:260,left:1770});
  const doc = documentWith([anchor, plus, minus]);
  assert.equal(replaceNativeElements(doc, {added:3,deleted:2}, [], []), false);
  assert.equal(plus.textContent, '+493');
  assert.equal(minus.textContent, '-142');
});
test('top number fallback ignores numbers left of the Files changed tab', () => {
  const { replaceNativeElements } = require('../diff.js');
  const anchor = el('a', {href:'/owner/repo/pull/1/changes'}, 'Files changed');
  const plus = el('span', {}, '+12');
  const minus = el('span', {}, '-3');
  anchor.getBoundingClientRect = () => ({top:140,left:400});
  plus.getBoundingClientRect = () => ({top:140,left:100});
  minus.getBoundingClientRect = () => ({top:140,left:150});
  const doc = documentWith([plus, minus, anchor]);
  assert.equal(replaceNativeElements(doc, {added:1,deleted:1}, [], []), false);
  assert.equal(plus.textContent, '+12');
});
test('code-files mode keeps source comments, blank changes, and review threads in legacy diffs', () => {
  const commentRow = el('tr', {}, '', [cell('', 'addition', [comment('// why this exists')])]);
  const blankRow = el('tr', {}, '', [cell(' ', 'addition')]);
  const codeRow = el('tr', {}, '', [cell('run()', 'deletion')]);
  const thread = el('div', {class:'review-thread'}, 'Review comment');
  const hidden = [];
  const card = el('div', {}, '', [commentRow, blankRow, codeRow, thread]);
  assert.deepEqual(filterDiff(card, node => hidden.push(node), 'app.js', false), {added:2, deleted:1});
  assert.deepEqual(hidden, []);
});
test('code-files mode counts React comment and blank lines without hiding them', () => {
  const commentRow = el('div', {class:'DiffLine-module__line--hash addition'}, '12 + # reason');
  const blankRow = el('div', {class:'DiffLine-module__line--hash addition'}, '13 + ');
  const codeRow = el('div', {class:'DiffLine-module__line--hash deletion'}, '14 - old()');
  const hidden = [];
  assert.deepEqual(filterDiff(el('div', {}, '', [commentRow, blankRow, codeRow]),
    node => hidden.push(node), 'app.rb', false), {added:2, deleted:1});
  assert.deepEqual(hidden, []);
});
test('code-files mode can use the native file totals including comments and blank lines', () => {
  const { readFileChangeTotals } = require('../diff.js');
  const header = el('div', {class:'file-header'}, 'app.rb +13 -2');
  const card = el('div', {}, '', [header]);
  assert.deepEqual(readFileChangeTotals(card), {added:13, deleted:2});
});
test('the two modes give different totals for a changed comment in a code file', () => {
  const { readFileChangeTotals } = require('../diff.js');
  const header = el('div', {class:'file-header'}, 'app.rb +3 -1');
  const changedCode = el('div', {class:'DiffLine-module__line--hash addition'}, '1 + run()');
  const changedComment = el('div', {class:'DiffLine-module__line--hash addition'}, '2 + # reason');
  const card = el('div', {}, '', [header, changedCode, changedComment]);
  assert.deepEqual(filterDiff(card, () => {}, 'app.rb', true), {added:1, deleted:0});
  assert.deepEqual(readFileChangeTotals(card), {added:3, deleted:1});
});
