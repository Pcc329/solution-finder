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
function environment(replies) {
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
          : selector.startsWith('[') ? node.getAttribute('role') === /^\[role="([^"]+)"\]$/.exec(selector)?.[1]
            : node.tag === selector;
      return this.children.flatMap(child => [...(matches(child) ? [child] : []), ...child.querySelectorAll(selector)]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name] ?? null; }
    focus() { document.activeElement = this; }
    addEventListener(name, callback) {
      if (!this.listeners.has(name)) this.listeners.set(name, new Set());
      this.listeners.get(name).add(callback);
    }
    async fire(name, event = {}) {
      for (const callback of this.listeners.get(name) || []) await callback({ target: this, preventDefault() {}, ...event });
    }
  }
  document.body = new Element('body');
  vm.runInNewContext(source, { document, window: { location: { reload() { reloaded++; } } },
    fetch: async (url, options = {}) => {
      calls.push({ url, ...options });
      assert.ok(replies.length, `unexpected fetch: ${url}`);
      let value = replies.shift();
      if (typeof value === 'function') value = await value();
      if (value instanceof Error) throw value;
      return { ok: value.status >= 200 && value.status < 300, status: value.status, json: async () => value.body };
    },
  });
  return { calls, document,
    get menu() { return document.getElementById('sf-account-menu'); },
    get gate() { return document.getElementById('sf-auth-gate'); },
    get reloaded() { return reloaded; },
    listenerCount: name => documentListeners.get(name)?.size || 0,
    async dispatch(name, event = {}) { for (const callback of documentListeners.get(name) || []) await callback(event); },
    async start() { await this.dispatch('DOMContentLoaded'); },
  };
}
const select = (env, selector) => env.menu.querySelector(selector);
const panel = env => select(env, '#sf-account-panel');
const toggle = env => select(env, '.sf-account-toggle');
const logout = env => select(env, '.sf-account-logout');
async function openChange(replies = []) {
  const env = environment([reply(200, user), ...replies]);
  await env.start(); await toggle(env).fire('click');
  await select(env, '.sf-account-change').fire('click');
  return env;
}
function fillChange(env, confirmation = 'Synthetic!9384') {
  env.gate.querySelector('#sf-auth-password').value = 'SyntheticOld!123';
  env.gate.querySelector('#sf-auth-new-password').value = 'Synthetic!9384';
  env.gate.querySelector('#sf-auth-confirm-password').value = confirmation;
}
const submit = env => env.gate.querySelector('form').fire('submit');

test('personal session creates menu with text email, actions, one fetch and no gate', async () => {
  const env = environment([reply(200, user)]);
  assert.equal(env.listenerCount('click'), 0); assert.equal(env.listenerCount('keydown'), 0);
  await env.start();
  assert.ok(env.menu); assert.equal(env.gate, null);
  assert.equal(select(env, '.sf-account-email').textContent, user.email);
  assert.equal(env.menu.innerHTML.includes(user.email), false);
  assert.equal(select(env, '.sf-account-change').textContent, '變更密碼');
  assert.equal(logout(env).textContent, '登出');
  assert.equal(select(env, '.sf-account-label').textContent, '目前登入');
  assert.equal(select(env, '.sf-account-error').textContent, '');
  assert.deepEqual(env.calls, [{ url: '/api/session-check', credentials: 'same-origin' }]);
  for (const [name, value] of Object.entries({ type: 'button', 'aria-label': '帳號選單', title: '帳號選單',
    'aria-haspopup': 'true', 'aria-controls': 'sf-account-panel' })) assert.equal(toggle(env).getAttribute(name), value);
  assert.equal(panel(env).getAttribute('role'), 'menu');
  assert.equal(logout(env).getAttribute('role'), 'menuitem');
  assert.equal(select(env, '.sf-account-change').getAttribute('role'), 'menuitem');
  assert.equal(select(env, '.sf-account-error').getAttribute('role'), 'alert');
});

test('HTML characters in email remain literal text and never enter assigned markup', async () => {
  const env = environment([reply(200, { ...user, email: '<img src=x>@iii.org.tw' })]); await env.start();
  assert.equal(select(env, '.sf-account-email').textContent, '<img src=x>@iii.org.tw');
  assert.equal(env.menu.innerHTML.includes('<img'), false);
  assert.equal(select(env, '.sf-account-email').children.length, 0);
});

test('shared session has shared label and logout without change password', async () => {
  const env = environment([reply(200, { authenticated: true, method: 'shared' })]); await env.start();
  assert.equal(select(env, '.sf-account-label').textContent, '共用密碼登入中');
  assert.ok(logout(env)); assert.equal(select(env, '.sf-account-change'), null);
  assert.equal(select(env, '.sf-account-email'), null); assert.equal(env.calls.length, 1);
});

const exclusions = [
  ['forced password change', reply(200, { ...user, must_change_password: true }), true],
  ['401', reply(401, { authenticated: true, method: 'shared' }), true],
  ['503', reply(503, user), true], ['network error', new Error('synthetic network'), true],
  ['api key', reply(200, { ...user, method: 'api_key' }), false],
  ['missing method', reply(200, { authenticated: true, email: user.email }), false],
  ['missing email', reply(200, { ...user, email: undefined }), false],
  ['empty email', reply(200, { ...user, email: '' }), false],
  ['whitespace email', reply(200, { ...user, email: '  ' }), false],
  ['non-string email', reply(200, { ...user, email: 42 }), false],
  ['unknown method', reply(200, { ...user, method: 'unknown' }), false],
  ['unauthenticated', reply(200, { ...user, authenticated: false }), true],
];
for (const [label, response, hasGate] of exclusions) test(`no account menu for ${label}`, async () => {
  const env = environment([response]); await env.start();
  assert.equal(env.menu, null); assert.equal(!!env.gate, hasGate);
  assert.equal(env.listenerCount('click'), 0); assert.equal(env.listenerCount('keydown'), 0);
  assert.equal(env.calls.length, 1);
  if (label === 'forced password change') {
    assert.ok(env.gate.querySelector('#sf-auth-new-password'));
    assert.equal(env.gate.querySelector('.sf-auth-cancel'), null);
  }
});

test('toggle, outside click, Escape focus and unrelated keys follow panel state', async () => {
  const env = environment([reply(200, user)]); await env.start();
  const check = open => { assert.equal(panel(env).hidden, !open); assert.equal(toggle(env).getAttribute('aria-expanded'), String(open)); };
  check(false); await toggle(env).fire('click'); check(true);
  await toggle(env).fire('click'); check(false);
  await toggle(env).fire('click');
  await env.dispatch('click', { target: select(env, '.sf-account-email') }); check(true);
  await env.dispatch('keydown', { key: 'Enter' }); check(true);
  await env.dispatch('click', { target: env.document.createElement('div') }); check(false);
  await toggle(env).fire('click'); await env.dispatch('keydown', { key: 'Escape' }); check(false);
  assert.equal(env.document.activeElement, toggle(env));
  env.document.activeElement = null; await env.dispatch('keydown', { key: 'Escape' });
  assert.equal(env.document.activeElement, null);
});

test('recreating menu replaces old element and document listeners without duplicates', async () => {
  const env = environment([reply(200, user), reply(200, user)]); await env.start();
  const old = env.menu; await env.start();
  assert.notEqual(env.menu, old); assert.equal(old.parent, null);
  assert.equal(env.document.body.querySelectorAll('#sf-account-menu').length, 1);
  assert.equal(env.listenerCount('click'), 1); assert.equal(env.listenerCount('keydown'), 1);
  assert.equal(env.calls.length, 2);
});

for (const method of ['user', 'shared']) test(`logout ${method} disables while pending, posts without body and reloads on 204`, async () => {
  let resolve;
  const pending = new Promise(done => { resolve = done; });
  const env = environment([reply(200, { ...user, method }), () => pending]); await env.start();
  const action = logout(env).fire('click'); assert.equal(logout(env).disabled, true);
  assert.deepEqual(env.calls[1], { url: '/api/logout', method: 'POST', credentials: 'same-origin' });
  resolve(reply(204)); await action; assert.equal(env.reloaded, 1);
});
for (const [label, response] of [['500', reply(500, { error: '<private upstream>' })], ['network', new Error('synthetic network')]]) {
  test(`logout ${label} keeps page, reports fixed text and re-enables retry`, async () => {
    const env = environment([reply(200, user), response, reply(200)]); await env.start();
    await logout(env).fire('click');
    assert.equal(env.reloaded, 0); assert.equal(logout(env).disabled, false);
    assert.equal(select(env, '.sf-account-error').textContent, '登出失敗，請稍後再試');
    await logout(env).fire('click'); assert.equal(env.reloaded, 1);
    assert.equal(select(env, '.sf-account-error').textContent, '');
  });
}

test('voluntary change closes menu and opens three-password dialog with notice and cancel only', async () => {
  const env = await openChange();
  assert.equal(panel(env).hidden, true); assert.equal(toggle(env).getAttribute('aria-expanded'), 'false');
  assert.equal(env.gate.querySelector('#sf-auth-title').textContent, '變更密碼');
  const inputs = env.gate.querySelectorAll('input'); assert.equal(inputs.length, 3);
  assert.ok(inputs.every(input => input.getAttribute('type') === 'password'));
  assert.ok(env.gate.innerHTML.includes('至少 8 個字元，可使用中文；請勿使用常見密碼'));
  assert.equal(env.gate.innerHTML.includes('首次登入請先'), false);
  assert.ok(env.gate.innerHTML.includes(notice));
  assert.equal(env.gate.querySelector('.sf-auth-cancel').getAttribute('href'), '#');
  for (const selector of ['.sf-auth-signup', '.sf-auth-switch', '#sf-auth-email']) assert.equal(env.gate.querySelector(selector), null);
  assert.equal(env.calls.length, 1); assert.ok(env.menu);
});

test('cancel removes voluntary gate with no request or reload; menu can open it again', async () => {
  const env = await openChange(); let prevented = false;
  await env.gate.querySelector('.sf-auth-cancel').fire('click', { preventDefault() { prevented = true; } });
  assert.equal(prevented, true); assert.equal(env.gate, null);
  assert.equal(env.calls.length, 1); assert.equal(env.reloaded, 0);
  await select(env, '.sf-account-change').fire('click'); assert.ok(env.gate);
});

test('voluntary mismatched new passwords show text and do not fetch', async () => {
  const env = await openChange(); fillChange(env, 'mismatch'); await submit(env);
  assert.equal(env.calls.length, 1); assert.equal(env.reloaded, 0);
  assert.equal(env.gate.querySelector('[role="alert"]').textContent, '兩次新密碼不一致');
  assert.equal(env.gate.querySelector('button').disabled, false);
});

test('voluntary success posts exact body, keeps page, replaces card and closes without fetch', async () => {
  const env = await openChange([reply(200, { ok: true })]); fillChange(env); await submit(env);
  assert.equal(env.calls[1].url, '/api/change-password');
  assert.equal(env.calls[1].method, 'POST'); assert.equal(env.calls[1].credentials, 'same-origin');
  assert.deepEqual(JSON.parse(env.calls[1].body), { current_password: 'SyntheticOld!123', new_password: 'Synthetic!9384' });
  assert.equal(env.calls[1].headers['Content-Type'], 'application/json'); assert.equal(env.reloaded, 0);
  const card = env.gate.querySelector('.sf-auth-card');
  assert.ok(card.textContent.includes('密碼已變更。下次登入請使用新密碼。'));
  assert.ok(card.textContent.includes(notice)); assert.equal(card.querySelector('form'), null);
  assert.equal(card.querySelector('.sf-auth-cancel'), null);
  const close = card.querySelector('.sf-auth-close'); assert.equal(close.getAttribute('type'), 'button');
  await close.fire('click'); assert.equal(env.gate, null); assert.ok(env.menu);
  assert.equal(env.calls.length, 2); assert.equal(env.reloaded, 0);
});

for (const [label, response, message] of [
  ['wrong current password', reply(401, { error: '目前密碼錯誤' }), '目前密碼錯誤'],
  ['HTML policy message', reply(400, { error: '<synthetic policy>' }), '<synthetic policy>'],
  ['network', new Error('synthetic network'), unavailable],
]) test(`voluntary ${label} shows literal error, keeps dialog and enables button`, async () => {
  const env = await openChange([response]); fillChange(env); await submit(env);
  const error = env.gate.querySelector('[role="alert"]');
  assert.equal(error.textContent, message); assert.equal(error.innerHTML, '');
  assert.equal(env.gate.querySelector('button').disabled, false); assert.equal(env.reloaded, 0);
  assert.ok(env.gate.querySelector('.sf-auth-cancel'));
});

test('forced change retains original title, explanation, notice, no cancel, reload on success', async () => {
  const env = environment([reply(200, { ...user, must_change_password: true }), reply(200, { ok: true })]);
  await env.start();
  assert.equal(env.gate.querySelector('#sf-auth-title').textContent, '內部系統登入');
  assert.ok(env.gate.innerHTML.includes('首次登入請先變更密碼。至少 8 個字元，可使用中文；請勿使用常見密碼'));
  assert.ok(env.gate.innerHTML.includes(notice)); assert.equal(env.gate.querySelector('.sf-auth-cancel'), null);
  assert.equal(env.menu, null); fillChange(env); await submit(env); assert.equal(env.reloaded, 1);
});

test('scoped menu styles, fixed low stacking order, responsive width, print and pure JS', () => {
  assert.match(source, /z-index: 150;/); assert.match(source, /left: 16px; bottom: 16px;/);
  assert.match(source, /width: 44px; height: 44px;/);
  assert.match(source, /width: min\(260px, calc\(100vw - 32px\)\)/);
  assert.match(source, /overflow-wrap: anywhere/);
  assert.match(source, /@media print \{ #sf-account-menu \{ display: none; \} \}/);
  assert.match(source, /z-index: 2147483647/);
  assert.doesNotMatch(source, /\bon\w+\s*=|\bimport\s|<img\b|<script\b/);
  const markup = source.slice(source.indexOf('function accountMenuMarkup'), source.indexOf('let removeAccountListeners'));
  const style = /<style>([\s\S]*?)<\/style>/.exec(markup)[1];
  for (const line of style.trim().split('\n')) assert.ok(line.trim().startsWith('#sf-account-menu') || line.trim().startsWith('@media print'));
});
