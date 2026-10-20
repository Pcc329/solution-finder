# 網站品牌圖示與瀏覽器分頁圖示（G2）

- PR：https://github.com/Pcc329/solution-finder/pull/291
- 分支：`feat/brand-icon`；沿用 PR #291，未合併，未啟用自動合併。
- 原分支起點：最新抓取的 `origin/main`，`f868c046391b8e4a1614d1cde478b659ab15c64a`。
- G2 更新基準：`ee15511174de3577287cb6b13235cb6faf0f9022`，更新前已 fetch 並確認遠端分支與本機一致。
- 本次內容：依 ZIP 的 MANIFEST 原始位元組覆蓋三個資產，更新本 SYNC；8 個頁面的既有修改維持不變。

## G2 來源與處理

- 附件：`brand_icon_g2_20261020.zip`，來源為使用者指定的 Chrome下載資料夾。
- ZIP SHA-256：`45d4032155b543ec9713a1b4b0cba15f3b8aceee4b3b0cbc3dd116b26c9aa093`。
- 依根目錄 `MANIFEST.md` 的三筆路徑與完整 64 碼 SHA-256，從 ZIP 的 `solution-finder/public/` 解壓並直接複製檔案位元組。
- G2 為 `#0D9488` 底色與白色節點／連線；未自行重新繪製或調整附件內容。
- ZIP 成員、解壓後且覆蓋前、覆蓋後、Git stage blob 的 SHA-256 全部符合 MANIFEST。若任一步不符，即停止後續提交／推送。
- 解壓後未被加入額外中繼資料，未執行中繼資料移除。SVG 無 C2PA namespace／metadata；PNG 無 caBX chunk。
- SVG 維持原始 LF，PNG 未重新壓縮、重新編碼或另存；覆蓋後與 ZIP 成員逐位元組相同。
- 因本機 `core.autocrlf=true`，在 `.gitattributes` 第 4–5 行為兩個 SVG 指定 `text eol=lf`，確保後續 Git checkout 仍保留 LF。這是本次三個資產及 SYNC 以外唯一修改的檔案。

## MANIFEST 完整 SHA-256

| 檔案 | 位元組 | MANIFEST SHA-256 |
| --- | --- | --- |
| `public/brand/logo-mark.svg` | 521 | `4296d6cca84dbcad43fbddf6a1330f09fee1808bb47e71c5ab00f2d646712cab` |
| `public/favicon.svg` | 492 | `22e11380f7344fba57e6c3f8b6112bf9acc5cf582df1391c5e70e105767b786c` |
| `public/apple-touch-icon.png` | 4958 | `48c736ee66532392947f63af40af9cbb10d58f58cc09db5e29c38617a54c527c` |

## 覆蓋前後各自計算的 SHA-256

「覆蓋前」指解壓後、準備複製進 repo 的 G2 來源檔；「覆蓋後」指 repo 內的目標檔。原版檔案的舊雜湊已另行留存於工作區驗證紀錄，未拿舊版雜湊與 G2 MANIFEST 混用。

| 檔案 | 覆蓋前 SHA-256 | 覆蓋後 SHA-256 |
| --- | --- | --- |
| `public/brand/logo-mark.svg` | `4296d6cca84dbcad43fbddf6a1330f09fee1808bb47e71c5ab00f2d646712cab` | `4296d6cca84dbcad43fbddf6a1330f09fee1808bb47e71c5ab00f2d646712cab` |
| `public/favicon.svg` | `22e11380f7344fba57e6c3f8b6112bf9acc5cf582df1391c5e70e105767b786c` | `22e11380f7344fba57e6c3f8b6112bf9acc5cf582df1391c5e70e105767b786c` |
| `public/apple-touch-icon.png` | `48c736ee66532392947f63af40af9cbb10d58f58cc09db5e29c38617a54c527c` | `48c736ee66532392947f63af40af9cbb10d58f58cc09db5e29c38617a54c527c` |

## 本次檢查

- 三個檔案覆蓋前後的完整 64 碼 SHA-256 均與 MANIFEST 相符。
- Git stage blob 與工作目錄、ZIP 成員逐位元組相同；兩個 SVG 均無 CR 字元。
- 8 個 HTML 相對本次 G2 更新基準 `ee15511` 均無變更，保留原有樣式、按鈕、版面與 JSX。
- `git diff --check` 通過。
- 本次僅為靜態資產更新，未重跑與此次改動無關的 API 測試。

## 修改內容與行號（沿用 PR 初版，G2 未變動）


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

## 初版歷史與 Preview 狀態

- 初版程式碼提交：`4856fd7d9c5daa6062217667b3e3afc53528a105`；初版 SYNC 提交：`ee15511174de3577287cb6b13235cb6faf0f9022`。
- 初版附件曾含額外 C2PA 中繼資料，移除後才符合當時指定的 16 碼雜湊。這是歷史處理；本次 G2 沒有移除或修改任何中繼資料，改以 ZIP MANIFEST 完整 64 碼驗證。
- 初版固定 Preview：https://solution-finder-mxlmjy6o1-patrick0814-6136s-projects.vercel.app/ ，對應舊版 4856fd7，不代表 G2 的部署驗證。
- 初版已完成資產 HTTP 200／雜湊、完整 JSX classic React 編譯及改動範圍驗證。
- 原任務的首頁／製造業頁桌機與 375px、瀏覽器分頁列截圖仍待登入及 Chrome 視窗截圖權限；本次未將先前 Preview 或截圖當成 G2 視覺驗收。
