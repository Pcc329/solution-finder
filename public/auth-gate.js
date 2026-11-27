(() => {
  const notice = '本系統為院內試行服務。登入後，AI 搜尋與查看公司聯絡資訊的使用紀錄（時間、帳號、功能）將被保存，用於服務改善與成本統計，不作其他用途。';
  const unavailable = '登入服務暫時無法使用，請稍後再試';
  let sharedEnabled = false;
  let navSession;

  function addGate(mode = 'personal', initialError = '') {
    document.getElementById('sf-auth-gate')?.remove();
    const gate = document.createElement('div');
    gate.id = 'sf-auth-gate';
    const voluntary = mode === 'change-voluntary';
    const changing = mode === 'change' || voluntary;
    const shared = mode === 'shared';
    const signingUp = mode === 'signup';
    const completed = mode === 'signup-success';
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
        #sf-auth-gate .sf-auth-switch, #sf-auth-gate .sf-auth-signup, #sf-auth-gate .sf-auth-back { display: block; margin-top: 16px; color: #087c70; text-align: center; }${voluntary ? '\n        #sf-auth-gate .sf-auth-cancel { display: block; margin-top: 16px; color: #087c70; text-align: center; }' : ''}
      </style>
      <div class="sf-auth-card" role="dialog" aria-modal="true" aria-labelledby="sf-auth-title">
        ${completed ? '<h1 id="sf-auth-title">內部系統登入</h1><p>申請已送出。請通知系統管理者核准，核准後即可使用此 email 與密碼登入。</p>' : `<form novalidate>
          <h1 id="sf-auth-title">${voluntary ? '變更密碼' : '內部系統登入'}</h1>
          <p>${signingUp ? '請填寫姓名、院內 email（@iii.org.tw 或 @isd4.biz）並自行設定密碼。送出後需由系統管理者核准，核准前無法登入。' : voluntary ? '至少 8 個字元，可使用中文；請勿使用常見密碼' : changing ? '首次登入請先變更密碼。至少 8 個字元，可使用中文；請勿使用常見密碼' : shared ? '請輸入共用密碼以使用 Solution Finder。' : '請使用院內 email 與密碼登入。'}</p>
          ${signingUp ? '<label for="sf-auth-name">姓名</label><input id="sf-auth-name" name="name" type="text" autocomplete="name" required>' : ''}
          ${!changing && !shared ? '<label for="sf-auth-email">院內 email</label><input id="sf-auth-email" name="email" type="email" autocomplete="username" required>' : ''}
          <label for="sf-auth-password">${changing ? '目前密碼' : shared ? '共用密碼' : '密碼'}</label>
          <input id="sf-auth-password" name="password" type="password" autocomplete="${signingUp ? 'new-password' : 'current-password'}" required>
          ${signingUp ? '<label for="sf-auth-confirm-password">確認密碼</label><input id="sf-auth-confirm-password" name="confirm_password" type="password" autocomplete="new-password" required><p>至少 8 個字元，可使用中文；請勿使用常見密碼</p>' : ''}
          ${changing ? '<label for="sf-auth-new-password">新密碼</label><input id="sf-auth-new-password" name="new_password" type="password" autocomplete="new-password" required><label for="sf-auth-confirm-password">確認新密碼</label><input id="sf-auth-confirm-password" name="confirm_password" type="password" autocomplete="new-password" required>' : ''}
          <p role="alert" aria-live="polite"></p>
          <button type="submit">${signingUp ? '送出申請' : changing ? '變更密碼' : '登入'}</button>
        </form>`}
        <p class="sf-auth-notice">${notice}</p>
        ${voluntary ? '<a class="sf-auth-cancel" href="#">取消</a>' : mode === 'personal' ? '<a class="sf-auth-signup" href="#">還沒有帳號？申請帳號</a>' : ''}
        ${signingUp || completed ? '<a class="sf-auth-back" href="#">返回登入</a>' : ''}
        ${!changing && !signingUp && !completed && (shared || sharedEnabled) ? `<a class="sf-auth-switch" href="#">${shared ? '使用個人帳號登入' : '使用共用密碼登入'}</a>` : ''}
      </div>`;
    document.body.append(gate);
    gate.querySelector('.sf-auth-signup')?.addEventListener('click', event => {
      event.preventDefault();
      addGate('signup');
    });
    gate.querySelector('.sf-auth-back')?.addEventListener('click', event => {
      event.preventDefault();
      addGate('personal');
    });
    if (voluntary) gate.querySelector('.sf-auth-cancel').addEventListener('click', event => {
      event.preventDefault();
      gate.remove();
    });
    if (completed) return;
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
      } : signingUp ? { name: gate.querySelector('#sf-auth-name').value, email: gate.querySelector('#sf-auth-email').value, password } : { password, ...(!shared ? { email: gate.querySelector('#sf-auth-email').value } : {}) };
      if (changing && body.new_password !== gate.querySelector('#sf-auth-confirm-password').value) {
        error.textContent = '兩次新密碼不一致';
        return;
      }
      if (signingUp && password !== gate.querySelector('#sf-auth-confirm-password').value) {
        error.textContent = '兩次密碼不一致';
        return;
      }
      button.disabled = true;
      try {
        const response = await fetch(signingUp ? '/api/signup' : changing ? '/api/change-password' : '/api/login', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        const data = await response.json();
        if (!response.ok) {
          error.textContent = data.error || '登入失敗，請稍後再試';
          return;
        }
        if (voluntary) {
          const card = gate.querySelector('.sf-auth-card');
          card.innerHTML = `<h1 id="sf-auth-title">變更密碼</h1><p>密碼已變更。下次登入請使用新密碼。</p><button type="button" class="sf-auth-close">關閉</button><p class="sf-auth-notice">${notice}</p>`;
          card.querySelector('.sf-auth-close').addEventListener('click', () => gate.remove());
        } else if (signingUp) addGate('signup-success');
        else if (!changing && data.must_change_password === true) addGate('change');
        else window.location.reload();
      } catch {
        error.textContent = unavailable;
      } finally {
        button.disabled = false;
      }
    });
  }

  // Floating account menu remains the fallback for pages without navigation.
  function accountMenuMarkup(personal) {
    return `
      <style>
        #sf-account-menu { position: fixed; left: 16px; bottom: 16px; z-index: 150; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft JhengHei", sans-serif; color: #172033; }
        #sf-account-menu .sf-account-toggle { display: grid; place-items: center; box-sizing: border-box; width: 44px; height: 44px; padding: 10px; border: 1px solid #dbe3ea; border-radius: 50%; background: #fff; color: #0b9d8d; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.15); cursor: pointer; }
        #sf-account-menu .sf-account-toggle svg { width: 22px; height: 22px; }
        #sf-account-menu #sf-account-panel { box-sizing: border-box; position: absolute; left: 0; bottom: 54px; width: min(260px, calc(100vw - 32px)); padding: 16px; border: 1px solid #dbe3ea; border-radius: 12px; background: #fff; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18); }
        #sf-account-menu #sf-account-panel[hidden] { display: none; }
        #sf-account-menu .sf-account-label { margin: 0 0 4px; color: #5f6c80; font-size: 12px; }
        #sf-account-menu .sf-account-email { margin: 0; overflow-wrap: anywhere; font-size: 14px; }
        #sf-account-menu hr { margin: 12px 0; border: 0; border-top: 1px solid #dbe3ea; }
        #sf-account-menu [role="menuitem"] { display: block; width: 100%; padding: 10px 8px; border: 0; border-radius: 6px; background: #fff; color: #172033; text-align: left; font: inherit; cursor: pointer; }
        #sf-account-menu [role="menuitem"]:hover { background: #f0fdfa; }
        #sf-account-menu button:focus-visible { outline: 2px solid #0b9d8d; outline-offset: 2px; }
        #sf-account-menu button:disabled { cursor: wait; opacity: 0.7; }
        #sf-account-menu .sf-account-error { margin: 8px 0 0; color: #c2410c; font-size: 13px; overflow-wrap: anywhere; }
        @media print { #sf-account-menu { display: none; } }
      </style>
      <button type="button" class="sf-account-toggle" aria-label="帳號選單" title="帳號選單" aria-haspopup="true" aria-controls="sf-account-panel" aria-expanded="false">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="4"></circle><path d="M4 21v-2a8 8 0 0 1 16 0v2"></path></svg>
      </button>
      <div id="sf-account-panel" role="menu" hidden>
        ${personal ? '<p class="sf-account-label">目前登入</p><p class="sf-account-email"></p><hr><button type="button" role="menuitem" class="sf-account-change">變更密碼</button>' : '<p class="sf-account-label">共用密碼登入中</p>'}
        <button type="button" role="menuitem" class="sf-account-logout">登出</button>
        <p class="sf-account-error" role="alert"></p>
      </div>`;
  }

  let removeAccountListeners;
  function addAccountMenu(session) {
    removeAccountListeners?.();
    document.getElementById('sf-account-menu')?.remove();
    const menu = document.createElement('div');
    menu.id = 'sf-account-menu';
    const personal = session.method === 'user';
    menu.innerHTML = accountMenuMarkup(personal);
    if (personal) menu.querySelector('.sf-account-email').textContent = session.email;
    document.body.append(menu);

    const toggle = menu.querySelector('.sf-account-toggle');
    const panel = menu.querySelector('#sf-account-panel');
    panel.hidden = true;
    const setOpen = open => {
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.addEventListener('click', () => setOpen(panel.hidden));
    const outsideClick = event => {
      if (!panel.hidden && !menu.contains(event.target)) setOpen(false);
    };
    const escape = event => {
      if (!panel.hidden && event.key === 'Escape') {
        setOpen(false);
        toggle.focus();
      }
    };
    document.addEventListener('click', outsideClick);
    document.addEventListener('keydown', escape);
    removeAccountListeners = () => {
      document.removeEventListener('click', outsideClick);
      document.removeEventListener('keydown', escape);
    };
    if (personal) menu.querySelector('.sf-account-change').addEventListener('click', () => {
      setOpen(false);
      addGate('change-voluntary');
    });
    const logout = menu.querySelector('.sf-account-logout');
    const error = menu.querySelector('.sf-account-error');
    logout.addEventListener('click', () => logoutAccount(logout, error));
  }

  async function logoutAccount(logout, error) {
    logout.disabled = true;
    error.textContent = '';
    try {
      const response = await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
      if (!response.ok) throw new Error('logout failed');
      window.location.reload();
    } catch {
      error.textContent = '登出失敗，請稍後再試';
    } finally {
      logout.disabled = false;
    }
  }

  function fillNavAccount(session) {
    const nav = document.getElementById('global-nav');
    const identity = nav?.querySelector('[data-sf-account-identity]');
    const actions = nav?.querySelector('[data-sf-account-actions]');
    const avatar = nav?.querySelector('[data-sf-account-avatar]');
    if (!identity || !actions || !avatar) return false;
    identity.textContent = '';
    actions.textContent = '';
    avatar.textContent = '';
    const personal = session.method === 'user';
    if (personal) {
      const initial = session.email.charAt(0).toUpperCase();
      avatar.textContent = initial;
      identity.innerHTML = '<span class="global-nav-account-photo"></span><div class="global-nav-account-details"><p class="global-nav-account-label">目前登入</p><p class="global-nav-account-email"></p></div>';
      identity.querySelector('.global-nav-account-photo').textContent = initial;
      identity.querySelector('.global-nav-account-email').textContent = session.email;
      const roles = { super: '系統管理者', admin: '管理者', user: '一般使用者' };
      if (Object.hasOwn(roles, session.role)) {
        const role = document.createElement('span');
        role.setAttribute('class', 'global-nav-account-role');
        role.textContent = roles[session.role];
        identity.querySelector('.global-nav-account-details').append(role);
      }
    } else identity.textContent = '共用密碼登入中';
    actions.innerHTML = '<p class="global-nav-section">帳號</p>'
      + (personal ? '<button type="button" class="global-nav-account-change">變更密碼</button>' : '')
      + '<button type="button" class="global-nav-account-logout">登出</button><p class="global-nav-account-error" role="alert"></p>';
    if (personal) actions.querySelector('.global-nav-account-change').addEventListener('click', () => {
      const toggle = nav.querySelector('.global-nav-toggle');
      if (toggle?.getAttribute('aria-expanded') === 'true') toggle.click();
      addGate('change-voluntary');
    });
    const logout = actions.querySelector('.global-nav-account-logout');
    const error = actions.querySelector('.global-nav-account-error');
    logout.addEventListener('click', () => logoutAccount(logout, error));
    return true;
  }

  window.SFAccount = {
    mountNav() {
      if (navSession) fillNavAccount(navSession);
    },
  };

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const response = await fetch('/api/session-check', { credentials: 'same-origin' });
      const data = await response.json();
      sharedEnabled = data.shared_login_enabled === true;
      if (response.ok && data.authenticated === true) {
        if (data.must_change_password === true) addGate('change');
        else if (data.method === 'shared' || (data.method === 'user' && typeof data.email === 'string' && data.email.trim() !== '')) {
          navSession = data;
          if (!fillNavAccount(data) && (document.getElementById('global-nav') || !document.body.querySelector('[data-sf-nav="deferred"]'))) addAccountMenu(data);
        }
      } else addGate('personal', response.status === 401 ? '' : data.error || unavailable);
    } catch {
      addGate('personal', unavailable);
    }
  });
})();
