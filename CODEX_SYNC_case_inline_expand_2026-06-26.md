# CODEX SYNC：參考案例 inline expand

日期：2026-06-26
Branch：`feature/inline-expand-multiple-solutions`
PR：https://github.com/Pcc329/solution-finder/pull/81

## 任務

依 `spec_case_inline_expand_20260626.md`，讓 `public/manufacturing.html` 的參考案例卡支援點擊後行內展開，顯示顧問可用的細節欄位。

## 修改檔案

- `public/manufacturing.html`

## referenceCases 常數更新

`referenceCases` 仍為 30 筆。

每筆案例已補齊 11 個欄位：

- `title`
- `industry`
- `size`
- `solutionType`
- `pain`
- `result`
- `visibility`
- `diagnosis`
- `resistance`
- `resolution`
- `replicable`

欄位數量驗證：

- `title`：30
- `diagnosis`：30
- `resistance`：30
- `resolution`：30
- `replicable`：30

## inline expand 實作

新增獨立狀態：

```javascript
let expandedReferenceCaseTitle = "";
```

此狀態只管理參考案例展開，不使用也不修改推薦方案的 `expandedIds`。

展開邏輯：

- 點案例卡片：
  - 若該案例未展開，設定 `expandedReferenceCaseTitle = item.title`
  - 若該案例已展開，設定為空字串並收起
- 點其他案例：
  - 直接改成新案例 title，因此一次只會展開一張
- 切換產業篩選：
  - 若目前展開案例不在篩選後列表中，自動清空展開狀態

## 展開內容 HTML

新增函式：

```javascript
getReferenceCaseDetailHtml(item)
```

展開內容使用既有 `.inline-detail` 樣式，包含四個欄位：

- 顧問診斷結論：`item.diagnosis`
- 推動阻力：`item.resistance`
- 化解方法：`item.resolution`
- 可複製條件：`item.replicable`

卡片展開時：

- summary article 加上 `is-expanded`
- `aria-expanded` 依狀態切換
- chevron icon 上下切換

## 驗收標準確認

- [x] 點案例卡片後，卡片下方展開四個詳細欄位
- [x] 再點同一張卡片收起
- [x] 點其他卡片時，上一張自動收起
- [x] 展開內容包含顧問診斷結論、推動阻力、化解方法、可複製條件
- [x] 展開動畫使用既有 `.inline-detail` 的 opacity + transform
- [x] 不影響產業篩選 chip 邏輯
- [x] 不影響推薦方案的 `expandedIds` 邏輯

## 未修改

- 未新增或修改 `/api/`
- 未修改 `scoreSolution`
- 未修改 `getRecommendations`
- 未修改 `officialPrograms`
- 未修改推薦方案的 `expandedIds`
- 未修改推薦方案的 `toggleInlineDetail`
- 未修改 `<script>` 標籤屬性

## 驗證

- `public/manufacturing.html` inline script `new Function()` 語法檢查：通過
- `git diff --check -- public/manufacturing.html`：通過
- `node --check api/manufacturing-recommend.js`：通過

