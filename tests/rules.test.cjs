const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyFile, isPullRequestFiles } = require("../rules.js");

const fileCases = [
  ["src/app.ts", "code"], ["src/App.TSX", "code"], ["app/models/user.rb", "code"],
  ["src/main.py", "code"], ["Dockerfile", "code"], ["docker/Dockerfile.dev", "code"],
  ["Jenkinsfile", "code"], [".github/workflows/ci.yml", "code"],
  ["package.json", "code"], ["tsconfig.json", "code"], [".env.example", "code"],
  ["src/component.svg", "non-code"], ["README.md", "non-code"],
  ["docs/guide.pdf", "non-code"], ["LICENSE", "non-code"],
  ["package-lock.json", "non-code"], ["pnpm-lock.yaml", "non-code"],
  ["Gemfile.lock", "non-code"], ["bun.lockb", "non-code"],
  ["dist/app.js", "non-code"], ["src/__snapshots__/a.snap", "non-code"],
  ["assets/app.min.js", "non-code"], ["src/a.ts.map", "non-code"],
  ["src/module.unknown", "unknown"], ["", "unknown"], [null, "unknown"],
  ["src\\app.ts", "code"], [" src/app.ts ", "code"],
  ["src/README.ts", "code"], ["src/building.ts", "code"]
];
for (const [path, expected] of fileCases) {
  test("classify " + JSON.stringify(path), () => assert.equal(classifyFile(path), expected));
}
const routeCases = [
  ["/owner/repo/pull/123/files", true],
  ["/owner/repo/pull/123/files/", true],
  ["/owner/repo/pull/123/changes", true],
  ["/owner/repo/pull/123", false],
  ["/owner/repo/pull/123/commits", false],
  ["/owner/repo/issues/123", false],
  ["/owner/repo/blob/main/files", false],
  ["/owner/repo/pull/not-a-number/files", false],
  ["/owner/repo/pull/123/files/other", false]
];
for (const [path, expected] of routeCases) {
  test("route " + path, () => assert.equal(isPullRequestFiles(path), expected));
}
