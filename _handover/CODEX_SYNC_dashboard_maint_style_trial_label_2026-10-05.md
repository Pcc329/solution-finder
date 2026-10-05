# SYNC: 儀表板資料維護樣式與提供試用標籤

日期：2026-10-05  
Branch：`fix/dashboard-maint-style-trial-label-2026-10-05`  
PR：[Pcc329/solution-finder#202](https://github.com/Pcc329/solution-finder/pull/202)  
Preview：[Vercel Preview](https://solution-finder-git-fix-dashb-8b4e6c-patrick0814-6136s-projects.vercel.app)

## 實際改動

### `public/dashboard.html`

- `updateRecentActivity(data)`（約第 2008 行）內的資料維護列表改用既有近期更新清單的 DOM 結構與 class：
  - `div.update-item`
  - `div.update-item-main > span.update-item-name`
  - `div.update-item-meta > span.update-item-time`
- 項目文字維持 `${label}　${count} unit`，日期維持 `MM/DD`。
- 空狀態與缺少 `maintenance` 的錯誤狀態改放在 `span.update-item-company`，沿用既有次要文字樣式。
- 全部使用 `document.createElement`、`textContent`、`appendChild`／`append`，沒有加入 `innerHTML`。
- 沒有新增或修改 CSS。

改動前：

```js
const mmdd = it.date.slice(5).replace('-', '/');
row.textContent = `${mmdd}　${it.label}　${formatNumber(it.count)} ${unit(it.kind)}`;
```

改動後：

```js
const main = document.createElement('div');
main.className = 'update-item-main';
const name = document.createElement('span');
name.className = 'update-item-name';
name.textContent = `${it.label}　${formatNumber(it.count)} ${unit(it.kind)}`;
main.appendChild(name);
const meta = document.createElement('div');
meta.className = 'update-item-meta';
const time = document.createElement('span');
time.className = 'update-item-time';
const mmdd = it.date.slice(5).replace('-', '/');
time.textContent = mmdd;
meta.appendChild(time);
row.append(main, meta);
```

### `public/index.html`

- `HOME_POPULAR_FILTERS`（第 104 行附近）中 `free-trial` 的顯示文字由「免費試用」改為「提供試用」。
- `id: "free-trial"`、class 與 `handlePopularFilter` 的 `pricingModel = "提供試用"` 均維持不變。
- `public/` 全文搜尋「免費試用」為 0 筆。

改動前：

```js
{ id: "free-trial", label: "免費試用", className: "..." }
```

改動後：

```js
{ id: "free-trial", label: "提供試用", className: "..." }
```

## 驗證

### 靜態與語法

- `git diff --check`：通過。
- Dashboard inline script syntax check：通過。
- Index Babel/JSX syntax check：通過。
- 資料維護渲染區塊檢查：沒有 `innerHTML`。
- `api/stats.js`、`vercel.json`：無差異。

### DOM 與樣式

在 1280×900 瀏覽器測試中，資料維護列與「最新寫入項目」的 computed style 完全一致：

| 元素 | font-size | font-weight | color |
| --- | --- | --- | --- |
| `.update-item-name` | 14px | 800 | `rgb(15, 23, 42)` |
| `.update-item-time` | 12px | 700 | `rgb(102, 112, 133)` |

缺少 `maintenance` 時：

- 方案校正顯示 `—`
- 公司資料補充顯示 `—`
- 顯示「資料維護紀錄暫時無法取得」
- 其他統計仍保留，例如總方案數 `2,268`

### Vercel Preview 即時資料

驗證時間：2026-10-05（Asia/Taipei）。

- `/api/stats`：HTTP 200。
- 總方案數：2,268；公司總數：1,102。
- 資料維護合計：方案 39 筆、公司 898 家。
- 列表：
  - 公司所在地 409 家，10/05
  - 公司所在地 346 家，10/02
  - 稅籍登記主業 849 家，10/02
  - 方案狀態與名稱校正 39 筆，09/30
- 儀表板頁面狀態：`已更新`。
- 首頁「提供試用」按鈕：1 個；「免費試用」：0 個。
- 點擊「提供試用」後進入搜尋結果，套用標籤顯示「提供試用」，即時結果 53 筆。
- Browser console：沒有 JavaScript error 或 CSP error。

## 截圖

- [資料維護與最新寫入項目同畫面](./evidence/dashboard-maint-style-20261005/dashboard-maintenance-and-latest.png)
- [首頁提供試用按鈕](./evidence/dashboard-maint-style-20261005/home-trial-button.png)

Preview 即時畫面另已於 Codex 瀏覽器驗收紀錄中擷取；上述 committed 截圖為相同 DOM 的 1280px 自動化視覺驗證，便於 PR review。

## 驗收結論

- [x] 資料維護列與既有清單樣式一致。
- [x] 名稱／數量在左、日期在右，日期格式為 `MM/DD`。
- [x] 空狀態與錯誤狀態使用既有次要文字 class。
- [x] 未使用 `innerHTML`。
- [x] 首頁顯示「提供試用」，全站無「免費試用」殘留。
- [x] `free-trial` 篩選行為不變，Preview 實測可篩出 53 筆。
- [x] 無 API、資料庫、CSP 或 CSS 改動。

## 項目 3：稅籍徽章改用螢幕圖示

程式碼 commit：`5906000094dc54cadb2e327e533cf74e1252fc0a`。本項沿用同一分支及 PR #202，沒有新建 PR；項目 1、2 的程式碼不再修改。

PR 標題更新為 `Fix dashboard maintenance styling, trial label and tax badge icon`。

### 改動位置與前後對照

僅置換以下三處的 `fa-code` class token 為 `fa-desktop`：

| 檔案 | 行號 | 位置 |
| --- | --- | --- |
| `public/index.html` | 1513 | 搜尋結果卡片的稅籍徽章 |
| `public/index.html` | 1620 | 方案詳情的稅籍徽章 |
| `public/manufacturing.html` | 998 | `getTaxBadgeHtml(item)` |

Index 兩處改動前均為：

```html
<i className="fa-solid fa-code mr-1"></i>
```

Index 兩處改動後：

```jsx
<i className="fa-solid fa-desktop mr-1"></i>
```

Manufacturing 字串模板使用 HTML `class`，改動前／後為：

```html
<i class="fa-solid fa-code mr-1"></i>
<i class="fa-solid fa-desktop mr-1"></i>
```

`fa-solid`、`mr-1`、徽章文字、title、顏色與外層 class 均未改動。Index 既有 `item.itr === 1`、manufacturing 既有 `Number(item?.itr) === 1` 判斷也未改動。

### 靜態與語法驗證

- `public/` 全文搜尋：`fa-code` 0 處、`fa-desktop` 3 處，皆為上表位置。
- `git diff --check`：通過。
- Index Babel/JSX syntax check：通過；原 dashboard 資料維護檢查仍通過。
- Manufacturing 實際瀏覽器載入／渲染：通過，測試中 pageerror 為 0。
- 螢幕圖示 computed `::before` glyph 為 Font Awesome desktop（`U+F390`），不是程式碼括號圖示。
- 本項未修改 API、資料庫、script 標籤、任何篩選或推薦邏輯。

### 真實 Preview 驗證

驗證時間：2026-10-05（Asia/Taipei）。來源為已登入的上述 Vercel Preview；頁面當時顯示總方案數 **2,268**。本輪 CLI 直接讀 API 需登入，因此沒有把 CLI 回應當成資料驗證；以下皆透過已登入的頁面操作。

1. **SOL-0005，104企業大師人資管理**：在搜尋結果點開詳情，確認公司為「一零四資訊科技股份有限公司」、來源為「臺灣雲市集」、稅籍主業為「入口網站經營」。「資訊服務為主要登記項目」徽章顯示螢幕圖示；未啟用排除疑似下架的篩選。方案 ID 由使用者提供，Preview 介面沒有顯示該業務 ID，故以完整方案名、公司、來源及稅籍文字核對。
2. **SOL-0911，智慧客服與數據中台整合方案**：以「思偉達」搜尋得到 3 筆，點開指定方案，確認公司為「思偉達創新科技股份有限公司」、稅籍主業為「電腦及電腦週邊設備批發」。DOM 的 `.fa-desktop` 與「資訊服務為主要登記項目」均為 **0**；與使用者提供的 `it_code_rank = 2` 一致。
3. **方案探索頁即時推薦**：完成既有問答，產生官方／其他方案各 5 筆。在「GenAIoT平台」卡片確認螢幕圖示；同畫面的「AI 循環碳永續價值鏈與善良管理人雲管家」保留稅籍文字但沒有該徽章。

### 指定方案的本機渲染補驗（不是 Preview 截圖）

方案探索頁沒有方案名稱搜尋入口，本輪即時推薦未包含 SOL-0005／SOL-0911。為驗證指定資料在該頁的呈現，另以 **未修改的 manufacturing.html** 呼叫既有 `renderList`／`getTaxBadgeHtml`，輸入使用者確認的兩筆方案資料（`itr` 分別為 1／2，SOL-0005 的顯示資料亦與上述真實 Preview 相符）。這是 **2 筆本機 fixture 渲染測試**，不是線上 API 的完整回應，也不是指定方案在 Preview 推薦中的截圖。

- SOL-0005：螢幕圖示 1 個、徽章文字正常。
- SOL-0911：螢幕圖示 0 個、原稅籍主業文字仍有 1 處。
- 1280×800 渲染，pageerror 0；測試後瀏覽器與臨時伺服器已關閉。
- Fixture、測試腳本與下載的驗證資源皆在 repo 外 QA 目錄，不納入 PR。

### 項目 3 截圖

- [首頁詳情：指定 SOL-0005，真實 Preview](./evidence/dashboard-maint-style-20261005/tax-icon-index-preview.jpg)
- [方案探索：指定 SOL-0005／SOL-0911，本機渲染補驗](./evidence/dashboard-maint-style-20261005/tax-icon-manufacturing-sol0005-local.png)
- [方案探索：GenAIoT 正向與其他方案反向對照，真實 Preview](./evidence/dashboard-maint-style-20261005/tax-icon-manufacturing-preview.jpg)
- [首頁詳情：指定 SOL-0911 無徽章，真實 Preview](./evidence/dashboard-maint-style-20261005/tax-icon-index-negative-preview.jpg)

### 項目 3 驗收狀態

- [x] 三處圖示 class 置換完成；`fa-code = 0`、`fa-desktop = 3`。
- [x] SOL-0005 在首頁詳情顯示螢幕圖示；方案探索既有渲染函式以指定資料確認同樣顯示。
- [x] 指定 rank 2 對照方案不顯示該徽章，稅籍主業文字保留。
- [x] 既有條件、文字、title、顏色、項目 1／2 與推薦邏輯維持不變。
- [x] 同一 PR 更新標題，原 SYNC 末尾補上項目 3 與截圖。
- [ ] 指定 SOL-0005 在真實 Preview 的方案探索推薦清單中之截圖：本輪未取得，不以本機補驗冒充。
