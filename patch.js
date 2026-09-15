(() => {
  "use strict";
  function parsePatch(text, classifyFile) {
    const totals = {all:{added:0,deleted:0}, code:{added:0,deleted:0}, files:0, codeFiles:0, nonCodeFiles:0};
    let current = null;
    for (const line of String(text || "").split(/\r?\n/)) {
      const header = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
      if (header) {
        current = {path: header[2], added:0, deleted:0};
        totals.files++;
        const kind = classifyFile(current.path);
        current.isCode = kind === "code" || kind === "unknown";
        if (current.isCode) totals.codeFiles++; else totals.nonCodeFiles++;
        continue;
      }
      if (!current) continue;
      if (/^\+\+\+|^---/.test(line)) continue;
      if (/^\+/.test(line)) { current.added++; totals.all.added++; if (current.isCode) totals.code.added++; }
      else if (/^-/.test(line)) { current.deleted++; totals.all.deleted++; if (current.isCode) totals.code.deleted++; }
    }
    return totals;
  }
  function patchUrl(pathname) {
    const match = pathname.match(/^(\/[^/]+\/[^/]+\/pull\/\d+)(?:\/(?:files|changes))?\/?$/);
    return match ? match[1] + ".patch" : null;
  }
  const api = Object.freeze({parsePatch, patchUrl});
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalThis.PRCodeOnlyPatch = api;
})();
