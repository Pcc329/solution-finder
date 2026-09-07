# SYNC: Feedback 端點速率限制

日期：2026-09-07

## 改動範圍

- 僅修改 `api/feedback.js`。
- 新增 module-level `rateLimitMap`，以 IP 做單一 Serverless 執行個體內的計數。
- 規則：60 秒視窗內最多 3 次 POST；第 4 次回傳 HTTP 429 與 `提交過於頻繁，請稍後再試`。
- IP 優先取 `x-forwarded-for` 第一個值，其次取 `req.socket.remoteAddress`，最後使用 `unknown`。
- 沒有新增身分驗證、沒有修改欄位驗證函式、Airtable 寫入或 retry 邏輯。

## 驗證

- `node --check api/feedback.js`：通過。
- `git diff --check`：通過。
- 使用同一個 `x-forwarded-for: 203.0.113.10`、mock Airtable 成功回應連續呼叫：
  1. 第 1 次：200 `{ ok: true }`
  2. 第 2 次：200 `{ ok: true }`
  3. 第 3 次：200 `{ ok: true }`
  4. 第 4 次：429 `{ error: '提交過於頻繁，請稍後再試' }`
  5. 將模擬時間推進 60,001 ms 後：200 `{ ok: true }`
- mock fetch 共呼叫 4 次，確認第 4 次被限制時未執行 Airtable 寫入。

## 限制說明

此為記憶體內、單一 Vercel Serverless 執行個體有效的簡易防護；不同執行個體不共享計數。未新增跨執行個體儲存或身分驗證。

## Git

- Branch：`feedback-rate-limit-2026-09-07`
- Commit：`279a3f2 fix(security): rate limit feedback submissions`
- PR：https://github.com/Pcc329/solution-finder/pull/146
