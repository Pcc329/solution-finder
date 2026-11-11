# SYNC SF MCP v1.3.1

2026-11-10（Asia/Taipei）

## 交付

- 基底 `main` 的 `3af56bb1ae8a8cda0de794d913bf2d53293f061d`。
- 分支 `feat/sf-mcp-v1.3.1-describe-data`。
- 實作 commit `1ac49cc91e731a937ade2235f82321ffedd383aa`。[一般 PR #305](https://github.com/Pcc329/solution-finder/pull/305)
- `supabase/functions/sf-mcp/index.ts` 第 1、36 行更新版本，第 86、96、131 行更新指南。
- `tests/sf-mcp/sf-mcp-v1-2.test.mjs` 第 292 行更新 `whoami` 版本期望，第 315–317 行在原有 `.replace()` 鏈尾端新增三項對照。

## 指南文字對照

### 第十節匯出指引

修改前

```text
- 需要匯出檔案時，請先在對話中整理成表格，再用你自己的工具輸出；本資料庫連接器唯讀，不能產生檔案。
```

修改後

```text
- 本連接器不提供整批匯出或全庫清單。使用者要求匯出全部或大量資料時，請說明此限制，並建議用條件（來源、類別、縣市、價格）縮小範圍後查詢；確有盤點需求者，請洽資料維護者。少量結果可在對話中整理成表格。
```

### 第五節「需求 → keyword」

修改前

```text
- 碳排放、淨零、ESG → 碳
```

修改後

```text
- 碳排放、淨零、ESG → 碳
- 財會、會計、記帳、帳務、財務報表 → 財務（再以「會計」補搜一次，用方案 id 取聯集）
```

### 第五節「詞 → category」

修改前

```text
- AI開發、資料分析、IoT、研發 → 研發創新
```

修改後

```text
- AI開發、資料分析、IoT、研發 → 研發創新
- 財會、會計、帳務：沒有對應類別（分散在協作辦公、銷售管理、生產物流），請改用 keyword，不要帶 category
```

## 離線驗收

在 `tests/sf-mcp` 執行 `npm test`，退出碼為 0。沿用相同 lockfile 的已安裝套件，版本經 `npm ls --depth=0` 核對。

```text
> node --test sf-mcp-v1-2.test.mjs sf-mcp-v1-3-capital-sql.test.mjs
✔ describe topics index/default, all and every section preserve v1.1 except specified edits (156.4652ms)
ℹ tests 84
ℹ suites 0
ℹ pass 84
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2241.5409
```

- SDK 測試核對 `topic=all` 指南、`topic=lists` 匯出指引、`topic=mapping` 兩行財會對照及 `whoami.server_version=1.3.1`。另確認 `index.ts` 已無兩個舊匯出片語。
- 舊搜尋對照產生器在暫存目錄產生 28 組案例與預期值，退出碼為 0。
- `git diff --check` 通過。實作 commit 的 `git diff --stat` 如下，另加本 SYNC 交接檔。

```text
 supabase/functions/sf-mcp/index.ts | 8 +++++---
 tests/sf-mcp/sf-mcp-v1-2.test.mjs  | 5 ++++-
 2 files changed, 9 insertions(+), 4 deletions(-)
```

## 手動部署

PR 合併後，由 PPC 在 Supabase Dashboard 部署新版 `sf-mcp/index.ts`，沿用現有 Verify JWT 設定。接著在 Claude 用 `whoami` 確認版本為 `1.3.1`，再要求匯出全部正常方案，確認回覆說明限制。正式環境部署及 Claude 驗收待 PPC 執行。
