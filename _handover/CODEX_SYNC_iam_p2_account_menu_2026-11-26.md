# IAM P2.2 帳號選單交付紀錄

日期：2026-11-26（Asia/Taipei）

## PR 與基準

- PR：[PR #322](https://github.com/Pcc329/solution-finder/pull/322)，open、未 merge。
- Base：`feat/iam-p2-personal-login-2026-11-25`（疊在 #319 上）。
- Head：`feat/iam-p2-account-menu-2026-11-26`。
- 開始前已在指定目錄 `C:/Users/S25036/Documents/Codex/repos/solution-finder` 執行 `git fetch origin`；遠端 base HEAD 確認為 `ed95ac35626d72483c00c0c94787580f09e25bde`，之後才建新分支。
- 最後一筆實作、測試及證據 commit SHA：`1975aa997481cc0755f758a33baa88b233de5839`。
- 後續僅補記本 SYNC 的文件 commit 不改實作或測試；最終交付 HEAD 的完整 SHA 記錄於 PR 描述與交付回覆，亦可由 [PR commits](https://github.com/Pcc329/solution-finder/pull/322/commits) 核對。Git 文件無法包含其自身 commit 的 SHA。

## 完成內容

- 僅在通過 session-check 的個人帳號（有效 email）或共用密碼 session 建立帳號選單；建立選單沒有額外請求。不適用身份不建立選單。
- 左下角 44×44 圓形按鈕，left/bottom 16px、z-index 150；樣式限於 `#sf-account-menu`，列印隱藏。位置樣式與選單操作函式分開，供後續移到統一導覽列。
- 個人版顯示 email、變更密碼、登出；email 以 textContent 寫入。共用版只有登入狀態與登出。
- 面板支援切換、點外部關閉、Escape 關閉及焦點返回；重建時移除舊元素與舊 document 監聽器。
- 登出 POST 不帶 body，成功 reload；失敗固定文字、不 reload、恢復按鈕。
- 主動改密碼可取消；成功顯示「密碼已變更。下次登入請使用新密碼。」與關閉按鈕，不 reload。完整使用紀錄告知保留。
- 強制改密碼維持不可取消與成功 reload；VM 輸出的完整 HTML 與基準逐位元組一致。

## 測試與證據

- Node v24.14.1。明確列出 tests/ 內 .test.mjs、.test.cjs，以及 tests/sf-mcp/ 內 .test.mjs，使用 `node --test --test-reporter=tap <完整檔案清單>`。
- 修改前：26 檔，694 tests / 694 pass，exit 0。
- 修改後：27 檔，724 tests / 724 pass，exit 0；新增 30 項獨立 VM 測試。
- 前後 fail、cancelled、skipped、todo 均為 0。既有測試零變更。
- 新測試涵蓋身份分支、email HTML 字元、面板開關與焦點、監聽器生命週期、登出成功/失敗、主動改密碼取消/驗證/成功/錯誤、強制改密碼及靜態樣式守門。
- 既有禁區檔案、requireAuth 呼叫、API 數量、路由等守門全數通過。另逐檔核對 88 個受保護檔案的 LF 內容不變：API、_lib、既有測試、HTML、vercel.json、migrations 與 supabase/functions 等；API 檔案數仍為 12。
- 完整執行命令、清單、摘要：`_handover/evidence/iam-p2-account-menu-2026-11-26/baseline-verification.json`、`final-verification.json`。
- 強制改密碼 HTML 比對：`forced-change-parity.json`；兩者 2806 bytes，SHA-256 均為 `6a579cb8ea8922ab057938ad1d4dd07e6447601895710c7340213c0b18639382`。
- 範圍與受保護檔案 SHA-256：`scope-verification.json`。

### 完整 log 的 SHA-256（LF）

| Log | SHA-256 |
| --- | --- |
| baseline.tap.log | d704653247c8c78c77aa6b62a47c55feaff009139f88a1f2a1ce561b8e47d55c |
| final.tap.log | 61ad9450d2a56b67a47d9a31a2e376df814ee302977b3f6d5f2a06f1c95eeba3 |

兩份 log 位於 `_handover/evidence/iam-p2-account-menu-2026-11-26/`。
方法：Python subprocess 擷取 Node stdout/stderr 原始 bytes，依 stdout + stderr 串接，僅以 bytes.replace 將 CRLF 正規化成 LF，再用 hashlib.sha256 計算；不經 PowerShell 文字管線轉碼，沒有刪改 log 內容。JSON 使用 UTF-8 並指定 `newline='\n'`。log 無行尾空白，且已透過 `git show HEAD:<path>` 的原始 blob bytes 核對 LF 與雜湊。

## 完整變更檔案

命令：`git diff --name-only ed95ac35626d72483c00c0c94787580f09e25bde..HEAD`

```text
_handover/CODEX_SYNC_iam_p2_account_menu_2026-11-26.md
_handover/evidence/iam-p2-account-menu-2026-11-26/baseline-verification.json
_handover/evidence/iam-p2-account-menu-2026-11-26/baseline.tap.log
_handover/evidence/iam-p2-account-menu-2026-11-26/final-verification.json
_handover/evidence/iam-p2-account-menu-2026-11-26/final.tap.log
_handover/evidence/iam-p2-account-menu-2026-11-26/forced-change-parity.json
_handover/evidence/iam-p2-account-menu-2026-11-26/scope-verification.json
public/auth-gate.js
tests/iam-p2-account-menu.test.mjs
```

除了 public/auth-gate.js、新測試與 _handover/ 之外沒有修改；未推送 main 或 #319 分支，未 merge。

## Preview 驗收

依規格第五節由 PPC 在 Preview 使用指定拋棄式測試帳號進行申請/核准、三頁操作、真實改密碼/登出、比較列遮擋及手機尺寸驗收，測後刪除帳號。本次只做 synthetic VM 與既有完整測試，未建立、核准或刪除真實帳號，未連線正式 Supabase、Vercel、Anthropic，未讀取或印出真實金鑰。此處不宣稱 Preview 驗收已完成。

## 已知限制

- session 為無狀態 cookie（7 天）。登出只清除當前瀏覽器的 cookie；主動改密碼不會讓其他裝置上已登入的 session 失效。需要立即踢除時，以停權（is_active = false）處理，最多 60 秒生效。
- 浮動按鈕會被首頁比較列遮住，這是 M2 刻意設計。

## 規格外發現與處理界線

- `public/auth-gate.js:91`：現況為先解析 response.json，再處理成功或錯誤。`tests/iam-p2-account-menu.test.mjs:248` 使用 200 `{ok:true}` 驗證主動改密碼成功；`api/auth.js:225` 的成功回應固定為 200 `{ok:true}`。
- 原曾自行推論可能出現 204 空回應，建議成功分支略過 JSON 並增加 204 測試；這不是測試失敗。提出時受影響測試為 118/118 通過，修改後完整測試尚未執行。使用者已明確否決此延伸，該命令未獲執行、沒有套用；本交付保留 200 JSON 處理，沒有新增 204 主動改密碼分支或測試。今後未涵蓋且影響目標的情況依第七節第 7 點先列檔案、行號、現況與建議，等待確認。
- 本次沒有其他需要變更程式的規格外發現。
