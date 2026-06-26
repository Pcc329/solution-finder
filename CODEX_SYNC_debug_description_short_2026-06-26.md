# CODEX SYNC：description_short / ds 讀取修正

日期：2026-06-26
Branch：`feature/inline-expand-multiple-solutions`
PR：https://github.com/Pcc329/solution-finder/pull/81

## 問題原因

`/api/solutions.js` 已將 Airtable `description_short` 回傳為縮寫欄位：

```javascript
ds: f['description_short'] || '',
```

但 `public/manufacturing.html` 前端原本讀的是：

```javascript
solutionField(item, "description_short", "description_short")
```

因此前端拿不到 `ds`，會 fallback 到 `desc`，導致仍顯示 `description` 前 100 字。

## 修改檔案

- `public/manufacturing.html`

## 修改前後片段

### getInlineDetailHtml()

修改前：

```javascript
const descriptionShort = solutionField(item, "description_short", "description_short");
```

修改後：

```javascript
const descriptionShort = solutionField(item, "ds", "description_short");
```

### renderDetail()

修改前：

```javascript
const descriptionShort = solutionField(item, "description_short", "description_short");
```

修改後：

```javascript
const descriptionShort = solutionField(item, "ds", "description_short");
```

### compactRecommendSolutions()

修改前：

```javascript
description_short: item.description_short || "",
```

修改後：

```javascript
description_short: item.ds || item.description_short || "",
```

## 驗證

- `git diff -- public/manufacturing.html`：確認只改 3 行
- `git diff --check -- public/manufacturing.html`：通過
- `public/manufacturing.html` inline script `new Function()` 語法檢查：通過

## 未修改

- 未修改 `/api/solutions.js`
- 未修改 `api/manufacturing-recommend.js`
- 未修改 `scoreSolution`
- 未修改 `getRecommendations`
- 未修改 `officialPrograms`
- 未修改 `<script>` 標籤

