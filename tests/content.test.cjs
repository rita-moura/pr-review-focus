const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const rules = require("../rules.js");
const dom = require("../dom.js");
const { element: el, documentWith } = require("./dom-fixture.cjs");
function setup() {
  const docs = el("div", {class:"file js-file", "data-path":"README.md"});
  const code = el("div", {class:"file js-file", "data-path":"app.ts"});
  const files = el("section", {id:"files"}, "", [docs, code]);
  const navigation = el("nav");
  const tab = el("a", {href:"/owner/repo/pull/1/changes"}, "Files changed");
  const document = documentWith([el("main", {}, "", [tab, navigation, files])]);
  function classes(node) {
    const values = new Set();
    node.classList = { add: value => values.add(value), remove: value => values.delete(value), contains: value => values.has(value) };
    node.children.forEach(classes);
  }
  classes(document.documentElement);
  let listener, poll, mutation, failure = null, intervalStopped = false;
  const events = {}, reports = [], pending = new Map();
  let nextId = 0;
  document.addEventListener = (name, fn) => { events[name] = fn; };
  document.removeEventListener = (name, fn) => { if (events[name] === fn) delete events[name]; };
  const runtime = { id: "test-extension", onMessage: { addListener(fn) { listener = fn; }, removeListener() {} }, sendMessage(message) {
    if (failure === "sync") throw new Error("Extension context invalidated.");
    if (failure === "async") return Promise.reject(new Error("Extension context invalidated."));
    if (failure === "transient") return Promise.reject(new Error("Receiving end does not exist."));
    reports.push(message); return Promise.resolve();
  } };
  const location = { pathname:"/owner/repo/pull/1/changes", href:"https://github.com/owner/repo/pull/1/changes" };
  vm.runInNewContext(fs.readFileSync(require.resolve("../content.js"), "utf8"), {
    PRCodeOnlyDiff: require("../diff.js"), PRCodeOnlyRules: rules, PRCodeOnlyDOM: dom, document, location, console,
    chrome: { runtime },
    MutationObserver: class { constructor(fn) { mutation = fn; } observe() {} disconnect() {} },
    setTimeout(fn) { pending.set(++nextId, fn); return nextId; }, clearTimeout(id) { pending.delete(id); },
    setInterval(fn) { poll = fn; return 1; }, clearInterval() { intervalStopped = true; }, window: { addEventListener() {}, removeEventListener() {} }
  });
  return { fail(value) { failure = value; }, invalidate() { runtime.id = undefined; }, throwOnContextCheck() { Object.defineProperty(runtime, "id", {get() { throw new Error("Extension context invalidated."); }}); }, intervalStopped() { return intervalStopped; }, docs, code, tab, navigation, document, location, reports, events,
    toggle() { listener({type:"toggleCodeOnly"}, {}, () => {}); },
    poll() { poll(); }, mutate() { mutation(); for (const [id, fn] of pending) { pending.delete(id); fn(); } } };
}
test("click toggles filtering and restores all marked elements", () => {
  const app = setup();
  app.toggle();
  assert.equal(app.docs.classList.contains("prco-hidden"), true);
  assert.equal(app.code.classList.contains("prco-hidden"), false);
  assert.equal(app.navigation.classList.contains("prco-hidden"), false);
  assert.equal(app.reports.at(-1).enabled, true);
  app.toggle();
  assert.equal(app.docs.classList.contains("prco-hidden"), false);
  assert.equal(app.navigation.classList.contains("prco-hidden"), false);
  assert.equal(app.reports.at(-1).enabled, false);
});
test("Escape disables the filter and reports the badge state", () => {
  const app = setup(); app.toggle(); app.events.keydown({key:"Escape"});
  assert.equal(app.docs.classList.contains("prco-hidden"), false);
  assert.equal(app.reports.at(-1).enabled, false);
});
test("leaving Changes restores the page", () => {
  const app = setup(); app.toggle();
  app.location.pathname = "/owner/repo/pull/1"; app.location.href = "https://github.com/owner/repo/pull/1";
  app.poll();
  assert.equal(app.navigation.classList.contains("prco-hidden"), false);
  assert.equal(app.reports.at(-1).enabled, false);
  app.toggle(); assert.equal(app.docs.classList.contains("prco-hidden"), false);
});
test("DOM updates reclassify reused cards", () => {
  const app = setup(); app.toggle(); app.docs.attributes["data-path"] = "new.ts"; app.mutate();
  assert.equal(app.docs.classList.contains("prco-hidden"), false);
});
test("unrecognized diffs keep the page intact and report a warning", () => {
  const app = setup(); app.docs.remove(); app.code.remove(); app.toggle();
  assert.equal(app.navigation.classList.contains("prco-hidden"), false);
  assert.equal(app.document.body.classList.contains("prco-active"), false);
  assert.equal(app.reports.at(-1).warning, true);
});

test("synchronous invalidation restores the page and stops the old script", () => {
  const app = setup(); app.toggle(); app.fail("sync");
  assert.doesNotThrow(() => app.mutate());
  assert.equal(app.docs.classList.contains("prco-hidden"), false);
  assert.equal(app.intervalStopped(), true);
  assert.equal(app.events.keydown, undefined);
  app.toggle();
  assert.equal(app.docs.classList.contains("prco-hidden"), false);
});
test("asynchronous invalidation also cleans up", async () => {
  const app = setup(); app.toggle(); app.fail("async"); app.mutate();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.docs.classList.contains("prco-hidden"), false);
  assert.equal(app.intervalStopped(), true);
});
test("idle tabs detect loss of extension context without a DOM change", () => {
  const app = setup(); app.toggle(); app.invalidate(); app.poll();
  assert.equal(app.docs.classList.contains("prco-hidden"), false);
  assert.equal(app.intervalStopped(), true);
});
test("temporary messaging errors do not disable a valid filter", async () => {
  const app = setup(); app.fail("transient"); app.toggle(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.docs.classList.contains("prco-hidden"), true);
  assert.equal(app.intervalStopped(), false);
});

test("a throwing runtime id getter cannot leak an uncaught error", () => {
  const app = setup(); app.toggle(); app.throwOnContextCheck();
  assert.doesNotThrow(() => app.poll());
  assert.equal(app.docs.classList.contains("prco-hidden"), false);
  assert.equal(app.intervalStopped(), true);
});
test("React diff lines hide comment-only rows without adding a tab counter", () => {
  const app = setup();
  const added = el("div", {class:"DiffLine-module__line--hash addition"}, "12 + run()");
  const comment = el("div", {class:"DiffLine-module__line--hash addition"}, "13 + // explanation");
  app.code.append(added);
  app.code.append(comment);
  for (const node of [added, comment]) {
    const values = new Set();
    node.classList = { add: value => values.add(value), remove: value => values.delete(value), contains: value => values.has(value) };
  }
  app.toggle();
  assert.equal(app.tab.textContent, "Files changed");
  assert.equal(comment.classList?.contains("prco-hidden"), true);
  assert.equal(added.classList?.contains("prco-hidden"), false);
  app.toggle();
  assert.equal(app.tab.textContent, "Files changed");
});
test('documentation in the file tree hides with the matching diff and restores on toggle', () => {
  const app = setup();
  const row = el('li', {role:'treeitem', 'data-tree-entry-type':'file'}, '', [
    el('span', {'data-filterable-item-text':''}, 'docs/README.md'),
    el('a', {href:'#diff-doc', title:'docs/README.md'}, 'README.md')
  ]);
  const values = new Set();
  row.classList = {add: value => values.add(value), remove: value => values.delete(value), contains: value => values.has(value)};
  app.navigation.append(row);
  app.toggle();
  assert.equal(row.classList.contains('prco-hidden'), true);
  app.toggle();
  assert.equal(row.classList.contains('prco-hidden'), false);
});
test('documentation card is hidden even without a matching file-tree path', () => {
  const app = setup();
  const header = el('div', {class:'file-header'}, '', [
    el('a', {title:'docs/spec.md'}, 'spec.md')
  ]);
  const card = el('div', {class:'file js-file'}, '', [header]);
  const values = new Set();
  card.classList = {add: value => values.add(value), remove: value => values.delete(value), contains: value => values.has(value)};
  app.document.body.append(card);
  app.toggle();
  assert.equal(card.classList.contains('prco-hidden'), true);
  app.toggle();
  assert.equal(card.classList.contains('prco-hidden'), false);
});
test('mode picker preserves the icon toggle and keeps documentation hidden in both modes', () => {
  const app = setup();
  const comment = el('div', {class:'DiffLine-module__line--hash addition'}, '12 + // explanation');
  const thread = el('div', {class:'review-thread'}, 'Review comment');
  for (const node of [comment, thread]) {
    const values = new Set();
    node.classList = {add: value => values.add(value), remove: value => values.delete(value), contains: value => values.has(value)};
    app.code.append(node);
  }
  app.toggle();
  let picker = app.document.querySelector('#prco-mode-picker');
  assert.equal(picker.children[0].getAttribute('aria-pressed'), 'true');
  assert.equal(comment.classList.contains('prco-hidden'), true);
  assert.equal(thread.classList.contains('prco-hidden'), true);
  assert.equal(app.docs.classList.contains('prco-hidden'), true);
  picker.children[1].click();
  picker = app.document.querySelector('#prco-mode-picker');
  assert.equal(picker.children[1].getAttribute('aria-pressed'), 'true');
  assert.equal(comment.classList.contains('prco-hidden'), false);
  assert.equal(thread.classList.contains('prco-hidden'), false);
  assert.equal(app.docs.classList.contains('prco-hidden'), true);
  assert.equal(app.reports.at(-1).mode, 'files');
  app.toggle();
  assert.equal(app.document.querySelector('#prco-mode-picker'), null);
  assert.equal(app.docs.classList.contains('prco-hidden'), false);
  app.toggle();
  assert.equal(app.document.querySelector('#prco-mode-picker').children[1].getAttribute('aria-pressed'), 'true');
});
test('diff hash links hide documentation even when the tree lacks expected roles', () => {
  const app = setup();
  const anchor = el('a', {href:'#diff-a1b2c3d4', title:'docs/spec.md'}, 'spec.md');
  const values = new Set();
  anchor.classList = {add: value => values.add(value), remove: value => values.delete(value), contains: value => values.has(value)};
  app.navigation.append(anchor);
  const header = el('div', {class:'file-header'}, 'docs/spec.md');
  const docCard = el('div', {id:'diff-a1b2c3d4'}, '', [header]);
  const cardValues = new Set();
  docCard.classList = {add: value => cardValues.add(value), remove: value => cardValues.delete(value), contains: value => cardValues.has(value)};
  app.document.body.append(docCard);
  app.toggle();
  assert.equal(anchor.classList.contains('prco-hidden'), true);
  assert.equal(docCard.classList.contains('prco-hidden'), true);
  app.toggle();
  assert.equal(anchor.classList.contains('prco-hidden'), false);
  assert.equal(docCard.classList.contains('prco-hidden'), false);
});
test('file links still hide documentation when their title is an action label', () => {
  const app = setup();
  const anchor = el('a', {href:'#diff-b2c3d4e5', title:'Open file'}, 'spec.md');
  const values = new Set();
  anchor.classList = {add: value => values.add(value), remove: value => values.delete(value), contains: value => values.has(value)};
  app.navigation.append(anchor);
  const header = el('div', {class:'file-header'}, '.../spec.md +70');
  const card = el('div', {id:'diff-b2c3d4e5'}, '', [header]);
  const cardValues = new Set();
  card.classList = {add: value => cardValues.add(value), remove: value => cardValues.delete(value), contains: value => cardValues.has(value)};
  app.document.body.append(card);
  app.toggle();
  assert.equal(anchor.classList.contains('prco-hidden'), true);
  assert.equal(card.classList.contains('prco-hidden'), true);
});
