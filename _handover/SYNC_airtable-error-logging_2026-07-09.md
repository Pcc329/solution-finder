# SYNC_airtable-error-logging_2026-07-09

## Branch
- `feat-cases-frontend-v1`

## 目標
補強會呼叫 Airtable API 的 Serverless Function 錯誤記錄，讓 Vercel Logs 能用 Error 等級與 `Rate Limit` 關鍵字追蹤 Airtable 非 200 回應，特別是 429 rate limit。

## 現況盤點
- `api/solutions.js`
  - 會呼叫 Airtable：`Solutions`、`Companies`
  - 原本處理：`response.ok` false 時讀 body 並 `throw new Error(...)`
  - 原本不足：沒有在 Airtable 非 200 當下輸出含 endpoint/time/table 的 `console.error()`；429 沒有專用 `Rate Limit` 關鍵字
- `api/companies.js`
  - 會呼叫 Airtable：`Companies`、`Solutions`
  - 原本處理：`response.ok` false 時讀 body 並 `throw new Error(...)`
  - 原本不足：同上
- `api/stats.js`
  - 會呼叫 Airtable：`Solutions`、`Companies`
  - 原本處理：`response.ok` false 時讀 body 並 `throw new Error(...)`
  - 原本不足：同上
- `api/cases.js`
  - 會呼叫 Airtable：`tblgkjVcaohcQntzV`
  - 原本處理：`response.ok` false 時讀 body 並 `throw new Error(...)`
  - 原本不足：同上
- `api/ask.js`
  - 會呼叫 Airtable：`Ask_Logs` (`tblvnoz1WHtXBzAqA`)
  - 原本處理：log 寫入失敗時 `console.error('Log write failed:', status, body)`，並吞錯，不影響主流程
  - 原本不足：log 格式沒有 endpoint/time/table；429 沒有專用 `Rate Limit` 關鍵字
- `api/claude.js`
  - 會呼叫 Airtable：`Search_Logs` (`tblLdVCmLwkzDFtMq`)
  - 原本處理：log 寫入失敗時 `console.error('Log write failed:', status, body)`，並吞錯，不影響主流程
  - 原本不足：同上

## 實際改動
- `api/solutions.js`
- `api/companies.js`
- `api/stats.js`
- `api/cases.js`
  - 新增本地 `logAirtableError(table, status, body)`
  - 在 `throw new Error(...)` 前先輸出：
    - `[Airtable Error] status=... endpoint=... table=... time=... message=...`
    - 若 `status === 429`，額外輸出 `[Airtable Rate Limit] ...`
- `api/ask.js`
- `api/claude.js`
  - 保留原本 log 寫入錯誤不影響主流程的行為
  - 將非 OK log 改為相同格式，並補上 429 `Rate Limit` 行

## 未改動
- 未修改 `/api/solutions.js` 核心搜尋/轉換欄位邏輯
- 未修改任何 API 回傳格式
- 未新增 retry
- 未修改前端 HTML / Babel script tag
- 未修改 fallback 行為；原本 throw 的仍 throw，原本 log 寫入失敗吞錯的仍吞錯

## 本地驗證
### 語法檢查
- `node --check api/solutions.js`: pass
- `node --check api/companies.js`: pass
- `node --check api/stats.js`: pass
- `node --check api/cases.js`: pass
- `node --check api/ask.js`: pass
- `node --check api/claude.js`: pass

### 429 mock 驗證
使用 Node mock `global.fetch`，讓 `api/cases.js` 收到 Airtable 429。

輸出：

```text
[Airtable Error] status=429 endpoint=/api/cases table=tblgkjVcaohcQntzV time=2026-07-09T09:49:55.061Z message=RATE_LIMIT_REACHED
[Airtable Rate Limit] status=429 endpoint=/api/cases table=tblgkjVcaohcQntzV time=2026-07-09T09:49:55.061Z
Cases API error: Error: Airtable error: 429 - RATE_LIMIT_REACHED
status=500
```

判斷：
- Error log 包含狀態碼、API 路徑、table、時間、Airtable body
- 429 額外有 `Airtable Rate Limit` 關鍵字
- API 回傳行為維持原本錯誤路徑：`status=500`

## Vercel Logs 驗證
- 尚未取得 Vercel UI 截圖。
- 原因：此本機環境無法直接操作 Vercel 專案 logs UI；目前只完成本地 mock 驗證。
- PR Preview / Vercel 部署後，可用錯誤 token 或錯誤 table ID 暫測一次，確認 Error filter 內可搜尋：
  - `[Airtable Error]`
  - `[Airtable Rate Limit]`
  - `status=429`

## Git / PR
- Branch: `feat-cases-frontend-v1`
- Commit: 本 SYNC 所在 commit 以 `git log -1 --oneline` 為準
- PR 建立頁：`https://github.com/Pcc329/solution-finder/pull/new/feat-cases-frontend-v1`
