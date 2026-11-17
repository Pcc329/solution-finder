# SYNC 首頁改版 v1

2026-11-17（台北時間）

## 交付

- 基底 `a102592d2a5b59078dc7aec97a14a2f20ad1af94`（PR #310 合併後的 `origin/main`）。
- 分支 `codex/homepage-v1-tiffany`，程式 commit `19c19f474f018a7c95518937cea41d502a20baf5`。[PR #311](https://github.com/Pcc329/solution-finder/pull/311)
- Vercel 建置 Ready。Preview 首頁 HTTP 200，回應包含新版 `GlobalNav`。[Preview](https://solution-finder-git-codex-hom-72b410-patrick0814-6136s-projects.vercel.app/) · [程式 commit 的部署狀態](https://vercel.com/patrick0814-6136s-projects/solution-finder/GqpjsqBMXuMgkNspxtFKQPvrmnqe)

## 實際改動位置

行號以程式 commit 為準。

| 檔案 | 改動 |
|---|---|
| `public/index.html` | 25–52 Tailwind 品牌設定與主題載入；55 起導覽 CSS；499–549 `GlobalNav`；556 `homeTab`；733–749 `renderCompanySearchForm` 的表單顏色 class；779 `companyTotal` 的 null／undefined 保護；1409 `handleHomeTabKeyDown`；1418–1552 `renderHome`；2429 掛載新版導覽。 |
| `public/sources.html` | 11 主題；36 起導覽 CSS；552 起導覽 HTML；1095 載入共用選單 script。 |
| `public/dashboard.html` | 15 主題；42 起導覽 CSS；122 次導覽 sticky top；1340 起導覽 HTML；2987 載入共用選單 script。 |
| `public/manufacturing.html` | 16 起 Tailwind 設定；39 主題；42 起導覽 CSS；126 新增 `.badge-brand`；513 起導覽 HTML；3036 載入共用選單 script。 |
| `public/compare.html` | 15 主題；39 起導覽 CSS；373 起導覽 HTML；572 載入共用選單 script。 |
| `public/strategy-guide.html` | 12 主題；69 起導覽 CSS；237 次導覽 sticky top；702 起導覽 HTML；1415 載入共用選單 script。 |
| `public/diagnosis.html` | 14 起 Tailwind 設定；36 主題；39 起導覽 CSS；144 起導覽 HTML；861 載入共用選單 script。 |
| `public/feedback.html` | 11 主題；表單的選中態、操作鈕與 focus 顏色見下表。 |
| `public/global-nav.js` | 第 1 行起。靜態頁共用腳本，含 `setOpen`、點擊與 Esc 處理。 |
| `public/theme.css` | 第 1 行起。規格的 14 個 Tiffany 與主視覺亮色變數。 |
| `tests/global-nav.test.mjs`、`tests/theme-tokens.test.mjs` | 兩個新檔自第 1 行起，測七頁選單、八頁主題載入、色彩搭配及正常狀態樣式。 |
| `tests/homepage-count-loading.test.cjs` | 9 以 `home-queryable-count` 擷取原數字計算式，保留五個既有情境。 |

首頁由 React `GlobalNav` 管理開關、點外收合與 Escape 焦點還原。六個靜態頁以 classic script 做相同行為。七頁均用原生按鈕、`aria-expanded`、`aria-controls` 與可 Tab 進入的連結。選單靠右。資料來源、知識庫、方案探索各在自己的頁面標示 `aria-current="page"`。React 首頁與其餘三頁的選單沒有目前頁標記。

首頁順序是 全站導覽 → 深色主視覺與雙分頁搜尋、試試看 → 白底數字列與資料來源連結 → 熱門篩選 → 依主題區瀏覽。舊版移除兩張入口卡及插圖 SVG、模糊背景色塊、兩行統計摘要與獨立快速開始區塊。兩個分頁面板疊放在同一個 grid 區域，隱藏面板與公司分頁的快捷列用 `visibility: hidden` 保留占位。

## 驗收

- [x] 主測試 370 項、SF MCP 98 項全數通過。SF MCP 使用相同 lockfile 的本機依賴。
- [x] Vercel 建置 Ready，Preview 首頁回傳 200 及新版程式。
- [x] 本機 Chromium 桌機 1440px／手機 375px，七頁均通過選單開關、連結順序、焦點、Escape、點外收合、靠右和無超出畫面驗證。
- [x] 本機兩種寬度均驗證預設找方案、兩欄輸入保留、「試試看」占位、數字列位置一致。合成資料的數字列頂端桌機為 642px、手機為 676px，切換前後差值均為 0px。
- [x] 本機兩種寬度均以合成 API 驗證「食品業批號追溯」送出後出現相符方案、「華苓科技」進入公司頁、熱門篩選及主題瀏覽。所有本機 API 均攔截，包含 `/api/claude` 和 `/api/company-detail`，沒有寫入查詢或存取紀錄。
- [x] 本機統計邊界驗證。公司數為 null／undefined 顯示「—」，真實 0 保留，統計 HTTP 500 時只剩可查詢方案有值。方案 HTTP 500 沿用整頁錯誤，含原有文字與顏色，已逐字比對基底。既有測試驗證方案載入中顯示「—」。
- [x] 本機實測 dashboard、strategy-guide 的頂部導覽均為 **61px**。桌機與 375px 捲動後，次導覽頂端均為 **61px**。原手機 `112px`／`108px` 覆寫已移除。
- [x] 八頁載入 Tiffany 主題。主色按鈕用深字，方案狀態「正常」、信任、官方認證、AI 方案類型、新創及資料圖表色依清單保留。
- [ ] 已登入的 Preview 尚待核對實際方案筆數、提供廠商、本月新增方案及實際資料的搜尋動線。Preview 瀏覽器顯示共用密碼登入。規格提供的前台可見數基準為 2026-11-16 的 2,252 筆，本機同數值為合成資料。

## 截圖

桌機為 1440px，手機為 375px。下列為本機 Chromium 截圖，首頁改版前以基底 commit 的原始頁面擷取，改版後以 `19c19f4` 的程式擷取。所有數字及查詢結果為合成驗證資料。

| 項目 | 桌機 | 375px |
|---|---|---|
| 首頁改版前 | [截圖](evidence/homepage-v1-2026-11-17/home-before-1440.png) | [截圖](evidence/homepage-v1-2026-11-17/home-before-375.png) |
| 首頁改版後 | [截圖](evidence/homepage-v1-2026-11-17/home-after-1440.png) | [截圖](evidence/homepage-v1-2026-11-17/home-after-375.png) |
| 首頁找公司分頁 | [截圖](evidence/homepage-v1-2026-11-17/home-company-tab-1440.png) | [截圖](evidence/homepage-v1-2026-11-17/home-company-tab-375.png) |
| 首頁選單展開 | [截圖](evidence/homepage-v1-2026-11-17/home-menu-1440.png) | [截圖](evidence/homepage-v1-2026-11-17/home-menu-375.png) |
| 資料來源選單展開 | [截圖](evidence/homepage-v1-2026-11-17/sources-menu-1440.png) | [截圖](evidence/homepage-v1-2026-11-17/sources-menu-375.png) |
| 儀表板 sticky 捲動 | [截圖](evidence/homepage-v1-2026-11-17/dashboard-sticky-1440.png) | [截圖](evidence/homepage-v1-2026-11-17/dashboard-sticky-375.png) |
| 策略智庫 sticky 捲動 | [截圖](evidence/homepage-v1-2026-11-17/strategy-guide-sticky-1440.png) | [截圖](evidence/homepage-v1-2026-11-17/strategy-guide-sticky-375.png) |

其餘七頁桌機調色後截圖：[資料來源](evidence/homepage-v1-2026-11-17/sources-tiffany-1440.png) · [知識庫](evidence/homepage-v1-2026-11-17/dashboard-tiffany-1440.png) · [方案探索](evidence/homepage-v1-2026-11-17/manufacturing-tiffany-1440.png) · [方案比較](evidence/homepage-v1-2026-11-17/compare-tiffany-1440.png) · [策略智庫](evidence/homepage-v1-2026-11-17/strategy-guide-tiffany-1440.png) · [智能方案探索](evidence/homepage-v1-2026-11-17/diagnosis-tiffany-1440.png) · [回饋表單](evidence/homepage-v1-2026-11-17/feedback-tiffany-1440.png)。

## 最終色彩替換

導覽選中樣式由舊 `.global-nav-link.active` 綠色底及白字改為 `aria-current="page"` 與 `--sf-accent-50`／`--sf-accent-800`。折疊按鈕及連結使用 700，focus 框使用 400。七頁對應位置見「實際改動位置」。

首頁原 1271–1336 的裝飾、入口卡、舊數字文字及快捷區由 1418–1506 的新區塊取代。主視覺使用五個 `--sf-hero-*` 變數，頁籤使用 `bg-brand-50 text-brand-800`，查詢按鈕使用 `bg-brand-500 hover:bg-brand-600 text-on-brand`，需求輸入框使用 `focus:border-brand-400 focus:ring-brand-100`。

以下為其餘逐處的品牌替換與保留的語意色。舊色變數的宣告值沿用基底。

<details>
<summary>public/index.html</summary>

| 基底行號 | 新行號 | 原 class／色碼 | 實際換成 |
|---|---|---|---|
| 187 | 275 | `bg-emerald-50` | `bg-brand-50` |
| 188 | 276 | `text-emerald-700` | `text-brand-800` |
| 189 | 277 | `text-emerald-800` | `text-brand-800` |
| 199 | 287 | `focus:border-emerald-400` | `focus:border-brand-400` |
| 205 | 293 | `focus:border-emerald-400` | `focus:border-brand-400` |
| 248 | 336 | `text-emerald-700`、`hover:text-emerald-800` | `text-brand-700`、`hover:text-brand-800` |
| 304 | 392 | `focus-visible:outline-emerald-600` | `focus-visible:outline-brand-400` |
| 306 | 394 | `bg-emerald-50`、`text-emerald-700` | `bg-brand-50`、`text-brand-800` |
| 325 | 413 | `text-emerald-700` | `text-brand-700` |
| 329 | 417 | `text-emerald-700`、`hover:bg-emerald-50` | `text-brand-700`、`hover:bg-brand-50`、`hover:text-brand-800` |
| 599 | 740 | `focus:border-indigo-500`、`focus:ring-indigo-100` | `focus:border-brand-400`、`focus:ring-brand-100` |
| 601 | 742 | `#4F46B8`、`text-white`、`hover:bg-indigo-800` | `bg-brand-500`、`text-on-brand`、`hover:bg-brand-600` |
| 1372 | 1537 | `hover:border-emerald-300` | `hover:border-brand-200` |
| 1374 | 1539 | `bg-teal-100`、`text-teal-700` | `bg-brand-100`、`text-brand-800` |
| 1377 | 1542 | `text-teal-700` | `text-brand-700` |
| 1415 | 1580 | `hover:text-emerald-700` | `hover:text-brand-700` |
| 1421 | 1586 | `bg-teal-100`、`text-teal-700` | `bg-brand-100`、`text-brand-800` |
| 1425 | 1590 | `text-teal-700` | `text-brand-700` |
| 1472 | 1637 | `#0d6e52`、`text-white`、`#1D9E75` | `bg-brand-500`、`text-on-brand`、`hover:bg-brand-600` |
| 1518 | 1683 | `#0d6e52`、`text-white` | `bg-brand-500`、`text-on-brand` |
| 1538 | 1703 | `hover:text-emerald-600` | `hover:text-brand-700` |
| 1547 | 1712 | `focus-within:border-emerald-300` | `focus-within:border-brand-400` |
| 1556 | 1721 | `#0d6e52`、`#1D9E75`、`text-white` | `bg-brand-500`、`hover:bg-brand-600`、`text-on-brand` |
| 1583 | 1748 | `text-emerald-700` | `text-brand-700` |
| 1743 | 1908 | `#1D9E75` | `text-brand-700` |
| 1753 | 1918 | `focus:border-emerald-400` | `focus:border-brand-400` |
| 1756 | 1921 | `#0d6e52`、`#1D9E75`、`text-white` | `bg-brand-500`、`hover:bg-brand-600`、`text-on-brand` |
| 1763 | 1928 | `border-emerald-100` | `border-brand-200` |
| 1765 | 1930 | `bg-emerald-50`、`text-emerald-700`、`border-emerald-100` | `bg-brand-50`、`text-brand-800`、`border-brand-200` |
| 1784 | 1949 | `border-emerald-200`、`text-emerald-700`、`hover:bg-emerald-50` | `border-brand-200`、`text-brand-700`、`hover:bg-brand-50`、`hover:text-brand-800` |
| 1795 | 1960 | `focus:border-emerald-400` | `focus:border-brand-400` |
| 1819 | 1984 | `hover:border-[#0d6e52]/40`、`#1D9E75`、`ring-[#1D9E75]/20` | `hover:border-brand-200`、`border-brand-400`、`ring-brand-200` |
| 1822 | 1987 | `bg-emerald-50`、`#1D9E75`、`#0d6e52`、`hover:border-emerald-300` | `bg-brand-50`、`border-brand-400`、`text-brand-800`、`hover:border-brand-200` |
| 1862 | 2027 | `#0d6e52` | `text-brand-700` |
| 1866 | 2031 | `text-emerald-600`、`hover:text-emerald-800` | `text-brand-700`、`hover:text-brand-800` |
| 1887 | 2052 | `border-emerald-100` | `border-brand-200` |
| 1898 | 2063 | `#0d6e52`、`text-white`、`#1D9E75` | `bg-brand-500`、`text-on-brand`、`hover:bg-brand-600` |
| 1902 | 2067 | `#0d6e52`、`text-white`、`#1D9E75` | `bg-brand-500`、`text-on-brand`、`hover:bg-brand-600` |
| 1923 | 2088 | `hover:text-indigo-700` | `hover:text-brand-700` |
| 1952 | 2117 | `border-indigo-200`、`bg-indigo-50`、`text-indigo-800`、`hover:bg-indigo-100` | `border-brand-200`、`bg-brand-50`、`text-brand-800`、`hover:bg-brand-100` |
| 2003 | 2168 | `hover:text-indigo-700` | `hover:text-brand-700` |
| 2041 | 2206 | `accent-indigo-600` | `accent-brand-700` |
| 2070 | 2235 | `text-indigo-800`、`decoration-indigo-200`、`hover:text-indigo-600` | `text-brand-700`、`decoration-brand-200`、`hover:text-brand-800` |
| 2129 | 2294 | `hover:text-emerald-600` | `hover:text-brand-700` |
| 2153 | 2318 | `hover:text-indigo-700` | `hover:text-brand-700` |
| 2164 | 2329 | `text-emerald-700`、`bg-emerald-50`、`border-emerald-100` | `text-brand-800`、`bg-brand-50`、`border-brand-200` |
| 2175 | 2340 | `#0d6e52` | `text-brand-700` |
| 2186 | 2351 | `border-emerald-500`、`text-emerald-700`、`hover:bg-emerald-50` | `border-brand-200`、`text-brand-700`、`hover:bg-brand-50`、`hover:text-brand-800` |
| 2211 | 2376 | `text-emerald-500` | `text-brand-700` |

保留的語意或指定色彩

| 新行號 | 保留的 class／色碼 | 用途 |
|---|---|---|
| 218、1870 | `bg-teal-50 text-teal-700 border-teal-100 hover:border-teal-300`；`bg-teal-100 border-teal-300 text-teal-800` | 語意 · 官方認證 |
| 246、251、256 | `bg-green-50 border-green-200`、`text-green-700`、`text-green-600` | 語意 · ROI 難易度 |
| 946、1026、2001、2182–2183、2305 | `bg-emerald-100 text-emerald-800 border-emerald-200`；`text-emerald-700 bg-emerald-100 border-emerald-200`；`bg-emerald-50 border-emerald-200 text-emerald-800` | 語意 · 官方認證、國家級、新創、政府能量登錄 |
| 968、976–977 | `text-emerald-600`、`bg-emerald-50 text-emerald-800` | 語意 · 信任驗證 |
| 1574、1575 | `bg-teal-50 border-teal-200 text-teal-800`、`bg-emerald-50 border-emerald-200 text-emerald-800` | 語意 · CDM 分類、官方登錄 |
| 1625 | `bg-teal-500` | 語意 · 方案來源分布資料條 |
| 1790、1846 | `bg-green-100 border-green-300 text-green-800` | 語意 · 新創篩選與已選條件 |
| 2229 | `bg-emerald-50 text-emerald-800` | 語意 · 方案狀態「正常」 |

</details>

<details>
<summary>public/sources.html</summary>

| 基底行號 | 新行號 | 原 class／色碼 | 實際換成 |
|---|---|---|---|
| 126 | 147 | `var(--primary-dark)` | `var(--sf-accent-700)` |
| 147 | 168 | `var(--primary)` | `var(--sf-accent-500)` |
| 240 | 261 | `var(--primary-dark)` | `var(--sf-accent-700)` |
| 276 | 297 | `#ecfdf5` | `var(--sf-accent-50)` |
| 277 | 298 | `var(--primary-dark)` | `var(--sf-accent-800)` |
| 330 | 351 | `#ecfdf5` | `var(--sf-accent-50)` |
| 331 | 352 | `var(--primary-dark)` | `var(--sf-accent-800)` |
| 397 | 418 | `#b7ead7` | `var(--sf-accent-200)` |
| 399 | 420 | `#f7fffb` | `var(--sf-accent-50)` |
| 407 | 428 | `var(--primary-dark)` | `var(--sf-accent-800)` |
| 417 | 438 | `#0f5f49` | `var(--sf-accent-500)` |

保留的語意或指定色彩

| 新行號 | 保留的 class／色碼 | 用途 |
|---|---|---|
| 196、223–224 | `var(--primary)`、`#ecfdf5`、`var(--primary-dark)` | 語意 · 「找方案」與補助／採購的分類區分 |
| 504 | `--co:var(--primary)`、`--co-soft:#e3f3ef`、`--co-ink:var(--primary-dark)` | 語意 · ER 圖的公司實體及圖例 |
| 529–530 | `var(--blue)` | ER 圖 focus，依確認保留 |

</details>

<details>
<summary>public/dashboard.html</summary>

| 基底行號 | 新行號 | 原 class／色碼 | 實際換成 |
|---|---|---|---|
| 85 | 144 | `#F3F7F6` | `var(--sf-accent-50)` |
| 86 | 145 | `var(--primary-dark)` | `var(--sf-accent-800)` |
| 94 | 153 | `#CDE9E3` | `var(--sf-accent-200)` |
| 95 | 154 | `#E6F4F1` | `var(--sf-accent-100)` |
| 132 | 191 | `#D7F4EE` | `var(--sf-accent-100)` |
| 202 | 261 | `var(--primary-dark)` | `var(--sf-accent-700)` |
| 210 | 269 | `var(--primary)` | `var(--sf-accent-500)` |
| 216 | 275 | `#BFE5D8` | `var(--sf-accent-200)` |
| 218 | 277 | `#ECF8F4` | `var(--sf-accent-50)` |
| 249 | 308 | `var(--primary-dark)` | `var(--sf-accent-800)` |
| 353 | 412 | `var(--primary-dark)` | `var(--sf-accent-700)` |
| 370 | 429 | `#F3F7F6` | `var(--sf-accent-50)` |
| 371 | 430 | `#DDEBE8` | `var(--sf-accent-200)` |
| 376 | 435 | `var(--startup)` | `var(--sf-accent-700)` |
| 441 | 500 | `#E6F4F1` | `var(--sf-accent-50)` |
| 442 | 501 | `#CDE9E3` | `var(--sf-accent-200)` |
| 443 | 502 | `var(--primary-dark)` | `var(--sf-accent-800)` |
| 630 | 689 | `var(--primary)` | `var(--sf-accent-400)` |
| 631 | 690 | `rgba(11, 160, 140, 0.12)` | `color-mix(in srgb, var(--sf-accent-400) 12%, transparent)` |
| 642 | 701 | `var(--primary-dark)` | `var(--sf-accent-700)` |
| 687 | 746 | `var(--primary)` | `var(--sf-accent-400)` |
| 704 | 763 | `var(--primary-dark)` | `var(--sf-accent-700)` |
| 756 | 815 | `var(--primary-dark)` | `var(--sf-accent-700)` |
| 787 | 846 | `var(--primary-dark)` | `var(--sf-accent-700)` |
| 829 | 888 | `var(--primary)` | `var(--sf-accent-200)` |
| 830 | 889 | `#E6F4F1` | `var(--sf-accent-50)` |
| 831 | 890 | `var(--primary-dark)` | `var(--sf-accent-800)` |
| 986 | 1045 | `var(--primary)` | `var(--sf-accent-500)` |
| 1112 | 1171 | `var(--primary-dark)` | `var(--sf-accent-700)` |
| 1186 | 1245 | `var(--primary)` | `var(--sf-accent-500)` |
| 1187 | 1246 | `var(--primary)` | `var(--sf-accent-500)` |
| 1188 | 1247 | `#ffffff` | `var(--sf-on-accent)` |

保留的語意或指定色彩

| 新行號 | 保留的 class／色碼 | 用途 |
|---|---|---|
| 210 | `#D7F4EE` | 語意 · 載入、更新、失敗共用狀態文字 |
| 386–388 | `#BFE5D8`、`#E6F4F1`、`var(--primary-dark)` | 語意 · 近期項目類型「案例」 |
| 586、621、777、784、1622–1625、2553、2912、2971–2972 | `var(--primary-dark)`、`#E6F4F1`、`var(--primary)`、`#0BA08C`、`#06564B`、`#308A56`、`TEAL` | 語意 · 地圖互動與圖例、分類資料條、圖表系列 |
| 1103–1105 | `#99f6e4 #ecfdf5 #047857` | 語意 · 實際案例成果 |
| 2040、2045、2307 | `#EAF3DE #27500A`；`#E1F5EE #085041`；`#E1F5EE #0F6E56 #085041` | 語意 · 來源類別及新創 |

</details>

<details>
<summary>public/manufacturing.html</summary>

| 基底行號 | 新行號 | 原 class／色碼 | 實際換成 |
|---|---|---|---|
| 29 | 120 | `#0d9488`、`white` | `var(--sf-accent-500)`、`var(--sf-on-accent)` |
| 30 | 121 | `#0f766e` | `var(--sf-accent-600)` |
| 41 | 133 | `#99f6e4`、`#f0fdfa` | `var(--sf-accent-200)`、`var(--sf-accent-50)` |
| 42 | 134 | `#0d9488`、`#ccfbf1` | `var(--sf-accent-400)`、`var(--sf-accent-100)` |
| 43 | 135 | `#2dd4bf`、`#f0fdfa` | `var(--sf-accent-400)`、`var(--sf-accent-50)` |
| 44 | 136 | `#0d9488`、`#ccfbf1` | `var(--sf-accent-400)`、`var(--sf-accent-100)` |
| 82 | 174 | `#f0fdfa`、`#ccfbf1` | `var(--sf-accent-50)`、`var(--sf-accent-200)` |
| 83 | 175 | `#0d9488`、`#ffffff` | `var(--sf-accent-500)`、`var(--sf-on-accent)` |
| 85 | 177 | `#0d9488`、`#0f766e`、`#f0fdfa` | `var(--sf-accent-400)`、`var(--sf-accent-800)`、`var(--sf-accent-50)` |
| 87 | 179 | `#14b8a6` | `var(--sf-accent-400)` |
| 88 | 180 | `#0d9488`、`#fff` | `var(--sf-accent-500)`、`var(--sf-on-accent)` |
| 92 | 184 | `#0d9488` | `var(--sf-accent-700)` |
| 109 | 201 | `#1D9E75`、`rgba(29, 158, 117, 0.08)` | `var(--sf-accent-400)`、`color-mix(in srgb, var(--sf-accent-500) 8%, transparent)` |
| 112 | 204 | `rgba(13, 148, 136, 0.48)` | `color-mix(in srgb, var(--sf-accent-500) 48%, transparent)` |
| 113 | 205 | `rgba(13, 148, 136, 0.12)` | `color-mix(in srgb, var(--sf-accent-500) 12%, transparent)` |
| 114 | 206 | `rgba(13, 148, 136, 0)` | `transparent` |
| 211 | 303 | `#1D9E75` | `var(--sf-accent-400)` |
| 253 | 345 | `#0f766e`、`#ffffff` | `var(--sf-accent-500)`、`var(--sf-on-accent)` |
| 254 | 346 | `rgba(15, 118, 110, 0.22)` | `color-mix(in srgb, var(--sf-accent-500) 22%, transparent)` |
| 282 | 374 | `#f8fffc` | `var(--sf-accent-50)` |
| 297 | 389 | `#ecfdf5`、`#0f766e` | `var(--sf-accent-50)`、`var(--sf-accent-800)` |
| 298 | 390 | `#0f766e`、`#ffffff` | `var(--sf-accent-500)`、`var(--sf-on-accent)` |
| 413 | 505 | `#0f766e` | `var(--sf-accent-700)` |
| 442 | 535 | `text-teal-700` | `text-brand-700` |
| 461 | 554 | `text-teal-600` | `text-brand-700` |
| 479 | 572 | `bg-teal-500` | `bg-brand-500` |
| 521 | 614 | `focus:border-teal-500` | `focus:border-brand-400` |
| 538 | 631 | `hover:border-teal-500`、`hover:text-teal-700` | `hover:border-brand-400`、`hover:text-brand-700` |
| 550 | 643 | `text-teal-700` | `text-brand-700` |
| 573 | 666 | `text-teal-700`、`border-teal-200`、`hover:bg-teal-50` | `text-brand-700`、`border-brand-200`、`hover:bg-brand-50`、`hover:text-brand-800` |
| 1167 | 1260 | `text-teal-700` | `text-brand-700` |
| 1357 | 1450 | `text-teal-700` | `text-brand-700` |
| 1358 | 1451 | `text-teal-700` | `text-brand-700` |
| 1385 | 1478 | `text-teal-500` | `text-brand-700` |
| 1461 | 1554 | `hover:text-teal-700` | `hover:text-brand-700` |
| 1487 | 1580 | `text-teal-700` | `text-brand-700` |
| 1488 | 1581 | `text-teal-700` | `text-brand-700` |
| 1515 | 1608 | `text-teal-500` | `text-brand-700` |
| 1972 | 2065 | `text-teal-700` | `text-brand-700` |
| 1973 | 2066 | `text-teal-700` | `text-brand-700` |
| 2346 | 2439 | `text-teal-700`、`border-teal-200`、`hover:bg-teal-50` | `text-brand-700`、`border-brand-200`、`hover:bg-brand-50`、`hover:text-brand-800` |
| 2669 | 2762 | `text-teal-700` | `text-brand-700` |
| 34、464、516 | 126、557、609 | PDF／Haiku 流程的 `.badge-teal` | 新增 `.badge-brand`，底 `--sf-accent-50`、字 `--sf-accent-800`、框 `--sf-accent-200` |

保留的語意或指定色彩

| 新行號 | 保留的 class／色碼 | 用途 |
|---|---|---|
| 198、212、215、317 | `#1D9E75`；`#f0fdfa #0f766e #99f6e4`；`#047857 #ecfdf5 #a7f3d0`；`#EAF3DE #27500A` | 語意 · 官方方案、案例產業／成果／解法標記 |
| 411 | `#0f766e` | 語意 · 獲獎來源「文章萃取」 |
| 1110、1116、1126、1169 | `border-emerald-200 bg-emerald-50 text-emerald-700`、`text-teal-600`、`text-emerald-700`、`text-emerald-700 bg-emerald-100 border-emerald-200` | 語意 · 信任驗證、國家級 |
| 2704 | `text-teal-700` | 語意 · 解析成功 |
| 125、682、1085、1563、2072 | `.badge-teal`、`#ecfdf5 #047857 #a7f3d0` | 語意 · 官方認證、官方推薦筆數、AI 方案類型 |
| 238–241 | `#185FA5`、`rgba(24,95,165,.16)` | 案例縮圖 focus，依確認保留 |

</details>

<details>
<summary>public/compare.html</summary>

| 基底行號 | 新行號 | 原 class／色碼 | 實際換成 |
|---|---|---|---|
| 80 | 139 | `var(--primary-dark)` | `var(--sf-accent-700)` |
| 232 | 291 | `var(--primary-dark)` | `var(--sf-accent-500)` |
| 233 | 292 | `#ffffff` | `var(--sf-on-accent)` |
| 242 | 301 | `var(--primary)` | `var(--sf-accent-600)` |
| 270 | 329 | `var(--primary)` | `var(--sf-accent-500)` |

保留的語意或指定色彩

| 新行號 | 保留的 class／色碼 | 用途 |
|---|---|---|
| 18–19、225、237 | `#1D9E75 #0d6e52`、`var(--primary)`、`var(--primary-dark)` | 語意 · 比較差異和低價指標仍使用舊變數 |
| 255–258 | `.badge-ai`、`#dcfce7 #166534 #bbf7d0` | 語意 · 比較資料值「有 AI」 |

</details>

<details>
<summary>public/strategy-guide.html</summary>

| 基底行號 | 新行號 | 原 class／色碼 | 實際換成 |
|---|---|---|---|
| 106 | 165 | `var(--green)` | `var(--sf-accent-700)` |
| 163 | 222 | `var(--green)` | `var(--sf-accent-200)` |
| 164 | 223 | `var(--green)` | `var(--sf-accent-800)` |
| 165 | 224 | `rgba(15,110,86,0.06)` | `var(--sf-accent-50)` |
| 168 | 227 | `var(--green)` | `var(--sf-accent-500)` |
| 169 | 228 | `#fff` | `var(--sf-on-accent)` |
| 170 | 229 | `var(--green)` | `var(--sf-accent-500)` |
| 173 | 232 | `#fff` | `var(--sf-on-accent)` |
| 174 | 233 | `#0b5946` | `var(--sf-accent-600)` |
| 278 | 337 | `var(--green)` | `var(--sf-accent-700)` |
| 392 | 451 | `var(--green)` | `var(--sf-accent-700)` |
| 405 | 464 | `var(--green)` | `var(--sf-accent-500)` |
| 406 | 465 | `var(--green-soft)` | `var(--sf-accent-50)` |

保留的語意或指定色彩

| 新行號 | 保留的 class／色碼 | 用途 |
|---|---|---|
| 606、622、1139 | `#EAF3DE #3B6D11`、`#3B6D11`、`#E1F5EE #0F6E56 #085041` | 語意 · 供給充足、新創 |
| 475、581 | `color-mix(…var(--green-soft)…)` | 評分參考、差距表表頭，依確認保留 |

</details>

<details>
<summary>public/diagnosis.html</summary>

| 基底行號 | 新行號 | 原 class／色碼 | 實際換成 |
|---|---|---|---|
| 28 | 119 | `#0d9488`、`rgba(13, 148, 136, 0.12)` | `var(--sf-accent-400)`、`color-mix(in srgb, var(--sf-accent-400) 12%, transparent)` |
| 31 | 122 | `#0d9488`、`#f0fdfa`、`#0f766e` | `var(--sf-accent-400)`、`var(--sf-accent-50)`、`var(--sf-accent-800)` |
| 32 | 123 | `#0d9488`、`white` | `var(--sf-accent-500)`、`var(--sf-on-accent)` |
| 33 | 124 | `#0f766e` | `var(--sf-accent-600)` |
| 38 | 129 | `#0d9488`、`rgba(13, 148, 136, 0.12)` | `var(--sf-accent-400)`、`color-mix(in srgb, var(--sf-accent-400) 12%, transparent)` |
| 45 | 136 | `#f0fdfa`、`#ccfbf1` | `var(--sf-accent-50)`、`var(--sf-accent-200)` |
| 46 | 137 | `#0d9488`、`#ffffff` | `var(--sf-accent-500)`、`var(--sf-on-accent)` |
| 48 | 139 | `#0d9488`、`#0f766e`、`#f0fdfa` | `var(--sf-accent-400)`、`var(--sf-accent-800)`、`var(--sf-accent-50)` |
| 49 | 140 | `#0d9488` | `var(--sf-accent-500)` |
| 74 | 166 | `text-teal-700` | `text-brand-700` |
| 101 | 193 | `hover:text-teal-700` | `hover:text-brand-700` |
| 116 | 208 | `text-teal-700` | `text-brand-700` |
| 124 | 216 | `bg-teal-50`、`text-teal-700` | `bg-brand-50`、`text-brand-800` |
| 132 | 224 | `text-teal-700` | `text-brand-700` |
| 639 | 731 | `accent-teal-700` | `accent-brand-700` |
| 647 | 739 | `text-teal-700` | `text-brand-700` |
| 674 | 766 | `text-teal-700` | `text-brand-700` |

保留的語意或指定色彩

| 新行號 | 保留的 class／色碼 | 用途 |
|---|---|---|
| 127 | `.badge-ai`、`#ecfdf5 #047857 #a7f3d0` | 語意 · AI 方案類型 |

</details>

<details>
<summary>public/feedback.html</summary>

| 基底行號 | 新行號 | 原 class／色碼 | 實際換成 |
|---|---|---|---|
| 31 | 32 | `var(--teal-dark)` | `var(--sf-accent-700)` |
| 56 | 57 | `var(--teal)`、`rgba(29, 158, 117, .12)` | `var(--sf-accent-400)`、`color-mix(in srgb, var(--sf-accent-400) 12%, transparent)` |
| 70 | 71 | `var(--teal)`、`var(--soft)`、`var(--teal-dark)`、`rgba(29, 158, 117, .12)` | `var(--sf-accent-200)`、`var(--sf-accent-50)`、`var(--sf-accent-800)`、`color-mix(in srgb, var(--sf-accent-400) 12%, transparent)` |
| 93 | 94 | `var(--teal)`、`#fff` | `var(--sf-accent-500)`、`var(--sf-on-accent)` |
| 101 | 102 | `var(--teal)` | `var(--sf-accent-500)` |
| 102 | 103 | `#fff` | `var(--sf-on-accent)` |
| 104 | 105 | `var(--teal-dark)` | `var(--sf-accent-600)` |
| 132 | 133 | `#f0fdf9`、`#a7e8d4` | `var(--sf-accent-50)`、`var(--sf-accent-200)` |

</details>
