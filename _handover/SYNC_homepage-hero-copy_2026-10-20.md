# 首頁標題區文字調整

- PR：https://github.com/Pcc329/solution-finder/pull/265
- 分支：`feat/homepage-hero-copy`；沿用同一個 PR，不合併。
- 分支起點：`origin/main`，`764d263604cf5e5465322af4d6639ed2d4d6bde6`。

## 修改內容

- 標題只保留「資服產業資料庫」，移除綠色副標及其 `<br />`、`span`。
- 說明改為「收錄 {方案數} 筆數位轉型方案與 {業者數} 家資服業者」。
- 方案數沿用 `allData.length`；業者數讀取既有 `/api/stats` 的 `companyTotal`。
- 兩個數字皆套用 `<span className="text-slate-900 font-bold">`，保留千分位格式。
- stats 尚未載入或取得失敗時，業者數維持顯示「—」。
- 未調整現有版面與樣式設定，未修改 API。

## 與規格不同之處及理由

原任務指定「只改文字」，實作另外在既有統計載入流程中讀取並保存 `companyTotal`，以支援動態業者數，而非僅替換字串。方案數仍沿用原本的 `allData.length`；業者數採用 `/api/stats.companyTotal`，代表完整公司資料庫的業者數，不從方案清單去重推算有方案的公司數。理由是完整業者數與「查公司」搜尋範圍、儀表板公司數一致，也能計入沒有方案的業者。此做法已於 PR #265 本次審查獲使用者同意保留。

原交接檔曾放在 repo 外；依本次審查要求，已移入 repo 的本路徑並納入 commit。後續任何偏離規格的做法，均須在 SYNC 與完成回報中主動說明差異及理由。

## Preview 驗證

- 樣式修正 commit：`33c1f8a081e5ea247d1c530487d3ecd4bd010b37`。
- Vercel 狀態：部署成功（GitHub commit status 的 Vercel check 為 `success`）。
- 部署紀錄：https://vercel.com/patrick0814-6136s-projects/solution-finder/Cu8cm14GigpLwF2utXes7bZYrkLt
- Preview：https://solution-finder-git-feat-home-fc784c-patrick0814-6136s-projects.vercel.app/
- 檢查日期：2026-10-20（Asia/Taipei）。
- 實際瀏覽結果：Preview 顯示「內部系統登入」，資料 API 回傳 `401`，需先完成共用密碼登入。
- 首頁實際方案數、業者數與桌機／375px 截圖：尚未完成；已請使用者在 Preview 分頁登入，完成後才能據實記錄。未將未登入時的初始值或測試資料當成正式數字。

## 已完成檢查

- 完整 JSX 經 Babel classic React preset 編譯成功。
- 兩個數字的 span 樣式均為 `text-slate-900 font-bold`。
- 千分位、零值、stats 未載入／失敗與缺少業者數時的「—」顯示檢查通過。
- `git diff --check` 通過。
