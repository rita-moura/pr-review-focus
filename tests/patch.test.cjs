const test = require("node:test");
const assert = require("node:assert/strict");
const {parsePatch, patchUrl} = require("../patch.js");
const {classifyFile} = require("../rules.js");

const fixture = [
  "diff --git a/src/app.rb b/src/app.rb",
  "--- a/src/app.rb",
  "+++ b/src/app.rb",
  "@@ -1 +1,2 @@",
  "-old",
  "+new",
  "+line",
  "diff --git a/docs/design.md b/docs/design.md",
  "--- a/docs/design.md",
  "+++ b/docs/design.md",
  "@@ -1 +1 @@",
  "-old doc",
  "+new doc",
  "diff --git a/package.json b/package.json",
  "--- a/package.json",
  "+++ b/package.json",
  "@@ -1 +1 @@",
  "-old",
  "+new",
  ""
].join("\n");

test("parsePatch separates code and non-code totals", () => {
  assert.deepEqual(parsePatch(fixture, classifyFile), {
    all: {added: 4, deleted: 3},
    code: {added: 3, deleted: 2},
    files: 3,
    codeFiles: 2,
    nonCodeFiles: 1
  });
});

test("patchUrl resolves PR files and changes routes", () => {
  assert.equal(patchUrl("/owner/repo/pull/12/changes"), "/owner/repo/pull/12.patch");
  assert.equal(patchUrl("/owner/repo/pull/12/files"), "/owner/repo/pull/12.patch");
  assert.equal(patchUrl("/owner/repo/pull/12"), "/owner/repo/pull/12.patch");
  assert.equal(patchUrl("/owner/repo/issues/12"), null);
});
