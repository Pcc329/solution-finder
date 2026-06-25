# CODEX SYNC：製造業方案複數行內展開

日期：2026-06-25
Branch：`feature/inline-expand-multiple-solutions`
Base：`main`
功能 Commit：`1a8187e` (`feat: support multiple inline-expanded solution cards`)
PR：https://github.com/Pcc329/solution-finder/pull/81

## 修改檔案

- `public/manufacturing.html`

未修改：

- `/api/` 下任何檔案
- `scoreSolution`
- `getRecommendations`
- `officialPrograms`
- 推薦資料內容、排序與分類篩選條件
- `<script>` 標籤屬性

## 修改函式與狀態

### 新增狀態

```javascript
let expandedIds = [];
let lastToggledId = null;
const DESKTOP_MAX_EXPANDED = 3;
const MOBILE_MAX_EXPANDED = 1;
```

`expandedIds` 依展開時間保存方案 ID。最早展開的 ID 位於陣列前端。

### 新增函式

- `getInlineDetailHtml(item, shouldAnimate)`
- `getMaxExpanded()`
- `updateExpandedControls()`
- `syncExpandedIdsWithVisibleItems(visibleItems)`
- `toggleInlineDetail(item)`
- `collapseAllDetails()`
- `renderCurrentLists()`

### 修改函式

- `renderList(container, items, variant)`
  - 卡片事件改為 `toggleInlineDetail()`。
  - 卡片下方依 `expandedIds` 插入 inline detail。
  - 顯示展開／收合 chevron 與 `aria-expanded`。
- `applyCategoryFilter()`
  - 改呼叫 `renderCurrentLists()`。
  - 分類操作前清除 `lastToggledId`，避免重播動畫。
- `resetCategoryFilter()`
  - 重設展開 ID、動畫 ID 與狀態顯示。

## 展開上限

```javascript
function getMaxExpanded() {
  return window.innerWidth < 768
    ? MOBILE_MAX_EXPANDED
    : DESKTOP_MAX_EXPANDED;
}
```

- 桌機固定最多 3 張。
- 手機固定最多 1 張，不因版面放寬。
- 超過上限使用 `expandedIds.shift()` 收合最早展開方案。
- 視窗從桌機縮至手機時，resize handler 也以 `shift()` 收斂至 1 張。

## 動畫控制

採用 `lastToggledId`：

```javascript
lastToggledId = itemId;
const shouldAnimate = isExpanded && itemId === lastToggledId;
```

```html
<div class="inline-detail ${shouldAnimate ? "" : "no-animation"}">
```

```css
.inline-detail {
  animation: inlineDetailIn 160ms ease-out;
}
.inline-detail.no-animation {
  animation: none;
}
```

每次 `renderCurrentLists()` 完成後將 `lastToggledId = null`。因此：

- 新展開卡片播放動畫。
- 已展開卡片因列表重渲染時套用 `no-animation`。
- 分類篩選與 resize 重渲染不會讓保留卡片重新閃動。

## 分類篩選同步

實作位置：`renderCurrentLists()`。

```javascript
syncExpandedIdsWithVisibleItems([...official, ...others]);
```

```javascript
function syncExpandedIdsWithVisibleItems(visibleItems) {
  const visibleIds = new Set(
    visibleItems.map(item => safeStr(item.id)).filter(Boolean)
  );
  expandedIds = expandedIds.filter(id => visibleIds.has(id));
}
```

分類篩選後：

- 仍可見方案保留展開狀態。
- 已不可見方案從 `expandedIds` 移除。
- 保留的 inline detail 使用 `no-animation`。

## 行內詳細內容

`getInlineDetailHtml()` 顯示：

- 方案總費用
- 月費（有資料時）
- 方案介紹（前 100 字）
- 功能清單（前 5 項）
- 服務類別
- 適用產業
- 適用規模

中文內容統一使用：

```css
overflow-wrap: break-word;
word-break: break-word;
```

沒有使用 `overflow-wrap: anywhere` 或 `word-break: break-all`。

## 狀態與全部收合

推薦方案標題旁新增：

```text
已展開 X / 3
全部收合
```

手機狀態顯示上限為 `/ 1`。

```javascript
function collapseAllDetails() {
  expandedIds = [];
  lastToggledId = null;
  renderCurrentLists();
}
```

沒有展開項目時，「全部收合」為 disabled。

## 舊換頁邏輯處理

以下舊函式與狀態完整保留：

- `currentView`
- `selectedSolution`
- `updateView()`
- `renderDetail()`
- `openDetail()`
- `backToResult()`
- `popstate` handler

停用方式：

- `renderList()` 的卡片 click handler 已從 `openDetail()` 改為 `toggleInlineDetail()`。
- 全檔搜尋確認 `openDetail()` 只剩函式定義，沒有活動呼叫點。
- 正常使用流程不再切換 `detailView` 或加入 `#detail`。
- 舊邏輯仍可作為回退基礎，沒有刪除。

## 13 點驗收

1. 展開第 1 張：通過，新卡片 class 為 `inline-detail`。
2. 展開第 2 張：通過，第 1 張為 `no-animation`，第 2 張播放動畫。
3. 展開第 3 張：通過，前 2 張為 `no-animation`，第 3 張播放動畫。
4. 展開第 4 張：通過，最早卡片自動收合，只保留 3 張；新卡片播放動畫。
5. 分類篩選保留可見展開卡片：通過，保留卡片為 `no-animation`。
6. 分類篩選移除不可見展開 ID：通過，3 張同步縮減為 1 張。
7. 全部收合：通過，inline detail 數量變為 0，按鈕 disabled。
8. 上限：桌機狀態測試為 3；手機狀態測試固定為 1。
9. 展開內容：費用、介紹、功能、屬性均於瀏覽器 DOM 驗證出現。
10. 不需返回分析結果：通過，卡片下方直接展開。
11. 推薦排序：未修改 `scoreSolution` / `getRecommendations`。
12. 分類篩選：原有 tag 邏輯保留，瀏覽器實測正常。
13. 舊換頁函式：保留，卡片無呼叫點。

## 驗證結果

- `git diff --check -- public/manufacturing.html`：通過
- `node --check api/manufacturing-recommend.js`：通過
- `public/manufacturing.html` inline script `new Function()`：通過
- 禁止 CSS 搜尋：
  - `overflow-wrap: anywhere`：0 筆
  - `word-break: break-all`：0 筆
- 瀏覽器 mock API 測試：
  - 8 筆方案載入成功
  - 多張展開、動畫 class、3 張上限、分類同步、全部收合均通過
  - Console 無程式錯誤；只有既有 Tailwind CDN production warning

## Git / PR

- Branch：`feature/inline-expand-multiple-solutions`
- Base：`main`
- 功能 Commit：`1a8187e`
- PR：https://github.com/Pcc329/solution-finder/pull/81
- PR 標題：`feat: support multiple inline-expanded solution cards`
- PR 尚未 merge
