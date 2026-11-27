import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../public/auth-gate.js', import.meta.url), 'utf8');
const notice = '本系統為院內試行服務。登入後，AI 搜尋與查看公司聯絡資訊的使用紀錄（時間、帳號、功能）將被保存，用於服務改善與成本統計，不作其他用途。';
const unavailable = '登入服務暫時無法使用，請稍後再試';
const user = { authenticated: true, method: 'user', email: 'synthetic@iii.org.tw', role: 'user', must_change_password: false };
const reply = (status, body = {}) => ({ status, body });

// Independent DOM fixture: each element owns its children, attributes and listeners.
// It preserves assigned HTML separately so tests can distinguish textContent writes.
function environment(replies, { nav = true, deferred = false } = {}) {
  const documentListeners = new Map();
  const calls = [];
  let reloaded = 0;
  const document = {
    activeElement: null,
    addEventListener(name, callback) {
      if (!documentListeners.has(name)) documentListeners.set(name, new Set());
      documentListeners.get(name).add(callback);
    },
    removeEventListener(name, callback) { documentListeners.get(name)?.delete(callback); },
    createElement(tag) { return new Element(tag); },
    getElementById(id) { return this.body.querySelector(`#${id}`); },
  };
  class Element {
    constructor(tag, attributes = {}) {
      this.tag = tag; this.attributes = attributes; this.children = []; this.parent = null;
      this.listeners = new Map(); this.value = ''; this.disabled = false;
      this.hidden = Object.hasOwn(attributes, 'hidden'); this._text = ''; this._html = '';
    }
    get id() { return this.attributes.id; }
    set id(value) { this.attributes.id = value; }
    get innerHTML() { return this._html; }
    set innerHTML(value) {
      this._html = value; this.children = []; this._text = '';
      const stack = [this];
      for (const match of value.matchAll(/<[^>]*>|[^<]+/g)) {
        const token = match[0];
        if (token.startsWith('</')) { stack.pop(); continue; }
        if (!token.startsWith('<')) { stack.at(-1)._text += token; continue; }
        const tag = /^<([\w-]+)/.exec(token)?.[1];
        if (!tag) continue;
        const attributes = {};
        const attrs = token.slice(tag.length + 1, -1);
        for (const attr of attrs.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) attributes[attr[1]] = attr[2] ?? '';
        const child = new Element(tag, attributes);
        stack.at(-1).append(child);
        if (!['input', 'hr', 'br', 'img', 'meta', 'link'].includes(tag) && !token.endsWith('/>')) stack.push(child);
      }
    }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
    set textContent(value) { this._text = String(value); this.children = []; }
    append(child) { child.parent = this; this.children.push(child); }
    remove() {
      if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this);
      this.parent = null;
    }
    contains(target) { return this === target || this.children.some(child => child.contains(target)); }
    querySelectorAll(selector) {
      const matches = node => selector.startsWith('#') ? node.id === selector.slice(1)
        : selector.startsWith('.') ? (node.attributes.class || '').split(/\s+/).includes(selector.slice(1))
          : selector.startsWith('[') ? (() => {
            const attr = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(selector);
            return !!attr && Object.hasOwn(node.attributes, attr[1])
              && (attr[2] === undefined || node.getAttribute(attr[1]) === attr[2]);
          })()
            : node.tag === selector;
      return this.children.flatMap(child => [...(matches(child) ? [child] : []), ...child.querySelectorAll(selector)]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name] ?? null; }
    focus() { document.activeElement = this; }
    click() { return this.fire('click'); }
    addEventListener(name, callback) {
      if (!this.listeners.has(name)) this.listeners.set(name, new Set());
      this.listeners.get(name).add(callback);
    }
    async fire(name, event = {}) {
      for (const callback of this.listeners.get(name) || []) await callback({ target: this, preventDefault() {}, ...event });
    }
  }
  document.body = new Element('body');
  function addNav(missing = null) {
    const root = new Element('nav', { id: 'global-nav' });
    root.innerHTML = '<button type="button" class="global-nav-toggle" aria-expanded="false"><span class="global-nav-avatar" data-sf-account-avatar></span></button><div class="global-nav-menu" hidden><div class="global-nav-account" data-sf-account-identity></div><p class="global-nav-section">功能</p><a href="/">首頁搜尋</a><div class="global-nav-account-actions" data-sf-account-actions></div></div>';
    if (missing) root.querySelector('[' + missing + ']').remove();
    const toggle = root.querySelector('.global-nav-toggle');
    toggle.clicks = 0;
    toggle.addEventListener('click', () => {
      toggle.clicks++;
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      root.querySelector('.global-nav-menu').hidden = !open;
    });
    document.body.append(root);
    return root;
  }
  if (deferred) document.body.append(new Element('div', { 'data-sf-nav': 'deferred' }));
  if (nav) addNav();
  const window = { location: { reload() { reloaded++; } } };
  vm.runInNewContext(source, { document, window,
    fetch: async (url, options = {}) => {
      calls.push({ url, ...options });
      assert.ok(replies.length, `unexpected fetch: ${url}`);
      let value = replies.shift();
      if (typeof value === 'function') value = await value();
      if (value instanceof Error) throw value;
      return { ok: value.status >= 200 && value.status < 300, status: value.status, json: async () => value.body };
    },
  });
  return { calls, document, window, addNav,
    get nav() { return document.getElementById('global-nav'); },
    get menu() { return document.getElementById('sf-account-menu'); },
    get gate() { return document.getElementById('sf-auth-gate'); },
    get reloaded() { return reloaded; },
    listenerCount: name => documentListeners.get(name)?.size || 0,
    async dispatch(name, event = {}) { for (const callback of documentListeners.get(name) || []) await callback(event); },
    async start() { await this.dispatch('DOMContentLoaded'); },
  };
}

const slot = (env, name) => env.nav.querySelector('[data-sf-account-' + name + ']');
const select = (env, selector) => env.nav.querySelector(selector);
const logout = env => select(env, '.global-nav-account-logout');
const plain = value => JSON.parse(JSON.stringify(value));

test('static navigation fills personal account safely with one request and no floating menu', async () => {
  const env = environment([reply(200, user)]); await env.start();
  assert.equal(env.menu, null); assert.equal(env.gate, null);
  assert.equal(slot(env, 'avatar').textContent, 'S');
  assert.equal(select(env, '.global-nav-account-photo').textContent, 'S');
  assert.equal(select(env, '.global-nav-account-label').textContent, '目前登入');
  assert.equal(select(env, '.global-nav-account-email').textContent, user.email);
  assert.equal(slot(env, 'identity').innerHTML.includes(user.email), false);
  assert.equal(select(env, '.global-nav-account-role').textContent, '一般使用者');
  assert.equal(select(env, '.global-nav-account-change').textContent, '變更密碼');
  assert.equal(logout(env).textContent, '登出');
  assert.equal(select(env, '.global-nav-account-error').getAttribute('role'), 'alert');
  assert.equal(slot(env, 'actions').querySelector('.global-nav-section').textContent, '帳號');
  assert.deepEqual(env.calls, [{ url: '/api/session-check', credentials: 'same-origin' }]);
  assert.deepEqual(Object.keys(env.window.SFAccount), ['mountNav']);
});

for (const [role, label] of [['super', '系統管理者'], ['admin', '管理者'], ['user', '一般使用者'],
  ['unknown', null], ['constructor', null]]) {
  test('navigation role ' + role + ' maps only approved labels', async () => {
    const env = environment([reply(200, { ...user, role })]); await env.start();
    const badge = select(env, '.global-nav-account-role');
    assert.equal(badge?.textContent ?? null, label);
    if (badge) assert.equal(badge.children.length, 0);
  });
}

test('email HTML characters remain literal text without creating elements', async () => {
  const email = '<img src=x>@iii.org.tw';
  const env = environment([reply(200, { ...user, email })]); await env.start();
  const node = select(env, '.global-nav-account-email');
  assert.equal(node.textContent, email); assert.equal(node.children.length, 0);
  assert.equal(slot(env, 'identity').innerHTML.includes('<img'), false);
  assert.equal(slot(env, 'identity').innerHTML.includes(email), false);
  assert.equal(slot(env, 'identity').querySelector('img'), null);
  assert.equal(slot(env, 'avatar').textContent, '<');
});

test('shared password navigation has shared identity, no avatar or password change', async () => {
  const env = environment([reply(200, { authenticated: true, method: 'shared' })]); await env.start();
  assert.equal(slot(env, 'identity').textContent, '共用密碼登入中');
  assert.equal(slot(env, 'avatar').textContent, '');
  assert.equal(select(env, '.global-nav-account-change'), null);
  assert.equal(select(env, '.global-nav-account-role'), null);
  assert.equal(logout(env).textContent, '登出');
  assert.equal(slot(env, 'actions').querySelectorAll('button').length, 1);
  assert.equal(env.menu, null); assert.equal(env.calls.length, 1);
});

const exclusions = [
  ['forced change', reply(200, { ...user, must_change_password: true })],
  ['401', reply(401, user)], ['503', reply(503, user)],
  ['network', new Error('synthetic network')],
  ['api_key', reply(200, { ...user, method: 'api_key' })],
  ['missing method', reply(200, { authenticated: true, email: user.email })],
  ['missing email', reply(200, { ...user, email: undefined })],
  ['empty email', reply(200, { ...user, email: '' })],
  ['whitespace email', reply(200, { ...user, email: '  ' })],
  ['non-string email', reply(200, { ...user, email: 42 })],
  ['unauthenticated', reply(200, { ...user, authenticated: false })],
];
for (const [label, response] of exclusions) test('no navigation account UI for ' + label + ', including later mount', async () => {
  const env = environment([response]); await env.start(); env.window.SFAccount.mountNav();
  for (const name of ['avatar', 'identity', 'actions']) assert.equal(slot(env, name).textContent, '');
  assert.equal(env.menu, null); assert.equal(env.calls.length, 1);
});

for (const missing of ['identity', 'actions', 'avatar']) {
  test('legacy nav missing ' + missing + ' falls back without partially filling other slots', async () => {
    const env = environment([reply(200, user)]);
    slot(env, missing).remove(); await env.start();
    assert.ok(env.menu); assert.equal(env.calls.length, 1);
    for (const name of ['avatar', 'identity', 'actions']) {
      if (name !== missing) assert.equal(slot(env, name).textContent, '');
    }
  });
}

test('feedback style page without nav or deferred marker retains floating fallback', async () => {
  const env = environment([reply(200, user)], { nav: false }); await env.start();
  assert.ok(env.menu);
  assert.equal(env.menu.querySelector('.sf-account-email').textContent, user.email);
  assert.equal(env.menu.querySelector('.sf-account-toggle').getAttribute('aria-label'), '帳號選單');
  assert.equal(env.calls.length, 1);
});

test('deferred React-first mount does nothing until eligible session arrives', async () => {
  let resolve;
  const pending = new Promise(done => { resolve = done; });
  const env = environment([() => pending], { nav: false, deferred: true });
  const session = env.start();
  env.window.SFAccount.mountNav(); assert.equal(env.menu, null);
  env.addNav(); env.window.SFAccount.mountNav();
  assert.equal(slot(env, 'identity').textContent, '');
  resolve(reply(200, user)); await session;
  assert.equal(select(env, '.global-nav-account-email').textContent, user.email);
  assert.equal(env.menu, null); assert.equal(env.calls.length, 1);
});

test('deferred session-first waits for mounted navigation and mount does not fetch', async () => {
  const env = environment([reply(200, user)], { nav: false, deferred: true });
  await env.start(); assert.equal(env.menu, null); assert.equal(env.nav, null);
  env.addNav(); assert.equal(slot(env, 'identity').textContent, '');
  env.window.SFAccount.mountNav();
  assert.equal(select(env, '.global-nav-account-email').textContent, user.email);
  assert.equal(env.menu, null); assert.equal(env.calls.length, 1);
});

test('ineligible deferred session never mounts account contents', async () => {
  const env = environment([reply(200, { ...user, method: 'api_key' })], { nav: false, deferred: true });
  await env.start(); env.addNav(); env.window.SFAccount.mountNav();
  assert.equal(slot(env, 'identity').textContent, '');
  assert.equal(env.menu, null); assert.equal(env.calls.length, 1);
});

test('repeated mounts and replaced navigation have one identity and one logout listener', async () => {
  const env = environment([reply(200, user), reply(204)]); await env.start();
  for (let i = 0; i < 3; i++) env.window.SFAccount.mountNav();
  assert.equal(select(env, '.global-nav-account-email').textContent, user.email);
  assert.equal(slot(env, 'identity').querySelectorAll('.global-nav-account-email').length, 1);
  assert.equal(slot(env, 'actions').querySelectorAll('.global-nav-account-logout').length, 1);
  assert.equal(logout(env).listeners.get('click').size, 1);
  env.nav.remove(); env.addNav(); env.window.SFAccount.mountNav(); env.window.SFAccount.mountNav();
  assert.equal(slot(env, 'identity').querySelectorAll('.global-nav-account-email').length, 1);
  assert.equal(logout(env).listeners.get('click').size, 1);
  await logout(env).fire('click');
  assert.equal(env.calls.length, 2); assert.equal(env.reloaded, 1); assert.equal(env.menu, null);
});

for (const open of [true, false]) test('change password from ' + (open ? 'open' : 'closed') + ' nav closes only when needed and supports cancel', async () => {
  const env = environment([reply(200, user)]); await env.start();
  const toggle = select(env, '.global-nav-toggle');
  toggle.setAttribute('aria-expanded', String(open));
  select(env, '.global-nav-menu').hidden = !open;
  await select(env, '.global-nav-account-change').fire('click');
  assert.equal(toggle.clicks, open ? 1 : 0);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(select(env, '.global-nav-menu').hidden, true);
  assert.equal(env.gate.querySelector('#sf-auth-title').textContent, '變更密碼');
  await env.gate.querySelector('.sf-auth-cancel').fire('click');
  assert.equal(env.gate, null); assert.equal(env.calls.length, 1); assert.equal(env.reloaded, 0);
});

for (const method of ['user', 'shared']) test('navigation logout ' + method + ' posts exact options, disables pending and reloads once', async () => {
  let resolve;
  const pending = new Promise(done => { resolve = done; });
  const env = environment([reply(200, { ...user, method }), () => pending]); await env.start();
  const button = logout(env);
  const action = button.fire('click');
  assert.equal(button.disabled, true);
  assert.deepEqual(plain(env.calls[1]), { url: '/api/logout', method: 'POST', credentials: 'same-origin' });
  assert.equal(env.reloaded, 0);
  resolve(reply(204)); await action;
  assert.equal(env.reloaded, 1); assert.equal(button.disabled, false);
});

for (const [label, response] of [['500', reply(500)], ['network', new Error('synthetic network')]]) {
  test('navigation logout ' + label + ' shows fixed error, enables retry and keeps page', async () => {
    const env = environment([reply(200, user), response, reply(200)]); await env.start();
    await logout(env).fire('click');
    assert.equal(env.reloaded, 0); assert.equal(logout(env).disabled, false);
    assert.equal(select(env, '.global-nav-account-error').textContent, '登出失敗，請稍後再試');
    await logout(env).fire('click');
    assert.equal(env.reloaded, 1); assert.equal(select(env, '.global-nav-account-error').textContent, '');
    assert.deepEqual(plain(env.calls[2]), { url: '/api/logout', method: 'POST', credentials: 'same-origin' });
  });
}

test('auth remains pure JS without polling or inline events and has a single logout request', () => {
  assert.doesNotMatch(source, /\b(?:setTimeout|setInterval|MutationObserver)\b|\bon\w+\s*=|\bimport\s/);
  assert.equal([...source.matchAll(/fetch\('\/api\/logout'/g)].length, 1);
});

test('homepage demo sections have numbered first children, deferred root and mount-only integration', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const sections = [...html.matchAll(/<section\b([^>]*(?:id="home-demo-first"|aria-label="(?:收錄來源示範|找公司示範)")[^>]*)>([\s\S]*?)<\/section>/g)]
    .filter(([, attrs]) => /id="home-demo-first"|aria-label="(?:收錄來源示範|找公司示範)"/.test(attrs));
  assert.equal(sections.length, 3);
  sections.forEach(([, attrs, contents], i) => {
    assert.match(attrs, /className="[^"]*\bhome-demo-block\b[^"]*"/);
    assert.match(contents, new RegExp('^\\s*<p className="home-demo-block-label">問答 ' + (i + 1) + '</p>'));
  });
  const style = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  assert.match(style, /\.home-demo-block\s*\{[^}]*padding: 16px;[^}]*border: 1px solid var\(--sf-accent-100\);[^}]*border-radius: 16px;[^}]*background: color-mix\(in srgb, var\(--sf-accent-50\) 55%, #ffffff\);/);
  assert.match(style, /\.home-demo-block-label\s*\{[^}]*margin: 0 0 8px;[^}]*color: var\(--sf-accent-800\);[^}]*font-size: 12px;[^}]*font-weight: 700;/);
  assert.match(style, /@media \(min-width: 768px\)\s*\{\s*\.home-demo-block\s*\{\s*padding: 20px;/);
  assert.match(html, /<div id="root" data-sf-nav="deferred"><\/div>/);
  const nav = html.slice(html.indexOf('function GlobalNav('), html.indexOf('function App('));
  assert.match(nav, /useEffect\(\(\) => \{ window\.SFAccount\?\.mountNav\?\.\(\); \}, \[\]\);/);
  assert.match(sections[0][1], /aria-hidden=\{!loading && !demoCombo\} style=\{\{ visibility: loading \|\| demoCombo \? "visible" : "hidden" \}\}/);
});

test('navigation CSS hides empty slots and preserves responsive Tiffany account styling', () => {
  const css = readFileSync(new URL('../public/theme.css', import.meta.url), 'utf8');
  for (const name of ['identity', 'actions']) assert.ok(css.includes('#global-nav [data-sf-account-' + name + ']:empty { display: none; }'));
  assert.match(css, /#global-nav \.global-nav-avatar:empty \{ display: none; \}/);
  assert.match(css, /#global-nav \.global-nav-toggle::after \{ content: none; \}/);
  assert.match(css, /#global-nav \.global-nav-menu \{ width: min\(260px, calc\(100vw - 32px\)\); padding: 8px; \}/);
  assert.match(css, /#global-nav \.global-nav-account-email \{[^}]*overflow-wrap: anywhere;/);
  for (const line of css.slice(css.indexOf('#global-nav')).trim().split('\n')) assert.ok(line.startsWith('#global-nav'), line);
});
