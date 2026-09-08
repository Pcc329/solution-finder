(() => {
  const sessionCheckUrl = '/api/session-check';
  const loginUrl = '/api/login';

  function addGate() {
    if (document.getElementById('sf-auth-gate')) return;
    const gate = document.createElement('div');
    gate.id = 'sf-auth-gate';
    gate.innerHTML = `
      <style>
        #sf-auth-gate { position: fixed; inset: 0; z-index: 2147483647; display: grid; place-items: center; padding: 24px; background: rgba(15, 23, 42, 0.72); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft JhengHei", sans-serif; }
        #sf-auth-gate .sf-auth-card { width: min(100%, 380px); padding: 28px; border: 1px solid #dbe3ea; border-radius: 12px; background: #fff; box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28); color: #172033; }
        #sf-auth-gate h1 { margin: 0 0 8px; font-size: 22px; }
        #sf-auth-gate p { margin: 0 0 20px; color: #5f6c80; line-height: 1.6; }
        #sf-auth-gate label { display: block; margin-bottom: 8px; font-size: 14px; font-weight: 700; }
        #sf-auth-gate input { box-sizing: border-box; width: 100%; padding: 12px; border: 1px solid #b8c4d2; border-radius: 6px; font: inherit; }
        #sf-auth-gate button { width: 100%; margin-top: 16px; padding: 12px; border: 0; border-radius: 6px; background: #0b9d8d; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
        #sf-auth-gate button:disabled { cursor: wait; opacity: 0.7; }
        #sf-auth-gate [role="alert"] { min-height: 20px; margin: 12px 0 0; color: #c2410c; font-size: 14px; }
      </style>
      <form class="sf-auth-card" novalidate>
        <h1>內部系統登入</h1>
        <p>請輸入共用密碼以使用 Solution Finder。</p>
        <label for="sf-auth-password">共用密碼</label>
        <input id="sf-auth-password" name="password" type="password" autocomplete="current-password" required autofocus>
        <p role="alert" aria-live="polite"></p>
        <button type="submit">登入</button>
      </form>`;
    document.body.append(gate);

    const form = gate.querySelector('form');
    const input = gate.querySelector('input');
    const button = gate.querySelector('button');
    const error = gate.querySelector('[role="alert"]');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      error.textContent = '';
      button.disabled = true;
      try {
        const response = await fetch(loginUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: input.value }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          error.textContent = data.error || '登入失敗，請稍後再試';
          return;
        }
        window.location.reload();
      } catch (err) {
        error.textContent = '登入服務暫時無法使用，請稍後再試';
      } finally {
        button.disabled = false;
      }
    });
  }

  async function checkSession() {
    try {
      const response = await fetch(sessionCheckUrl, { credentials: 'same-origin' });
      return response.ok;
    } catch (err) {
      return false;
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (!(await checkSession())) addGate();
  });
})();
