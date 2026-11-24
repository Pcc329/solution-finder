# SYNC｜歷史重寫後的行為等價測試基準 commit｜2026-11-24

## 結果與範圍

- 工作目錄：`C:\Users\S25036\Documents\Codex\repos\solution-finder`。
- 分支：`codex/fix-test-baseline-hashes-2026-11-24`。
- 基準：`origin/main` = `4410677286d9da73e75de0464ba16884b334809c`；建立分支前工作區乾淨，四個新 hash 均經 `git cat-file -t` 確認為 `commit`。
- 程式僅修改四個測試檔、五處 hash，並在每處上方加入指定格式的歷史重寫註解。斷言與其他程式均未修改。
- 紅燈：417 項，412 通過、5 失敗；綠燈：483 項，483 通過、0 失敗。兩次皆無 skipped、cancelled 或 todo。
- 完整測試包含 `tests/sf-mcp/`。增加的 66 項來自兩個原本在載入階段失敗的測試檔恢復執行。
- PR：建立後補記連結；不 merge。

## Hash 對照

| 測試檔（原行號） | 舊 hash | 新 hash | 依據 |
| --- | --- | --- | --- |
| `tests/company-search.test.mjs:334` | `d392cbc1702e23536227df453ffda22980e4479a` | `ee27d0847e090033ed201ec4c45453e76f57ccae` | PR #259 merge；PR #260 merge-base |
| `tests/contact-access-log.test.mjs:9` | `4d47b89`（完整 `4d47b897f9dfc13f9315dcd12f8802c69332f09c`） | `041f14d9205a67f2eb9893dedfbfd58f10c02e3f` | PR #259 merge-base |
| `tests/supabase-read-equivalence.test.mjs:8` | `a64548bf28fc445211834d970ad119903a8b8df0` | `531d0cb9a9765ca7d0277ee8098bdbfad8415e1f` | PR #204 merge；PR #205 merge-base |
| `tests/sf-mcp/sf-mcp-v1-2.test.mjs:309、336` | `a91e900893fbb68bb0b574c488f38bf9afbe2b9e` | `5757b58410e38855a4019dfc48e0a10fa5b72ccf` | PR #205 merge；PR #256 merge-base |

## 測試與差異檢查

- Node.js `v24.14.1`，npm `11.11.0`。
- MCP 相依套件經 `npm ls --depth=0 --prefix tests/sf-mcp` 核對：`@electric-sql/pglite@0.5.15`、`@modelcontextprotocol/server@2.0.0`、`zod@4.6.5`。repos 已有符合版本的套件，未修改 package.json 或 lockfile。
- 測試以 `node --test --test-reporter=tap` 執行，由 PowerShell 明確列出 `tests/` 的 `.test.mjs`、`.test.cjs` 與 `tests/sf-mcp/` 的 `.test.mjs`，共 23 個測試檔。
- 綠燈 exit code 0；紅燈 exit code 1。
- 加入證據與 SYNC 前，`git diff --stat` 僅四個測試檔，10 insertions、5 deletions。
- 已逐檔移除新增註解並反向替換 hash，比對基準內容，確認其餘內容完全相同。
- 四個程式檔的 `git diff --check` 通過；紅、綠燈 log 的 `git diff --cached --check` 皆通過。

紅燈五項失敗名稱：

1. `14. companies without search action preserves main graph response and reads with private cache policy`
2. `contact-access-log.test.mjs`（載入失敗）
3. `describe topics index/default, all and every section preserve v1.1 except specified edits`
4. `three handlers without capital retain query/body logic`
5. `supabase-read-equivalence.test.mjs`（載入失敗）

五項皆因舊 hash 無法讀取歷史原始碼；未藉由修改斷言或其他程式處理。

## 證據說明

證據目錄：`_handover/evidence/test-baseline-hashes-2026-11-24/`。

### 紅燈 log

- repos 檔案：[red-tests.tap.log](evidence/test-baseline-hashes-2026-11-24/red-tests.tap.log)。
- 原檔：`C:\Users\S25036\OneDrive - 易勝資訊股份有限公司\文件\ChatGPT\產業資料庫\_test_baseline_hashes_validation_2026-11-24\_handover\evidence\test-baseline-hashes-2026-11-24\red-tests.tap.log`。
- 整理前先計算 OneDrive 原檔 SHA-256：`3c6039197423769e13b2404b960a0a96779e2ace0bc0b0de6d4344b25a3aec65`。
- 整理後 repos 版本 SHA-256：`c52b38b02d3177168cc4b514027e94bf55c5533b07b3e081ee0aed062da60d02`。
- 修改行號：423、1681、1705。
- 修改內容：僅移除只含空格行的空格，每行四個空格，共 12 bytes；保留空白行本身、原換行字元及其餘所有內容。
- 整理前確認 repos 複本與 OneDrive 原檔逐位元組相同；整理後逐行及位元組核對，只有指定三行的空格移除，總行數不變。
- 已執行 `git diff --no-index --ignore-space-at-eol <OneDrive原檔> <repos版本>`：exit code 0，無輸出、無差異。
- 整理後再核對 OneDrive 原檔 SHA-256 未變；原檔未修改。
- repos 紅燈 log 的 `git diff --cached --check`：exit code 0。

### 綠燈 log

- 檔案：[green-tests.tap.log](evidence/test-baseline-hashes-2026-11-24/green-tests.tap.log)。
- SHA-256：`ebec1669ae7c0630fd8c8b3a29d767924b525213a4f771746f47233534924623`。
- `git diff --cached --check`：exit code 0，無行尾空白，未整理或改寫。
- 總計 483 tests、483 pass、0 fail、0 skipped、0 cancelled、0 todo。

### OneDrive 獨立 clone

OneDrive 的驗證目錄由本任務以 `git clone --no-checkout` 開始建立，其後透過 `git fetch` 取回 main；具有獨立 `.git`，不是 worktree。該處沒有本任務的未推送 commit，只有未追蹤的紅燈證據。依使用者要求保留目錄，本任務不刪除；PR merge 後由使用者處理。後續修改、綠燈測試、commit、push 均在上述 repos 工作目錄執行。
