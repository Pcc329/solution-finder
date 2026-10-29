# 測試預覽網域 fixture 清理（2026-10-29）

- Repo：Pcc329/solution-finder。
- 基底：本次 fetch 取得的最新 `origin/main`，`87062e3`（PR #297）。
- 分支：`codex/test-fixture-cleanup`；核准推送後建立獨立 PR，base 為 `main`。
- 目前狀態：等待使用者核准，尚未推送或建立 PR。

## 變更與測試意義

僅將 `tests/platform-overview.test.mjs` 的兩個預覽來源改為虛構部署及團隊名稱：

- 一般部署：`https://solution-finder-xxx-example-team.vercel.app`。
- git 分支別名：`https://solution-finder-git-example-example-team.vercel.app`。

兩者仍共用原有測試：一般請求與 login/data 的 OPTIONS 預檢都必須回傳 403，
沒有 `Access-Control-Allow-Origin`，回傳既有拒絕訊息，且不得讀取 secrets 或查詢資料。
正式來源的允許斷言及預覽來源附加惡意網域的拒絕案例均保留。
未修改 Edge Function、API、前端或正式程式邏輯。

## 搜尋統計（修改前的 main 快照）

搜尋項目：Vercel 帳戶名稱。

共 50 檔、94 行；測試 2 行已替換，其餘 49 個歷史文件保留原網址。

完整檔案與行號清單存於 repo 外的 `../_test-fixture-cleanup-validation/account-file-lines-main.md`，不納入 PR。

## 驗證

環境：Node.js v24.14.1、npm 11.11.0。
MCP 測試依賴以 `npm ci --ignore-scripts --no-audit --no-fund` 安裝，使用既有 lockfile。

| 指令／檢查 | 結果 |
| --- | --- |
| `node --test --test-reporter=spec tests/*.test.mjs tests/*.test.cjs tests/sf-mcp/*.test.mjs` | 287 tests、287 pass、0 fail、0 skipped、0 cancelled |
| 在 repo 外執行 `node <repo>/tests/sf-mcp/sf_search_parity_gen_test.js` | exit 0，產生 28 個案例；僅 smoke check，未執行 SQL |
| `node --check tests/sf-mcp/sf_search_parity_gen_test.js` | exit 0 |
| `git diff --cached --check`（含本文件） | 通過 |
| 正式程式檔案差異 | 無；只有本文件及測試 fixture 變更 |

完整測試輸出與產生器輸出存於工作區旁的 `_test-fixture-cleanup-validation/`，不納入 PR。
