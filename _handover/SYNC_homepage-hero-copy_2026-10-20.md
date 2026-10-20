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
- 本次實際驗證的 Preview commit：`0eee028`（後續提交僅補交接紀錄與截圖，首頁程式碼相同）。
- Vercel 狀態：部署成功（GitHub commit status 的 Vercel check 為 `success`）。
- 部署紀錄：https://vercel.com/patrick0814-6136s-projects/solution-finder/5EaPEX9j1EnqzsgrYrQhi9ETtnFW
- Preview：https://solution-finder-git-feat-home-fc784c-patrick0814-6136s-projects.vercel.app/
- 檢查時間：2026-10-20 約 13:38（Asia/Taipei）。使用者完成共用密碼登入後，重新載入 Preview 並等待資料載入完成。
- 首頁實際標題：「資服產業資料庫」。
- 首頁實際說明：「收錄 2,268 筆數位轉型方案與 1,102 家資服業者」。
- 實際方案數：**2,268**；實際業者數：**1,102**。數字來自已登入 Preview 的實際畫面，會隨資料庫更新而改變。
- 桌機與 375px 寬度下，兩個數字皆顯示相同的 `text-slate-900 font-bold` 樣式；桌機實際 computed style 為 `color: rgb(15, 23, 42)`、`font-weight: 700`。
- 桌機：截圖尺寸 **1265 × 545**；頁面內容寬度與 scrollWidth 皆為 1265，無水平溢位。
- 手機：截圖尺寸 **375 × 813**；確認頁面 `documentElement.clientWidth` 與 `scrollWidth` 皆為 **375**，無水平溢位，說明文字正常換行。Windows 瀏覽器保留捲軸空間，因此使用尺寸控制值 390 才取得實際 375px 內容與截圖；未縮放或編輯截圖內容。
- 擷取完成後已還原臨時瀏覽器尺寸設定。

### 桌機截圖

![桌機首頁：收錄 2,268 筆數位轉型方案與 1,102 家資服業者](evidence/homepage-hero-copy-20261020/desktop.jpg)

### 375px 截圖

![375px 首頁：收錄 2,268 筆數位轉型方案與 1,102 家資服業者](evidence/homepage-hero-copy-20261020/mobile-375.jpg)

## 已完成檢查

- 完整 JSX 經 Babel classic React preset 編譯成功。
- 兩個數字的 span 樣式均為 `text-slate-900 font-bold`。
- 千分位、零值、stats 未載入／失敗與缺少業者數時的「—」顯示檢查通過。
- 已登入 Preview 的桌機與 375px 實際數字、樣式及文字換行驗證通過，附上原始瀏覽器截圖。
- `git diff --check` 通過。
