# CODEX SYNC：description_short 前端顯示

日期：2026-06-26
Branch：`feature/inline-expand-multiple-solutions`
PR：https://github.com/Pcc329/solution-finder/pull/81

## 任務來源

依 `spec_description_short_frontend_20260626.md` 修正製造業方案探索頁的方案介紹顯示邏輯。

## 修改檔案

- `api/manufacturing-recommend.js`
- `public/manufacturing.html`

## 修改內容

### 1. api/manufacturing-recommend.js

在 `compactSolutions` 加入 `description_short`：

```javascript
description_short: String(item.description_short || '').slice(0, 200),
```

用途：讓後端推薦摘要 prompt 可取得 Airtable 新增的 `description_short` 欄位。

### 2. public/manufacturing.html

調整兩個顯示方案介紹的位置：

- `getInlineDetailHtml()`
- `renderDetail()`

顯示規則：

1. 優先顯示 `description_short`
2. 若 `description_short` 為空，fallback 到 `description`
3. fallback 時只顯示 `description` 前 100 字並加省略號

同時在 `compactRecommendSolutions()` 送出 `/api/manufacturing-recommend` payload 時加入：

```javascript
description_short: item.description_short || "",
```

## 未修改

- 未修改 `/api/solutions.js`
- 未修改 `scoreSolution`
- 未修改 `getRecommendations`
- 未修改 `officialPrograms`
- 未修改 `<script>` 標籤設定

## 驗證

- `git diff --check -- public/manufacturing.html api/manufacturing-recommend.js`：通過
- `node --check api/manufacturing-recommend.js`：通過
- `public/manufacturing.html` inline script `new Function()` 語法檢查：通過

