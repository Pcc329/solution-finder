(() => {
  const notice = '本系統為院內試行服務。登入後，AI 搜尋與查看公司聯絡資訊的使用紀錄（時間、帳號、功能）將被保存，用於服務改善與成本統計，不作其他用途。';
  const unavailable = '登入服務暫時無法使用，請稍後再試';
  let sharedEnabled = false;

  function addGate(mode = 'personal', initialError = '') {
    document.getElementById('sf-auth-gate')?.remove();
    const gate = document.createElement('div');
    gate.id = 'sf-auth-gate';
    const changing = mode === 'change';
    const shared = mode === 'shared';
    gate.innerHTML = `
      <style>
        #sf-auth-gate { position: fixed; inset: 0; z-index: 2147483647; display: grid; place-items: center; padding: 24px; overflow-y: auto; background: rgba(15, 23, 42, 0.72); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft JhengHei", sans-serif; }
        #sf-auth-gate .sf-auth-card { box-sizing: border-box; width: min(100%, 420px); margin: auto; padding: 28px; border: 1px solid #dbe3ea; border-radius: 12px; background: #fff; box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28); color: #172033; }
        #sf-auth-gate h1 { margin: 0 0 8px; font-size: 22px; }
        #sf-auth-gate p { margin: 0 0 16px; color: #5f6c80; line-height: 1.6; }
        #sf-auth-gate label { display: block; margin: 16px 0 8px; font-size: 14px; font-weight: 700; }
        #sf-auth-gate input { box-sizing: border-box; width: 100%; padding: 12px; border: 1px solid #b8c4d2; border-radius: 6px; font: inherit; }
        #sf-auth-gate button { width: 100%; margin-top: 16px; padding: 12px; border: 0; border-radius: 6px; background: #0b9d8d; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
        #sf-auth-gate button:disabled { cursor: wait; opacity: 0.7; }
        #sf-auth-gate [role="alert"] { min-height: 20px; margin: 12px 0 0; color: #c2410c; font-size: 14px; }
        #sf-auth-gate .sf-auth-notice { margin-top: 20px; font-size: 13px; }
        #sf-auth-gate .sf-auth-switch { display: block; margin-top: 16px; color: #087c70; text-align: center; }
      </style>
      <div class="sf-auth-card" role="dialog" aria-modal="true" aria-labelledby="sf-auth-title">
        <form novalidate>
          <h1 id="sf-auth-title">內部系統登入</h1>
          <p>${changing ? '首次登入請先變更密碼。至少 8 個字元，可使用中文；請勿使用常見密碼' : shared ? '請輸入共用密碼以使用 Solution Finder。' : '請使用院內 email 與密碼登入。'}</p>
          ${!changing && !shared ? '<label for="sf-auth-email">院內 email</label><input id="sf-auth-email" name="email" type="email" autocomplete="username" required>' : ''}
          <label for="sf-auth-password">${changing ? '目前密碼' : shared ? '共用密碼' : '密碼'}</label>
          <input id="sf-auth-password" name="password" type="password" autocomplete="current-password" required>
          ${changing ? '<label for="sf-auth-new-password">新密碼</label><input id="sf-auth-new-password" name="new_password" type="password" autocomplete="new-password" required><label for="sf-auth-confirm-password">確認新密碼</label><input id="sf-auth-confirm-password" name="confirm_password" type="password" autocomplete="new-password" required>' : ''}
          <p role="alert" aria-live="polite"></p>
          <button type="submit">${changing ? '變更密碼' : '登入'}</button>
        </form>
        <p class="sf-auth-notice">${notice}</p>
        ${!changing && (shared || sharedEnabled) ? `<a class="sf-auth-switch" href="#">${shared ? '使用個人帳號登入' : '使用共用密碼登入'}</a>` : ''}
      </div>`;
    document.body.append(gate);
    const form = gate.querySelector('form');
    const button = gate.querySelector('button');
    const error = gate.querySelector('[role="alert"]');
    error.textContent = initialError;
    gate.querySelector('input').focus();
    gate.querySelector('.sf-auth-switch')?.addEventListener('click', event => {
      event.preventDefault();
      addGate(shared ? 'personal' : 'shared');
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      error.textContent = '';
      const password = gate.querySelector('#sf-auth-password').value;
      const body = changing ? {
        current_password: password, new_password: gate.querySelector('#sf-auth-new-password').value,
      } : { password, ...(!shared ? { email: gate.querySelector('#sf-auth-email').value } : {}) };
      if (changing && body.new_password !== gate.querySelector('#sf-auth-confirm-password').value) {
        error.textContent = '兩次新密碼不一致';
        return;
      }
      button.disabled = true;
      try {
        const response = await fetch(changing ? '/api/change-password' : '/api/login', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        const data = await response.json();
        if (!response.ok) {
          error.textContent = data.error || '登入失敗，請稍後再試';
          return;
        }
        if (!changing && data.must_change_password === true) addGate('change');
        else window.location.reload();
      } catch {
        error.textContent = unavailable;
      } finally {
        button.disabled = false;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const response = await fetch('/api/session-check', { credentials: 'same-origin' });
      const data = await response.json();
      sharedEnabled = data.shared_login_enabled === true;
      if (response.ok && data.authenticated === true) {
        if (data.must_change_password === true) addGate('change');
      } else addGate('personal', response.status === 401 ? '' : data.error || unavailable);
    } catch {
      addGate('personal', unavailable);
    }
  });
})();
