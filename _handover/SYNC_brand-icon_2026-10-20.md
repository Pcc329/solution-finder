# 網站品牌圖示與瀏覽器分頁圖示

- PR：https://github.com/Pcc329/solution-finder/pull/291
- 分支：`feat/brand-icon`；PR 已建立，未合併，未啟用自動合併。
- 起點：於 2026-10-20 重新 fetch 的最新 `origin/main`，`f868c046391b8e4a1614d1cde478b659ab15c64a`。
- 程式碼提交：`4856fd7d9c5daa6062217667b3e3afc53528a105`。
- 狀態：程式碼及檔案驗證完成；實際 Preview 截圖待使用者手動登入及瀏覽器視窗截圖權限。

## 修改內容與行號

所有頁面的 favicon 連結位於第 4 行，Apple touch icon 連結位於第 5 行。

| 頁面 | head 新增行號 | 背景改 transparent 行號 | 品牌 img 行號 |
| --- | --- | --- | --- |
| `public/compare.html` | 4–5 | 51 | 318 |
| `public/dashboard.html` | 4–5 | 54 | 1288 |
| `public/diagnosis.html` | 4–5 | 19 | 59 |
| `public/feedback.html` | 4–5 | 無 | 無 |
| `public/index.html` | 4–5 | 31 | 2150 |
| `public/manufacturing.html` | 4–5 | 22 | 427 |
| `public/sources.html` | 4–5 | 55 | 543 |
| `public/strategy-guide.html` | 4–5 | 81 | 648 |

- 7 個既有 `.global-nav-logo` 的 emoji 替換為 `/brand/logo-mark.svg`；圖片的 alt 為空，width 與 height 皆為 36。
- index.html 使用 JSX 自閉合 img；保留原有 React UMD、Babel script 標籤及 classic runtime。
- 原有容器寬高 36px 與圓角 8px 保留，只將背景改為 transparent。
- feedback.html 沒有 global-nav 或 global-nav-logo；既有結構是 `main > header`（本次修改後第 126–130 行），內含 `p.kicker`「SOLUTION FINDER」、`h1`「內部測試回饋」與 `p.subtitle`「產業策略智庫 小規模試行」。本次僅新增 head 圖示連結，未硬加 logo 或導覽列。
- 未修改其他顏色、按鈕、版面、API 或 vercel.json。diagnosis.html 既有部署重新導向 manufacturing.html 的行為保留。

## 圖示檔案與 SHA-256

| 檔案 | 完整 SHA-256 | 指定前 16 碼 |
| --- | --- | --- |
| `public/brand/logo-mark.svg` | `8f3a7361525ea36c0207a15283a5c85653165184469550d9a6ad6d9791e380fd` | 符合 |
| `public/favicon.svg` | `dff88c4cf89c0b7b525efc28f798e0ff815a98fbadb59755bee930272a669658` | 符合 |
| `public/apple-touch-icon.png` | `319bc938af8447f776b179cd0b86386723f33bebdd637eb27a03b203c5a73a20` | 符合 |

### 附件位元組差異及處理

使用者提供的 Chrome下載資料夾中三個原始檔案含額外 C2PA 來源中繼資料，原始 SHA-256 前 16 碼分別為 `49e9b789b9ed4a52`、`069ba4bf475c0a0a`、`aeb9230b8897e5b2`，與任務指定值不同。180×180 的剪貼簿附件與同資料夾 apple-touch-icon.png 原始位元組相同；620×280 的附件是多尺寸／深淺背景預覽圖，未作為網站資產。

為符合使用者明確指定的驗收雜湊，兩個 SVG 只移除根節點的 `xmlns:c2pa` 屬性與 `<metadata>...</metadata>`，PNG 只移除 `caBX` chunk，其他原始位元組保持不變。三個輸出雜湊因此全部精確符合指定前綴。沒有重新繪製、重編碼、調色或縮放。此處理代表交付檔案符合指定雜湊，但不與含額外中繼資料的下載附件逐位元組相同；差異在此明列。

## 已完成驗證

- 工作目錄檔案、Git 提交 blob、Vercel Preview 實際下載的三個檔案皆有相同完整 SHA-256，符合指定前 16 碼。
- Preview 三個資產皆 HTTP 200；兩個 SVG 為 image/svg+xml，PNG 為 image/png。
- 8 個頁面逐一比對 origin/main：扣除本次新增的兩個 link、7 個品牌圖示替換與7 處背景修改，其餘內容完全一致。
- 首頁完整 JSX 使用 Babel classic React preset 編譯成功。
- `git diff --check` 通過。
- Vercel 部署頁顯示 Ready，程式碼提交為 4856fd7，部署完成時間 2026-10-20 16:12（Asia/Taipei）。

## Preview 與截圖待辦

- 部署紀錄：https://vercel.com/patrick0814-6136s-projects/solution-finder/79purZ8E1d82F29jyN3DXMLuYr6j
- 已驗證資產的固定 Preview：https://solution-finder-mxlmjy6o1-patrick0814-6136s-projects.vercel.app/
- 首頁 Preview 顯示「內部系統登入」，需使用者手動輸入共用密碼。沒有略過登入或使用模擬資料代替 Preview。
- 待擷取：首頁頁首（桌機、375px）、製造業頁頁首（桌機、375px）、顯示新 favicon 的瀏覽器分頁列截圖。
- 電腦操作工具嘗試取得 Chrome 視窗截圖時回覆「Computer Use was not approved to use Google Chrome」。頁面截圖可由已連接的瀏覽器工具於登入後取得；包含分頁列的視窗截圖仍需取得工具權限。
- 未以登入畫面或自行合成的圖像當成通過驗收的截圖。上述視覺驗收目前尚未完成。
