# CODEX SYNC - official filter and layout

日期：2026-06-23
分支：feat-diagnosis-agent-v1

## 修改範圍

- `public/manufacturing.html`
- 未修改 API、推薦排序、卡片渲染、tooltip、結論生成。

## officialPrograms

已將官方欄來源收斂為雲市集工業館：

```js
const officialPrograms = ["雲市集工業館"];
```

原本的 `SME AI平台` 已移除。依既有 `getRecommendations()` 邏輯，SME AI平台不再進官方欄，會進入其他合適方案候選。

## 推薦版面

推薦結果區由左右雙欄改為上下單欄：

```html
<section class="grid grid-cols-1 gap-4">
```

官方欄仍在前，其他欄仍在後，因此單欄後會呈現：

1. AI工具庫(產發署)推薦方案
2. 其他合適的解決方案

## 實測狀態

本地未連 Airtable / Vercel Preview 做真實資料分流測試。

已完成靜態驗證：

- `git diff` 確認只改 `officialPrograms` 與 grid class。
- `git diff --check -- public/manufacturing.html` 通過。
- `node` 解析 `public/manufacturing.html` 內嵌 script 通過。

建議 Preview 驗收：

- 官方欄只出現 `program_type` 包含「雲市集工業館」的方案。
- `SME AI平台` 方案出現在「其他合適的解決方案」。
- 桌機與手機都呈上下單欄排列。

