import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../public/auth-gate.js', import.meta.url), 'utf8');
const notice = '本系統為院內試行服務。登入後，AI 搜尋與查看公司聯絡資訊的使用紀錄（時間、帳號、功能）將被保存，用於服務改善與成本統計，不作其他用途。';
function environment(replies) {
  let gate, ready, reloaded = 0;
  const calls = [];
  const document = {
    addEventListener(name, callback) { assert.equal(name, 'DOMContentLoaded'); ready = callback; },
    getElementById() { return gate; }, body: { append(value) { gate = value; } },
    createElement() {
      const nodes = new Map();
      return { innerHTML: '', remove() { gate = null; },
        querySelector(selector) {
          if (selector === '.sf-auth-switch' && !this.innerHTML.includes('<a class="sf-auth-switch"')) return null;
          if (selector.startsWith('#') && !this.innerHTML.includes(`id="${selector.slice(1)}"`)) return null;
          if (selector === 'input') selector = this.innerHTML.includes('id="sf-auth-email"') ? '#sf-auth-email' : '#sf-auth-password';
          if (!nodes.has(selector)) nodes.set(selector, { value: '', disabled: false, textContent: '',
            focus() {}, addEventListener(name, callback) { this[name] = callback; } });
          return nodes.get(selector);
        },
      };
    },
  };
  const context = { document, window: { location: { reload() { reloaded++; } } },
    fetch: async (url, options = {}) => {
      calls.push({ url, ...options });
      assert.ok(replies.length, 'all fetch calls must have a synthetic reply');
      const reply = replies.shift();
      if (reply instanceof Error) throw reply;
      return { ok: reply.status >= 200 && reply.status < 300, status: reply.status, json: async () => reply.body };
    },
  };
  vm.runInNewContext(source, context);
  return { calls, start: () => ready(), get gate() { return gate; }, get reloaded() { return reloaded; },
    async submit() { await gate.querySelector('form').submit({ preventDefault() {} }); },
    async toggle() { await gate.querySelector('.sf-auth-switch').click({ preventDefault() {} }); } };
}
const reply = (status, body) => ({ status, body });
test('gate preserves exact notice, personal email/password form, title, pure JS and no inline events', async () => {
  const env = environment([reply(401, { authenticated: false, shared_login_enabled: false })]);
  await env.start();
  assert.ok(env.gate.innerHTML.includes(notice)); assert.ok(env.gate.innerHTML.includes('內部系統登入'));
  assert.ok(env.gate.querySelector('#sf-auth-email')); assert.ok(env.gate.querySelector('#sf-auth-password'));
  assert.equal(env.gate.querySelector('.sf-auth-switch'), null);
  assert.equal(env.gate.innerHTML.includes('使用共用密碼登入'), false);
  assert.doesNotMatch(source, /\bon(?:click|submit|change)\s*=|\bimport\s/);
});
for (const value of [undefined, false, 'true', 1]) test(`gate does not expose shared entry for ${String(value)}`, async () => {
  const env = environment([reply(401, { shared_login_enabled: value })]); await env.start();
  assert.equal(env.gate.querySelector('.sf-auth-switch'), null);
});
test('shared entry appears only after explicit server flag; toggled request contains password only', async () => {
  const env = environment([reply(401, { shared_login_enabled: true }), reply(200, { ok: true })]);
  await env.start(); assert.ok(env.gate.innerHTML.includes('使用共用密碼登入')); await env.toggle();
  assert.equal(env.gate.querySelector('#sf-auth-email'), null);
  env.gate.querySelector('#sf-auth-password').value = 'synthetic-shared'; await env.submit();
  assert.deepEqual(JSON.parse(env.calls[1].body), { password: 'synthetic-shared' }); assert.equal(env.reloaded, 1);
});
for (const trigger of ['login', 'session-check']) test(`${trigger} must-change opens change form and only reloads after successful update`, async () => {
  const replies = trigger === 'login' ? [reply(401, { shared_login_enabled: false }), reply(200, { ok: true, must_change_password: true })]
    : [reply(200, { authenticated: true, method: 'user', must_change_password: true })];
  replies.push(reply(200, { ok: true }));
  const env = environment(replies); await env.start();
  if (trigger === 'login') {
    env.gate.querySelector('#sf-auth-email').value = 'synthetic@iii.org.tw';
    env.gate.querySelector('#sf-auth-password').value = 'temporary'; await env.submit();
    assert.deepEqual(JSON.parse(env.calls[1].body), { email: 'synthetic@iii.org.tw', password: 'temporary' });
  }
  assert.equal(env.reloaded, 0); assert.equal(env.gate.querySelector('#sf-auth-email'), null);
  assert.ok(env.gate.innerHTML.includes('至少 8 個字元，可使用中文；請勿使用常見密碼'));
  assert.equal(env.gate.querySelector('.sf-auth-switch'), null);
  env.gate.querySelector('#sf-auth-password').value = 'temporary';
  env.gate.querySelector('#sf-auth-new-password').value = 'Secure!8392';
  env.gate.querySelector('#sf-auth-confirm-password').value = 'mismatch';
  const count = env.calls.length; await env.submit(); assert.equal(env.calls.length, count);
  assert.equal(env.gate.querySelector('[role="alert"]').textContent, '兩次新密碼不一致');
  env.gate.querySelector('#sf-auth-confirm-password').value = 'Secure!8392'; await env.submit();
  assert.equal(env.calls.at(-1).url, '/api/change-password');
  assert.deepEqual(JSON.parse(env.calls.at(-1).body), { current_password: 'temporary', new_password: 'Secure!8392' });
  assert.equal(env.reloaded, 1);
});
test('authenticated normal session leaves page accessible without a gate', async () => {
  const env = environment([reply(200, { authenticated: true, must_change_password: false })]);
  await env.start(); assert.equal(env.gate, undefined);
});
test('server errors appear as text, including password policy errors; network errors use fixed message', async () => {
  const env = environment([reply(401, {}), reply(400, { error: '<synthetic-policy-error>' }), new Error('network')]);
  await env.start(); await env.submit();
  assert.equal(env.gate.querySelector('[role="alert"]').textContent, '<synthetic-policy-error>');
  await env.submit(); assert.equal(env.gate.querySelector('[role="alert"]').textContent, '登入服務暫時無法使用，請稍後再試');
  assert.equal(env.gate.querySelector('button').disabled, false);
});
test('session-check network failure gives login gate with fixed service message and no shared entry', async () => {
  const env = environment([new Error('network')]); await env.start();
  assert.equal(env.gate.querySelector('[role="alert"]').textContent, '登入服務暫時無法使用，請稍後再試');
  assert.equal(env.gate.querySelector('.sf-auth-switch'), null);
});
