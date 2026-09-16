const test = require("node:test");
const assert = require("node:assert/strict");
const { element: el, documentWith } = require("./dom-fixture.cjs");
const { filename, findFiles, findRoot } = require("../dom.js");
const { classifyFile } = require("../rules.js");

function reactFile(path, options = {}) {
  const code = el("code", {}, path);
  if (options.rename) code.append(el("span", {class: "sr-only"}, options.rename));
  const name = el("a", {class: "DiffFileHeader-module__file-name--hash"}, "", [code]);
  const header = el("div", {class: "DiffFileHeader-module__diff-file-header--hash"}, "", [name]);
  const attrs = { id: "diff-" + (options.id || "abcdef") };
  if (!options.fallback) attrs.class = "extra Diff-module__diffTargetable--hash";
  const card = el("div", attrs, "", [header]);
  if (!options.unloaded) card.append(el("table", {}, "diff content"));
  return card;
}

test("React /changes detects and classifies Markdown and TypeScript cards", () => {
  const docs = reactFile("openspec/changes/design.md");
  const code = reactFile("src/hooks/useProject.ts", {id: "code"});
  const list = el("main", {}, "", [docs, code]);
  const doc = documentWith([list]);
  const cards = findFiles(doc);
  assert.equal(cards.length, 2);
  assert.equal(classifyFile(filename(cards[0])), "non-code");
  assert.equal(classifyFile(filename(cards[1])), "code");
  assert.equal(findRoot(doc, cards), list);
});
test("Markdown is detected without loading diff content", () => {
  const card = reactFile("openspec/proposal.md", {unloaded: true});
  const doc = documentWith([card]);
  assert.equal(findFiles(doc)[0], card);
  assert.equal(classifyFile(filename(card)), "non-code");
});
test("guarded diff-id fallback recognizes a real file header", () => {
  const card = reactFile("docs/tasks.md", {fallback: true});
  const doc = documentWith([card]);
  assert.equal(findFiles(doc)[0], card);
  assert.equal(filename(card), "docs/tasks.md");
});
test("diff-id without file header is not treated as a file", () => {
  const doc = documentWith([el("div", {id: "diff-unrelated"}, "design.md")]);
  assert.equal(findFiles(doc).length, 0);
});
test("nested matching wrappers are counted once", () => {
  const outer = reactFile("README.md");
  outer.append(el("div", {"data-testid": "diff-file"}, "nested"));
  assert.equal(findFiles(documentWith([outer])).length, 1);
});
test("legacy data-path still takes precedence", () => {
  const card = el("div", {class: "file js-file", "data-path": "src/app.rb"}, "", [
    el("div", {class:"file-header"}, "", [el("span", {"data-path":"wrong.md"})])
  ]);
  assert.equal(filename(card), "src/app.rb");
  assert.equal(findFiles(documentWith([card]))[0], card);
});
test("legacy titled filename still works", () => {
  const card = el("div", {class:"file js-file"}, "", [
    el("div", {class:"file-header"}, "", [
      el("div", {class:"file-info"}, "", [el("a", {title:"docs/readme.md"}, "readme.md")])
    ])
  ]);
  assert.equal(filename(card), "docs/readme.md");
});
test("directional Unicode markers do not break Markdown extension", () => {
  assert.equal(classifyFile(filename(reactFile("\u200eopenspec/tasks.md\u200f"))), "non-code");
});
test("rename uses destination: source code changed to docs", () => {
  const card = reactFile("src/old.tsdocs/new.md", {rename:"src/old.ts renamed to docs/new.md"});
  assert.equal(filename(card), "docs/new.md");
  assert.equal(classifyFile(filename(card)), "non-code");
});
test("rename uses destination: docs changed to source code", () => {
  const card = reactFile("docs/old.mdsrc/new.ts", {rename:"docs/old.md renamed to src/new.ts"});
  assert.equal(classifyFile(filename(card)), "code");
});
test("accessible non-rename helpers are ignored without changing original DOM", () => {
  const card = reactFile("docs/design.md");
  card.querySelector("code").append(el("span", {class:"sr-only"}, "file actions"));
  assert.equal(filename(card), "docs/design.md");
  assert.equal(card.querySelector(".sr-only").textContent, "file actions");
});
test("unknown path stays unknown instead of reading diff body as filename", () => {
  const card = el("div", {class:"Diff-module__diffTargetable--hash"}, "", [
    el("table", {}, "docs/not-the-filename.md")
  ]);
  assert.equal(filename(card), "");
  assert.equal(classifyFile(filename(card)), "unknown");
});
test("one-file root preserves its list for lazy siblings", () => {
  const card = reactFile("docs/design.md");
  const list = el("section", {}, "", [card]);
  const doc = documentWith([el("main", {}, "", [list])]);
  assert.equal(findRoot(doc, findFiles(doc)), list);
});
test("known diff root wins without selecting body", () => {
  const card = reactFile("src/app.ts");
  const root = el("div", {id:"files"}, "", [el("section", {}, "", [card])]);
  const doc = documentWith([root]);
  assert.equal(findRoot(doc, findFiles(doc)), root);
});
test("empty or unsafe roots leave the page intact", () => {
  const doc = documentWith([el("div", {id:"files"})]);
  assert.equal(findRoot(doc, []), null);
  const first = reactFile("a.md"), second = reactFile("b.ts");
  const broad = documentWith([first, second]);
  assert.equal(findRoot(broad, findFiles(broad)), null);
});
test("hydrated filenames are read again after DOM changes", () => {
  const card = reactFile("");
  assert.equal(classifyFile(filename(card)), "unknown");
  card.querySelector("code").ownText = "docs/loaded.md";
  assert.equal(classifyFile(filename(card)), "non-code");
});

const { collectFiles } = require("../dom.js");
test("file references in diff content do not replace sidebar rows", () => {
  const row = el("li", {}, "", [el("a", {href:"#diff-doc"}, "README.md")]);
  const card = reactFile("README.md", {id:"doc"});
  card.append(el("span", {}, "README.md"));
  const entries = collectFiles(documentWith([row, card]));
  assert.equal(entries.length, 1);
  assert.equal(entries[0].treeElement, row);
  assert.equal(entries[0].diffElement, card);
});
test("encoded diff hashes map full paths onto cards", () => {
  const row = el("li", {}, "", [el("a", {href:"/owner/repo/pull/1/changes%23diff-doc"}, "docs/README.md")]);
  const card = reactFile("README.md", {id:"doc"});
  const entries = collectFiles(documentWith([row, card]));
  assert.equal(entries.length, 1);
  assert.equal(entries[0].path, "docs/README.md");
  assert.equal(entries[0].diffElement, card);
});
test("case-sensitive paths remain separate", () => {
  const entries = collectFiles(documentWith([reactFile("a.ts"), reactFile("A.ts", {id:"other"})]));
  assert.equal(entries.length, 2);
});
test("unrelated links and spans are not files", () => {
  const doc = documentWith([el("a", {href:"#diff-random"}, "README.md"), el("span", {}, "README.md")]);
  assert.deepEqual(collectFiles(doc), []);
});
test("tree-only entries and extensionless code are preserved", () => {
  const row = el("li", {}, "", [el("a", {href:"#diff-docker"}, "Dockerfile")]);
  const entries = collectFiles(documentWith([row]));
  assert.equal(entries[0].path, "Dockerfile");
  assert.equal(entries[0].treeElement, row);
  assert.equal(entries[0].diffElement, null);
});

test("React header and diff content in sibling elements use the whole file container", () => {
  const target = reactFile("app.rb", {unloaded:true});
  const line = el("div", {class:"DiffLine-module__line--hash addition"}, "1 + run()");
  const container = el("section", {class:"DiffFile-module__file--hash"}, "", [target, line]);
  const entry = collectFiles(documentWith([container]))[0];
  assert.equal(entry.diffElement, container);
  assert.equal(entry.path, "app.rb");
});
test("file tree uses the complete hidden path for document rows", () => {
  const row = el("li", {role:"treeitem", "data-tree-entry-type":"file"}, "", [
    el("span", {"data-filterable-item-text":""}, "docs/spec.md"),
    el("a", {href:"#diff-doc"}, "spec.md")
  ]);
  const entry = collectFiles(documentWith([row]))[0];
  assert.equal(entry.path, "docs/spec.md");
  assert.equal(entry.treeElement, row);
  assert.equal(classifyFile(entry.path), "non-code");
});
