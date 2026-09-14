/* Shared pure rules; no network or DOM access. */
(function (root) {
  "use strict";
  const codeExtensions = new Set(
    "js jsx mjs cjs ts tsx mts cts html htm css scss sass less rb erb rake py pyw java kt kts go rs php cs fs fsx vb cpp cc cxx c h hpp hh swift m mm vue svelte astro graphql gql sql sh bash zsh fish ps1 psm1 bat cmd r rmd lua pl pm ex exs erl hrl clj cljs cljc edn scala sc dart groovy gradle tf tfvars hcl sol proto zig nim v vhd vhdl sv s asm svelte mdx ipynb json jsonc yaml yml toml xml ini cfg conf properties env".split(" ")
  );
  const codeNames = new Set(
    ["Dockerfile", "Containerfile", "Jenkinsfile", "Makefile", "GNUmakefile", "Gemfile",
      "Rakefile", "Procfile", "Vagrantfile", "Brewfile", ".gitignore", ".gitattributes",
      ".dockerignore", ".editorconfig", ".npmrc", ".nvmrc", ".env"]
      .map(name => name.toLowerCase())
  );
  const nonCodeExtensions = new Set(
    "md markdown txt rst adoc pdf png jpg jpeg gif webp avif svg ico bmp tiff mp3 mp4 mov wav ogg woff woff2 ttf eot zip gz tar 7z rar exe dll so bin lock snap".split(" ")
  );
  const lockNames = new Set(["package-lock.json","npm-shrinkwrap.json","yarn.lock","pnpm-lock.yaml",
    "bun.lock","bun.lockb","gemfile.lock","poetry.lock","pipfile.lock","cargo.lock","composer.lock"]);
  function isPullRequestFiles(pathname) {
    return /^\/[^/]+\/[^/]+\/pull\/\d+\/(?:files|changes)\/?$/.test(pathname);
  }
  function classifyFile(path) {
    if (typeof path !== "string" || !path.trim()) return "unknown";
    const normalized = path.trim().replace(/\\/g, "/");
    const name = normalized.split("/").pop().toLowerCase();
    const extension = name.includes(".") ? name.split(".").pop() : "";
    if (lockNames.has(name) || /(^|\/)(__snapshots__|dist|build|coverage|vendor|node_modules)\//i.test(normalized)
        || /\.min\.(js|css)$/i.test(name) || /\.map$/i.test(name)) return "non-code";
    if (codeNames.has(name) || /^(dockerfile|containerfile)\./.test(name) || name.startsWith(".env.")) return "code";
    if (codeExtensions.has(extension)) return "code";
    if (nonCodeExtensions.has(extension) || /^(license|licence|readme|changelog|authors|notice)(\.|$)/i.test(name)) return "non-code";
    // Unknown formats stay visible: never silently discard an unrecognized language.
    return "unknown";
  }
  const api = Object.freeze({ classifyFile, isPullRequestFiles });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PRCodeOnlyRules = api;
})(globalThis);
