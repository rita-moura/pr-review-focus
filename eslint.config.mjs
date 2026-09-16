export default [
  {
    files: ["*.js", "tests/*.cjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        chrome: "readonly", document: "readonly", window: "readonly", location: "readonly",
        MutationObserver: "readonly", console: "readonly", setTimeout: "readonly",
        clearTimeout: "readonly", setInterval: "readonly", clearInterval: "readonly",
        module: "readonly", require: "readonly", setImmediate: "readonly",
        process: "readonly", __dirname: "readonly", getComputedStyle: "readonly",
        URL: "readonly"
      }
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-constant-binary-expression": "error",
      "no-unreachable": "error",
      "eqeqeq": ["error", "always", { null: "ignore" }]
    }
  }
];
