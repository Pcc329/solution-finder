# CODEX SYNC：方案卡片色條與費用顯示

日期：2026-06-24  
分支：`feat-diagnosis-agent-v1`  
功能 Commit：`07e8467` (`Differentiate manufacturing cards and quote pricing`)

## 修改範圍

- 檔案：`public/manufacturing.html`
- 修改位置：
  - `.solution-card` CSS
  - `renderList(container, items, variant)`
  - `applyCategoryFilter()`
  - `renderDetail()`

未修改任何 API、推薦排序、分類篩選條件、方案卡片內容欄位或 script 標籤。

## 色條 CSS

```css
.solution-card {
  border-radius: 0 0.75rem 0.75rem 0;
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
}
.solution-card-official {
  border-left: 3px solid #1D9E75 !important;
}
.solution-card-other {
  border-left: 3px solid #EF9F27 !important;
}
```

- 左側無圓角，右上與右下維持既有圓角。
- 使用 `!important`，避免 Tailwind `border` utility 或 hover 狀態覆蓋左側指定顏色。
- hover 保留陰影與上移效果，不再改變 border 顏色。

## 欄位類型傳遞

`renderList()` 新增 `variant` 參數：

```javascript
const variantClass = variant === "official"
  ? "solution-card-official"
  : "solution-card-other";
```

`applyCategoryFilter()` 每次重新渲染時明確傳入：

```javascript
renderList(refs.officialList, official, "official");
renderList(refs.otherList, others, "other");
```

因此切換分類篩選後，官方欄仍為青綠色，其他欄仍為橘色。

## 費用判斷

方案卡片：

```javascript
Number.isFinite(Number(item.pr)) && Number(item.pr) > 0
  ? formatCurrency(item.pr)
  : "📞 洽詢報價"
```

詳細頁：

```javascript
hasPrice ? formatCurrency(price) : "📞 洽詢報價"
```

- `null`、空字串與 0 均顯示 `📞 洽詢報價`。
- 有效費用仍顯示 `NT$ 50,000` 等格式。
- 詳細頁總費用卡固定顯示。
- 月費仍只在有有效資料時顯示。

## 驗證情境

1. 產生官方推薦與其他候選方案。
2. 官方方案卡片左側顯示 3px 青綠色條。
3. 其他方案卡片左側顯示 3px 橘色色條。
4. 點分類 tag 重新篩選後，兩欄色條仍維持正確。
5. 無費用方案在卡片及詳細頁顯示 `📞 洽詢報價`。
6. 有費用方案維持 NT$ 格式。
7. 月費空值不顯示月費卡片。

## 驗證結果

- `git diff --check -- public/manufacturing.html`：通過
- `public/manufacturing.html` inline script `new Function()` 語法檢查：通過
- 費用測試：
  - `null` → `📞 洽詢報價`
  - `""` → `📞 洽詢報價`
  - `0` → `📞 洽詢報價`
  - `50000` → `NT$ 50,000`

## Git

- Branch：`feat-diagnosis-agent-v1`
- 功能 Commit：`07e8467`
- Remote：`origin/feat-diagnosis-agent-v1`
- PR：https://github.com/Pcc329/solution-finder/pull/new/feat-diagnosis-agent-v1

