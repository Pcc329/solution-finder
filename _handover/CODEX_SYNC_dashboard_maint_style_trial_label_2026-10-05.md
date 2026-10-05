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
