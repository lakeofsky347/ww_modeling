'use strict';
// Regression for the toolbar `run` binding in renderTop shadowing the simulation
// function (issue #3). Also flags the same kind of shadowing in the page scripts
// this UI pass touches. No engine, formulas, or game data.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..', '..');
const APP = path.join(__dirname, 'app.js');

function tokenize(src) {
  const tokens = [];
  let i = 0;
  let line = 1;
  const n = src.length;
  function bump(ch) { if (ch === '\n') line++; }
  while (i < n) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '\n') { line++; i++; continue; }
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { bump(src[i]); i++; }
      i = Math.min(n, i + 2);
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const q = c;
      const start = line;
      i++;
      while (i < n) {
        if (src[i] === '\\') { bump(src[i]); i++; if (i < n) { bump(src[i]); i++; } continue; }
        if (src[i] === q) { i++; break; }
        bump(src[i]); i++;
      }
      tokens.push({ t: 'str', line: start });
      continue;
    }
    if (c === '/' && maybeRegex(tokens)) {
      const start = line;
      i++;
      while (i < n) {
        if (src[i] === '\\') { bump(src[i]); i++; if (i < n) { bump(src[i]); i++; } continue; }
        if (src[i] === '[') {
          i++;
          while (i < n && src[i] !== ']') { if (src[i] === '\\') i++; bump(src[i]); i++; }
          if (i < n) i++;
          continue;
        }
        if (src[i] === '\n') break;
        if (src[i] === '/') { i++; break; }
        bump(src[i]); i++;
      }
      while (i < n && /[a-z]/i.test(src[i])) i++;
      tokens.push({ t: 're', line: start });
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      const start = line;
      while (i < n && /[0-9a-zA-Z_.]/.test(src[i])) i++;
      tokens.push({ t: 'num', line: start });
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      const start = i;
      const startLine = line;
      while (i < n && /[A-Za-z0-9_$]/.test(src[i])) i++;
      tokens.push({ t: 'id', v: src.slice(start, i), line: startLine });
      continue;
    }
    if (c === '=' && src[i + 1] === '=') {
      const v = src[i + 2] === '=' ? '===' : '==';
      tokens.push({ t: 'punct', v: v, line: line });
      i += v.length;
      continue;
    }
    if (c === '!' && src[i + 1] === '=') {
      const v = src[i + 2] === '=' ? '!==' : '!=';
      tokens.push({ t: 'punct', v: v, line: line });
      i += v.length;
      continue;
    }
    if ((c === '&' && src[i + 1] === '&') || (c === '|' && src[i + 1] === '|') ||
        (c === '+' && src[i + 1] === '+') || (c === '-' && src[i + 1] === '-') ||
        (c === '<' && src[i + 1] === '=') || (c === '>' && src[i + 1] === '=')) {
      tokens.push({ t: 'punct', v: src.slice(i, i + 2), line: line });
      i += 2;
      continue;
    }
    tokens.push({ t: 'punct', v: c, line: line });
    i++;
  }
  return tokens;
}

function maybeRegex(tokens) {
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (t.t === 'id') return /^(return|throw|case|delete|void|typeof|in|of|do|else|instanceof|new)$/.test(t.v);
    if (t.t === 'punct') return !/^(\)|\]|\+\+|--)$/.test(t.v);
    return true;
  }
  return true;
}

// A `var` / `let` / `const` whose name is an outer function, then called.
function shadowCalls(src) {
  const tokens = tokenize(src);
  const findings = [];
  const stack = [{ type: 'script', funcs: new Set(), vars: new Map(), bodyDepth: -1 }];
  let depth = 0;
  function cur() { return stack[stack.length - 1]; }
  function funcScope() {
    for (let i = stack.length - 1; i >= 0; i--) if (stack[i].type === 'func' || stack[i].type === 'script') return stack[i];
    return stack[0];
  }
  function resolve(name) {
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].vars.has(name)) return { kind: stack[i].vars.get(name), at: i };
      if (stack[i].funcs.has(name)) return { kind: 'function', at: i };
    }
    return null;
  }
  function bindVar(name, kind) {
    const target = kind === 'var' ? funcScope() : cur();
    if (!target.funcs.has(name)) target.vars.set(name, kind);
  }
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.t === 'punct' && t.v === '{') { depth++; continue; }
    if (t.t === 'punct' && t.v === '}') {
      depth--;
      while (stack.length > 1 && cur().bodyDepth > depth) stack.pop();
      continue;
    }
    if (t.t === 'id' && t.v === 'function') {
      let j = i + 1;
      let name = null;
      if (tokens[j] && tokens[j].t === 'id') { name = tokens[j].v; j++; }
      while (j < tokens.length && !(tokens[j].t === 'punct' && tokens[j].v === '(')) j++;
      if (tokens[j] && tokens[j].v === '(') {
        let pd = 0;
        for (; j < tokens.length; j++) {
          if (tokens[j].t === 'punct' && tokens[j].v === '(') pd++;
          else if (tokens[j].t === 'punct' && tokens[j].v === ')') { pd--; if (pd === 0) { j++; break; } }
        }
      }
      if (tokens[j] && tokens[j].t === 'punct' && tokens[j].v === '{') {
        if (name) funcScope().funcs.add(name);
        depth++;
        const scope = { type: 'func', funcs: new Set(), vars: new Map(), bodyDepth: depth };
        if (name) scope.funcs.add(name);
        stack.push(scope);
        i = j;
      }
      continue;
    }
    if (t.t === 'id' && (t.v === 'var' || t.v === 'let' || t.v === 'const')) {
      const kind = t.v === 'var' ? 'var' : 'lexical';
      let pd = 0;
      let bd = 0;
      for (let j = i + 1; j < tokens.length; j++) {
        const x = tokens[j];
        const prev = tokens[j - 1];
        if (x.t === 'punct' && x.v === '(') pd++;
        else if (x.t === 'punct' && x.v === ')') pd = Math.max(0, pd - 1);
        else if (x.t === 'punct' && x.v === '{') bd++;
        else if (x.t === 'punct' && x.v === '}') { if (bd === 0) break; bd--; }
        else if (pd === 0 && bd === 0 && x.t === 'punct' && x.v === ';') break;
        else if (pd === 0 && bd === 0 && x.t === 'id' && x.v === 'function') break;
        else if (pd === 0 && bd === 0 && x.t === 'id' && prev &&
            (j === i + 1 || (prev.t === 'punct' && prev.v === ','))) bindVar(x.v, kind);
      }
      continue;
    }
    if (t.t === 'id' && tokens[i + 1] && tokens[i + 1].t === 'punct' && tokens[i + 1].v === '(') {
      const hit = resolve(t.v);
      if (hit && (hit.kind === 'var' || hit.kind === 'lexical')) {
        for (let s = hit.at - 1; s >= 0; s--) {
          if (stack[s].funcs.has(t.v)) {
            findings.push({ name: t.v, line: t.line });
            break;
          }
        }
      }
    }
  }
  return findings;
}

function pageSources() {
  return [
    'pipeline/ww/page/app.js',
    'frontend/theme/compare.js',
    'frontend/theme/gamenav.js',
    'frontend/theme/resultbar.js',
  ].map(function (rel) {
    return { rel: rel, src: fs.readFileSync(path.join(ROOT, rel), 'utf8') };
  });
}

test('scanner flags a local var that shadows a called function', () => {
  const sample = [
    'function run() { return 1; }',
    'function renderTop() {',
    '  var run = el;',
    '  click = function () { run(); };',
    '}',
  ].join('\n');
  const hits = shadowCalls(sample);
  assert.ok(hits.some(function (h) { return h.name === 'run'; }), 'expected the fixture to be flagged');
});

test('built page uses the same unshadowed toolbar binding', () => {
  const html = fs.readFileSync(path.join(ROOT, 'dist/ww/index.html'), 'utf8');
  assert.equal(html.includes("var run = $('ww-top-run')"), false);
  assert.equal(html.includes("var topRun = $('ww-top-run')"), true);
  assert.equal(html.includes("if (topRun) topRun.innerHTML"), true);
});

test('page scripts do not call a var that shadows an outer function', () => {
  const hits = [];
  pageSources().forEach(function (f) {
    shadowCalls(f.src).forEach(function (h) { hits.push(f.rel + ':' + h.line + ' ' + h.name); });
  });
  assert.deepEqual(hits, []);
});

function createDom() {
  const byId = Object.create(null);
  const all = [];
  function make(tag) {
    const node = {
      tagName: String(tag || 'div').toUpperCase(),
      id: '',
      className: '',
      textContent: '',
      value: '',
      checked: false,
      disabled: false,
      type: '',
      style: {},
      _attrs: Object.create(null),
      children: [],
      onclick: null,
      onchange: null,
      setAttribute: function (k, v) {
        this._attrs[k] = String(v);
        if (k === 'id') { this.id = String(v); byId[this.id] = this; }
      },
      getAttribute: function (k) { return this._attrs[k] == null ? null : this._attrs[k]; },
      removeAttribute: function (k) { delete this._attrs[k]; },
      appendChild: function (c) { this.children.push(c); return c; },
      remove: function () {},
      querySelector: function () { return null; },
      querySelectorAll: function () { return []; },
      focus: function () {},
    };
    node.classList = {
      add: function (c) { node.className = (node.className + ' ' + c).trim(); },
      remove: function (c) { node.className = node.className.split(/\s+/).filter(function (x) { return x && x !== c; }).join(' '); },
      toggle: function (c) {
        const on = node.className.split(/\s+/).indexOf(c) >= 0;
        if (on) { node.classList.remove(c); return false; }
        node.classList.add(c); return true;
      },
      contains: function (c) { return node.className.split(/\s+/).indexOf(c) >= 0; },
    };
    let html = '';
    Object.defineProperty(node, 'innerHTML', {
      get: function () { return html; },
      set: function (v) {
        html = String(v);
        const re = /id="([^"]+)"/g;
        let m;
        while ((m = re.exec(html))) {
          if (!byId[m[1]]) {
            const child = make('div');
            child.id = m[1];
            child._attrs.id = m[1];
            byId[m[1]] = child;
          }
        }
      },
    });
    all.push(node);
    return node;
  }
  const document = {
    readyState: 'complete',
    body: null,
    documentElement: null,
    getElementById: function (id) { return byId[id] || null; },
    createElement: function (tag) { return make(tag); },
    addEventListener: function () {},
    removeEventListener: function () {},
    querySelector: function () { return null; },
    querySelectorAll: function (sel) {
      if (sel === 'input[aria-invalid="true"]') return all.filter(function (e) { return e._attrs['aria-invalid'] === 'true'; });
      return [];
    },
  };
  document.body = make('body');
  document.documentElement = make('html');
  ['ww-top-actions', 'ww-top-run', 'ww-top', 'ww-summary', 'ww-status'].forEach(function (id) {
    const n = make('div');
    n.id = id;
    n._attrs.id = id;
    byId[id] = n;
  });
  return document;
}

function loadPage() {
  const document = createDom();
  const context = {
    window: null,
    document: document,
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    __wwArm: false,
    __wwSawRun: 0,
  };
  context.window = {
    document: document,
    __WW_PAGE__: {
      presets: [
        { name: '默认', config: { team: [{ id: 1 }], duration: 25, rotation: { mode: 'manual', sequence: 'a' } } },
        { name: '冷启动', config: { team: [{ id: 1 }], duration: 30, rotation: { mode: 'manual', sequence: 'b' } } },
      ],
    },
    addEventListener: function () {},
    removeEventListener: function () {},
  };
  context.globalThis = context;
  vm.createContext(context);
  const bridge = fs.readFileSync(path.join(ROOT, 'pipeline/shared/sim_bridge.js'), 'utf8');
  let app = fs.readFileSync(APP, 'utf8');
  app = app.replace(
    'function run() {',
    'function run() { if (globalThis.__wwArm) { globalThis.__wwSawRun++; throw new Error("WW_RUN"); }'
  );
  app = app.replace(
    'window.__WW_UI__ = { S: S, run: run, renderAll: renderAll',
    'window.__WW_UI__ = { S: S, run: run, renderTop: renderTop, renderAll: renderAll'
  );
  app = app.replace('function renderInputs(keepBuildScroll) {', 'function renderInputs(keepBuildScroll) { return;');
  app = app.replace('function save() {', 'function save() { return;');
  app = app.replace('function toast(msg) {', 'function toast(msg) { return;');
  vm.runInContext(bridge + '\n' + app, context, { filename: 'app.js' });
  const UI = context.window.__WW_UI__;
  assert.equal(typeof UI.renderTop, 'function');
  assert.equal(typeof UI.run, 'function');
  UI.renderTop();
  context.__wwArm = true;
  return { context: context, document: document, UI: UI };
}

function invoke(fn, thisArg) {
  try { fn.call(thisArg); return null; }
  catch (e) { return e; }
}

test('renderTop callbacks call the simulation function', () => {
  const page = loadPage();
  const runBtn = page.document.getElementById('ww-run');
  const preset = page.document.getElementById('ww-preset');
  const auto = page.document.getElementById('ww-auto');
  assert.equal(typeof runBtn.onclick, 'function');
  assert.equal(typeof preset.onchange, 'function');
  assert.equal(typeof auto.onchange, 'function');

  let err = invoke(runBtn.onclick, runBtn);
  assert.equal(err && err.message, 'WW_RUN', '计算 should call run(), got ' + (err && err.message));
  assert.equal(page.context.__wwSawRun, 1);

  preset.value = '1';
  err = invoke(preset.onchange, preset);
  assert.equal(err && err.message, 'WW_RUN', '载入预设 should call run(), got ' + (err && err.message));
  assert.equal(page.UI.S.config.duration, 30);
  assert.equal(page.context.__wwSawRun, 2);

  page.UI.S.dirty = true;
  page.UI.S.auto = false;
  auto.checked = false;
  err = invoke(auto.onchange, auto);
  assert.equal(err, null, 'turning auto-compute off must not recompute');
  assert.equal(page.context.__wwSawRun, 2);

  page.UI.S.dirty = true;
  auto.checked = true;
  err = invoke(auto.onchange, auto);
  assert.equal(err && err.message, 'WW_RUN', 'turning auto-compute back on should call run(), got ' + (err && err.message));
  assert.equal(page.UI.S.auto, true);
  assert.equal(page.context.__wwSawRun, 3);
});

test('invalid input still blocks 计算 and auto-compute', () => {
  const page = loadPage();
  const bad = page.document.createElement('input');
  bad.setAttribute('aria-invalid', 'true');
  const runBtn = page.document.getElementById('ww-run');
  const auto = page.document.getElementById('ww-auto');
  let err = invoke(runBtn.onclick, runBtn);
  assert.equal(err, null);
  assert.equal(page.context.__wwSawRun, 0);

  page.UI.S.dirty = true;
  auto.checked = true;
  err = invoke(auto.onchange, auto);
  assert.equal(err, null);
  assert.equal(page.UI.S.auto, true);
  assert.equal(page.context.__wwSawRun, 0);
});
