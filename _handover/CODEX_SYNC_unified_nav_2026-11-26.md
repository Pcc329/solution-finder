# 統一選單與首頁問答底色交付紀錄

日期：2026-11-26（Asia/Taipei）

## PR 與基準

- PR：[PR #323](https://github.com/Pcc329/solution-finder/pull/323)，open、未 merge。
- Base：`feat/iam-p2-personal-login-2026-11-25`，疊在 PR #319 上。
- Head：`feat/unified-nav-2026-11-26`。
- 工作目錄：規格指定的工作目錄。沒有另建 clone。
- 建立分支前先執行 `git fetch origin`，確認 `origin/feat/iam-p2-personal-login-2026-11-25` 為 `0ca5a46d0dd4ce5fd96564f5fe56189465cb25f6`，符合第七節第 5 點，之後才從該遠端 ref 建立分支。
- 最後一筆實作、測試與證據 commit SHA：`faef012ce0641cd7b7fb699b94bbc02b8c225382`。
- 後續只補入本 SYNC 的文件 commit，不改實作、測試或證據。最終交付 HEAD 的完整 SHA 記錄於 PR 描述及交付回覆，亦可由 [PR commits](https://github.com/Pcc329/solution-finder/pull/323/commits) 核對。Git 文件無法包含其自身 commit 的 SHA。

## 完成內容

- 七頁（index、sources、dashboard、manufacturing、compare、strategy-guide、diagnosis）使用漢堡＋頭像入口，選單依序為帳號資訊、功能區的四個連結、帳號操作。
- 保持三個空佔位元素，無 hidden 屬性；由 `fillNavAccount(session)` 先清空再填入。email、頭像字元與角色文字透過 textContent 寫入，未知角色不顯示標籤。
- 角色：super → 系統管理者、admin → 管理者、user → 一般使用者。共用密碼只有登入狀態與登出，沒有頭像或變更密碼。
- 公開物件只有 `window.SFAccount.mountNav()`。首頁 root 的 deferred 標記與 GlobalNav 的掛載 useEffect，支援 React 先渲染與 session 先到達；沒有使用輪詢或 MutationObserver。
- 有完整導覽列時不建立浮動按鈕；舊導覽列缺任一佔位元素、或沒有導覽列且沒有 deferred 標記時，沿用浮動備援。feedback.html 未修改。
- 變更密碼在選單開啟時先透過 toggle.click() 關閉，再沿用主動變更密碼視窗。
- 導覽列與浮動選單共用 `logoutAccount(logout, error)`；原始碼只有一個 logout fetch。POST、same-origin、無 body、成功 reload、失敗固定錯誤文字及恢復按鈕的行為不變。
- theme.css 只追加以 #global-nav 開頭的規則；既有色彩 token、各頁既有導覽列 CSS、定位與開關邏輯均不改。
- 首頁三組問答分別加上 home-demo-block 與第一個子元素「問答 1／2／3」；新增指定的 Tiffany 淡色底、邊框、圓角與 768px padding 規則。既有問答內容、計算、按鈕與第一組 visibility／aria-hidden 保持不變。

## 測試與證據

- Node v24.14.1；明確列出 tests/ 的 .test.mjs／.test.cjs 與 tests/sf-mcp/ 的 .test.mjs，使用 `node --test --test-reporter=tap <完整檔名清單>`。
- 修改前：27 檔，724 tests / 724 pass，exit 0。
- 修改後：28 檔，760 tests / 760 pass，exit 0。
- 新增 tests/unified-nav.test.mjs 的 36 項測試；兩次完整執行的 fail、cancelled、skipped、todo 均為 0。
- tests/iam-p2-account-menu.test.mjs 的原有 30 項零修改通過。其他既有測試也未修改，只有規格允許的 global-nav.test.mjs 改寫。
- 新測試涵蓋個人／共用登入、角色、HTML 字元、拒絕建立 UI 的身份、三種缺佔位元素的備援、無導覽列備援、React／session 先後順序、重複掛載與重建、改密碼關閉／取消、登出成功／500／網路錯誤與重試、無輪詢、唯一 logout fetch、首頁區塊與樣式。
- 完整命令、檔案清單、摘要及 log 雜湊在 `baseline-verification.json`、`final-verification.json`。
- `scope-verification.json` 核對 83 個受保護檔案的 LF bytes 與基準精確相同，包含 api/、_lib/、既有測試（global-nav 除外）、feedback.html、global-nav.js、vercel.json、AGENTS.md、migrations/、supabase/。
- 六個靜態頁面 nav 以外的文字內容保持不變；index 除允許修改項目外不變；auth-gate 的登入／改密碼表單與浮動選單標記不變。
- 受保護檔案原有 Windows CRLF／混合換行不作磁碟正規化。證據分別保存工作樹原始 bytes SHA-256、基準 Git blob SHA-256、LF bytes SHA-256 與原始 bytes 是否相同；LF 比對與原始 bytes 比對分開記錄。
- git diff --check 通過。未修改 API、路由、資料庫或既有測試來放寬驗證。

### global-nav.test.mjs 斷言對照

| 項目 | 修改前 | 修改後 |
| --- | --- | --- |
| 按鈕 | 文字為「更多功能」 | type=button、aria-label=選單、controls／expanded 維持；含 aria-hidden SVG 與空頭像；沒有舊文字 |
| 選單 | hidden 起始、三個連結 | hidden 起始；第一個為空 identity、最後為空 actions；含「功能」小標與四個依序連結 |
| 連結 | 資料來源、知識庫、方案探索 | 首頁搜尋、資料來源、知識庫、方案探索 |
| aria-current | 三個目的頁標記自己 | 維持；首頁搜尋一律不標記 |
| script | index 不載入 global-nav.js，其餘六頁載入 | 不變 |
| 其他 | 選單外沒有 global-nav-link，沒有 active class | 保留 |

### Log SHA-256（LF）

| Log | SHA-256 |
| --- | --- |
| baseline.tap.log | `3513dc386c14d8f52d3f7e12c774258f459e2a4ecc72df939c66f8e3ab6a1721` |
| final.tap.log | `5095af683a6042af0bdf3ac06f70fbd35f097c4b9062a8d01184507f4c28e314` |

位置：`_handover/evidence/unified-nav-2026-11-26/`。

方法：PowerShell 擷取 Node stdout/stderr，逐行 TrimEnd 移除行尾空白，再以 LF 串接並加上最後換行，以 UTF-8 無 BOM 寫入；Get-FileHash SHA256 計算後，再以 Python hashlib.sha256 讀取檔案原始 bytes 核對。log 為 LF、無行尾空白。驗證 JSON 最後均由 Python 以 UTF-8、newline='\n' 寫入。保留原始 Node module-type 警告文字，不因警告改動任何檔案。

## 完整變更檔案

命令：`git diff --name-only 0ca5a46d0dd4ce5fd96564f5fe56189465cb25f6..HEAD`

```text
_handover/CODEX_SYNC_unified_nav_2026-11-26.md
_handover/evidence/unified-nav-2026-11-26/baseline-verification.json
_handover/evidence/unified-nav-2026-11-26/baseline.tap.log
_handover/evidence/unified-nav-2026-11-26/final-verification.json
_handover/evidence/unified-nav-2026-11-26/final.tap.log
_handover/evidence/unified-nav-2026-11-26/scope-verification.json
public/auth-gate.js
public/compare.html
public/dashboard.html
public/diagnosis.html
public/index.html
public/manufacturing.html
public/sources.html
public/strategy-guide.html
public/theme.css
tests/global-nav.test.mjs
tests/unified-nav.test.mjs
```

此清單在加入本文件的 commit 後以實際命令核對。所有變更均屬規格第二節允許檔案或 _handover/。只推送新分支，沒有推送 main 或 #319 分支，沒有 merge。

## Preview 驗收

由 PPC 依規格第五節在 Preview 使用自己的帳號核對七頁導覽、四個功能連結、點外部／Esc 關閉、首頁切頁後帳號內容、變更密碼取消、feedback 備援、三組問答底色與手機 email 換行。本次僅執行 synthetic VM 與完整測試，未連線正式 Supabase、Vercel、Anthropic，未讀取或印出真實金鑰，未執行真實帳號登出或變更密碼；不宣稱 Preview 實測已完成。

## 規格外發現

- 本次沒有需要延伸修改程式的規格外發現。
- 既有 Windows checkout 換行差異與 Node module-type 警告僅記錄於驗證證據，沒有修改受保護檔案、package 設定或擴大本任務範圍。
