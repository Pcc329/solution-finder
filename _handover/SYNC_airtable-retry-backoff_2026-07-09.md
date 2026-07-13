# SYNC_airtable-retry-backoff_2026-07-09

## Branch
- `feat-cases-frontend-v1`

## 目標
在 Airtable API 回傳 429 rate limit 時自動重試，降低 20-30 人測試期間因瞬間併發造成的直接失敗。

## 實際改動檔案
- `api/solutions.js`
- `api/companies.js`
- `api/stats.js`
- `api/cases.js`
- `api/ask.js`
- `api/claude.js`

## 實作方式
每個檔案各自新增 `sleep()` 與 `fetchAirtableWithRetry()`，避免新增跨檔 helper 造成部署或 module 型態風險。

重試規則：
- 只重試 Airtable `429`
- 最多重試 3 次
- backoff 固定為 `300ms`, `600ms`, `1200ms`
- 第 4 次仍失敗時，回傳最後一次 Airtable response，交給原本錯誤處理流程
- 429 以外錯誤不重試，直接交給原本錯誤處理流程
- 重試過程使用 `console.error()` 輸出 `[Airtable Rate Limit] retry=...`

## 未改動
- 未修改 API 回傳格式
- 未修改前端
- 未修改 `/api/solutions.js` 核心搜尋/欄位轉換邏輯
- 未新增 cache
- 未把重試次數做成環境變數
- 未改 429 以外錯誤的處理方式

## 驗證
### node --check
- `node --check api/solutions.js`: pass
- `node --check api/companies.js`: pass
- `node --check api/stats.js`: pass
- `node --check api/cases.js`: pass
- `node --check api/ask.js`: pass
- `node --check api/claude.js`: pass

### mock 429 後成功
使用 `api/cases.js`，mock 前 3 次 Airtable response 為 429，第 4 次為 200。
為避免測試耗時，測試過程暫時 mock `setTimeout` 為立即完成；程式碼本身仍保留 300/600/1200ms。

輸出：

```text
calls=4
status=200
[Airtable Rate Limit] retry=1/3 endpoint=/api/cases table=tblgkjVcaohcQntzV waitMs=300 time=2026-07-09T10:09:56.079Z
[Airtable Rate Limit] retry=2/3 endpoint=/api/cases table=tblgkjVcaohcQntzV waitMs=600 time=2026-07-09T10:09:56.080Z
[Airtable Rate Limit] retry=3/3 endpoint=/api/cases table=tblgkjVcaohcQntzV waitMs=1200 time=2026-07-09T10:09:56.093Z
```

判斷：429 會自動重試 3 次，第 4 次成功後回 200。

### mock 429 全部失敗
使用 `api/cases.js`，mock 4 次 Airtable response 都是 429。

輸出：

```text
calls=4
status=500
[Airtable Rate Limit] retry=1/3 endpoint=/api/cases table=tblgkjVcaohcQntzV waitMs=300 time=2026-07-09T10:10:04.087Z
[Airtable Rate Limit] retry=2/3 endpoint=/api/cases table=tblgkjVcaohcQntzV waitMs=600 time=2026-07-09T10:10:04.099Z
[Airtable Rate Limit] retry=3/3 endpoint=/api/cases table=tblgkjVcaohcQntzV waitMs=1200 time=2026-07-09T10:10:04.115Z
[Airtable Error] status=429 endpoint=/api/cases table=tblgkjVcaohcQntzV time=2026-07-09T10:10:04.130Z message=RATE_LIMIT_4
[Airtable Rate Limit] status=429 endpoint=/api/cases table=tblgkjVcaohcQntzV time=2026-07-09T10:10:04.130Z
Cases API error: Error: Airtable error: 429 - RATE_LIMIT_4
```

判斷：最多重試 3 次，第 4 次仍 429 時維持原本錯誤路徑，回 500 並輸出上次建立的 Airtable error log。

## Git / PR
- Branch: `feat-cases-frontend-v1`
- Commit: 本 SYNC 所在 commit 以 `git log -1 --oneline` 為準
- PR 建立頁：`https://github.com/Pcc329/solution-finder/pull/new/feat-cases-frontend-v1`
