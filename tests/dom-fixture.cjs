// Minimal DOM fixture for adapter unit tests, NOT a browser implementation.
// Supports only the descendant/simple selectors used by dom.js; unknown syntax throws.
class Element {
  constructor(tag, attributes = {}, text = "", children = []) {
    this.tagName = tag.toUpperCase();
    this.attributes = { ...attributes };
    this.ownText = text;
    this.children = [];
    this.parentElement = null;
    this.listeners = new Map();
    for (const child of children) this.append(child);
  }
  get id() { return this.getAttribute("id") || ""; }
  closest(selector) {
    for (let node = this; node; node = node.parentElement) {
      if (selector.split(",").some(part => matchesDescendant(node, part.trim()))) return node;
    }
    return null;
  }
  append(child) { child.parentElement = this; this.children.push(child); }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  click() { this.listeners.get("click")?.(); }
  setAttribute(name, value) { this.attributes[name] = value; }
  insertBefore(child, reference) {
    child.parentElement = this;
    this.children.splice(this.children.indexOf(reference), 0, child);
  }
  set textContent(value) { this.children = []; this.ownText = value; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  get textContent() { return this.ownText + this.children.map(child => child.textContent).join(""); }
  contains(node) { return this === node || this.children.some(child => child.contains(node)); }
  cloneNode(deep) {
    return new Element(this.tagName, this.attributes, this.ownText,
      deep ? this.children.map(child => child.cloneNode(true)) : []);
  }
  remove() {
    if (!this.parentElement) return;
    const parent = this.parentElement;
    parent.children = parent.children.filter(child => child !== this);
    this.parentElement = null;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const result = [];
    for (const child of this.children) {
      if (selector.split(",").some(part => matchesDescendant(child, part.trim()))) result.push(child);
      result.push(...child.querySelectorAll(selector));
    }
    return result;
  }
}
function simple(node, selector) {
  let ok = true;
  let rest = selector.replace(/\[([\w-]+)(?:(\^=|\*=|\$=|=)['"]([^'"]*)['"])?\]/g,
    (_, name, operator, value) => {
      const actual = node.getAttribute(name);
      if (actual === null) ok = false;
      else if (operator === "=" && actual !== value) ok = false;
      else if (operator === "^=" && !actual.startsWith(value)) ok = false;
      else if (operator === "*=" && !actual.includes(value)) ok = false;
      else if (operator === "$=" && !actual.endsWith(value)) ok = false;
      return "";
    });
  rest = rest.replace(/\.([\w-]+)/g, (_, name) => {
    if (!(node.getAttribute("class") || "").split(/\s+/).includes(name)) ok = false;
    return "";
  }).replace(/#([\w-]+)/g, (_, id) => {
    if (node.getAttribute("id") !== id) ok = false;
    return "";
  });
  if (rest && !/^[a-z][a-z0-9-]*$/i.test(rest)) throw new Error("Unsupported fixture selector: " + selector);
  return ok && (!rest || node.tagName.toLowerCase() === rest.toLowerCase());
}
function matchesDescendant(node, selector) {
  const parts = selector.split(/\s+/);
  if (!simple(node, parts.pop())) return false;
  let parent = node.parentElement;
  while (parts.length) {
    const part = parts.pop();
    while (parent && !simple(parent, part)) parent = parent.parentElement;
    if (!parent) return false;
    parent = parent.parentElement;
  }
  return true;
}
function element(tag, attrs, text, children) { return new Element(tag, attrs, text, children); }
function documentWith(children) {
  const body = element("body", {}, "", children);
  const html = element("html", {}, "", [body]);
  return { createElement: tag => element(tag), getElementById: id => html.querySelector("#" + id), body, documentElement: html, querySelector: selector => html.querySelector(selector), querySelectorAll: selector => html.querySelectorAll(selector) };
}
module.exports = { element, documentWith };
