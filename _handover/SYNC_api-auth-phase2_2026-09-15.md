# SYNC — API 身分驗證 Phase 2

- 日期：2026-09-15
- 分支：`feat/api-auth-phase2-personal-login-2026-09-15`
- 功能 commits：
  - `63372a71cc504f7804a36e47b6f528a40363f684` — 個人帳號登入、session 身分與登入頁
  - `2a37aaf9e53480bff9e1659d0625897f08f770f0` — 防止已登入公司資料被共享 CDN 快取
- PR：https://github.com/Pcc329/solution-finder/pull/156
- Preview：https://solution-finder-git-feat-api-52a6f8-patrick0814-6136s-projects.vercel.app

## 實際改動檔案與函式

1. `_lib/auth.js`
   - `createSessionValue(expiry, userId, secret)` 改為簽署 `expiry.userId` payload。
   - `verifySession(req)` 驗證三段式 cookie，成功回傳 `{ authenticated: true, userId }`。
   - `requireAuth(req, res)` 維持原本布林對外契約，內部改讀 session 物件的 `authenticated`。

2. `api/auth.js`
   - `login(req, res)` 以 service-role key 從 `users` 查帳號、使用規格指定 scrypt 參數驗證密碼。
   - `sessionCheck(req, res)` 使用 session 的 `userId` 取得 `username`、`display_name`，回傳安全的登入識別資料。
   - 移除所有 `SITE_PASSWORD` 讀取與共用密碼比較邏輯。

3. `public/auth-gate.js`
   - 新增帳號輸入欄位，登入 payload 改為 `{ username, password }`。

4. `api/companies.js`
   - 將 `Cache-Control: s-maxage=300` 改為 `Cache-Control: private, no-store`。
   - 原因：實測發現共享 CDN 快取會讓未帶 cookie 的原始 URL 命中已登入者快取並回 `200`；此修正是達成既有 API 未登入必須 `401` 驗收的必要最小範圍。

## 最終程式碼

### `verifySession`

```js
export function verifySession(req) {
  const secret = process.env.SESSION_SECRET;
  const session = req.cookies?.[SESSION_COOKIE_NAME];
  if (!secret || !session) return false;

  const [expiry, userId, signature, ...extra] = String(session).split('.');
  const expiryNumber = Number(expiry);
  const userIdNumber = Number(userId);
  if (
    extra.length ||
    !Number.isSafeInteger(expiryNumber) ||
    expiryNumber <= Date.now() ||
    !Number.isSafeInteger(userIdNumber) ||
    userIdNumber <= 0 ||
    !/^[a-f0-9]{64}$/i.test(signature || '')
  ) {
    return false;
  }

  const expectedSignature = signSessionPayload(expiry, userId, secret);
  const providedBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return false;
  }

  return { authenticated: true, userId: userIdNumber };
}
```

### `createSessionValue`

```js
export function createSessionValue(expiry, userId, secret) {
  const expiryNumber = Number(expiry);
  const userIdNumber = Number(userId);
  if (
    !Number.isSafeInteger(expiryNumber) ||
    !Number.isSafeInteger(userIdNumber) ||
    userIdNumber <= 0
  ) {
    throw new Error('Invalid session payload');
  }

  return `${expiryNumber}.${userIdNumber}.${signSessionPayload(expiryNumber, userIdNumber, secret)}`;
}
```

### `login`

```js
async function login(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const config = getAuthConfig();
  if (!config) {
    return res.status(500).json({ error: 'Authentication is not configured' });
  }

  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (!USERNAME_PATTERN.test(username) || !password) {
    return res.status(401).json({ error: '帳號或密碼錯誤' });
  }

  try {
    const user = await fetchUser(
      config,
      'username',
      username,
      'id,username,display_name,password_hash,password_salt'
    );
    if (!passwordMatches(password, user)) {
      return res.status(401).json({ error: '帳號或密碼錯誤' });
    }

    const expiry = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
    const session = createSessionValue(expiry, user.id, config.sessionSecret);
    res.setHeader(
      'Set-Cookie',
      `sf_session=${session}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}`
    );
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Authentication login error:', error);
    return res.status(500).json({ error: 'Authentication is temporarily unavailable' });
  }
}
```

## 驗證

### 1. 正確帳密

Preview 實測：

```text
POST /api/login
HTTP 200
{"ok":true}

GET /api/session-check（攜帶 login cookie）
HTTP 200
{"authenticated":true,"username":"patrick","displayName":"Patrick"}

GET /api/companies（攜帶 login cookie）
HTTP 200
```

### 2. 錯誤帳密

Preview 實測未知帳號：

```text
POST /api/login
HTTP 401
{"error":"帳號或密碼錯誤"}
```

此回應和錯誤密碼共用同一個訊息；本地隔離 smoke test 已驗證錯誤密碼同樣得到該 `401` payload。

### 3. 舊 session 與既有 API

- 本地 smoke test 建立 Phase 1 的兩段式 `expiry.signature` cookie，`verifySession` 回傳 `false`。
- Preview 實測不帶 cookie 的 `GET /api/companies`：

```text
HTTP 401
Cache-Control: private, no-store
{"error":"未授權，請先登入"}
```

- `node --check _lib/auth.js`、`node --check api/auth.js`、`node --check public/auth-gate.js`：通過。
- 隔離 smoke test 覆蓋正確帳密、錯誤密碼、session identity、三段式 session 與舊 session 拒絕：通過。

## 驗收確認

- [x] 個人帳號可登入並建立含 userId 的 session。
- [x] 帳號不存在與密碼錯誤均使用 `401 { error: '帳號或密碼錯誤' }`。
- [x] session-check 回傳 `authenticated`、`username`、`displayName`。
- [x] 舊兩段式 session 失效。
- [x] `requireAuth` 的既有使用方式未變；未登入 companies API 已實測為 `401`。
- [x] `SITE_PASSWORD` 不再被登入流程讀取或比對。
- [x] 本次 PR **沒有**對 `users` 表做任何 DDL、RLS 或 policy 異動。
- [~] `users` 的 anon-key 直連 RLS 拒絕：未在本 PR 重測，依需求背景為已由 Claude 建表並驗證的既有前提；本 PR 也沒有使用 anon key 存取 `users`。

## 補充

所有 `users` 查詢僅由 `api/auth.js` 以 `SUPABASE_SERVICE_ROLE_KEY` 從後端發出。前端與 API 回應均不回傳 `password_hash`、`password_salt` 或 service-role key。
