# CODEX SYNC - exclude no-company recommendations

日期：2026-06-23
分支：feat-diagnosis-agent-v1

## 修改範圍

- `public/manufacturing.html`
- 未修改 API、資料庫資料、評分邏輯、官方來源、版面、卡片渲染、結論生成。

## getRecommendations 排除條件

在 `getRecommendations()` 的 `scored` pipeline 中加入公司名非空條件：

```js
const scored = allSolutions
  .map((item, index) => ({ item, index, score: scoreSolution(item) }))
  .filter(entry => safeStr(entry.item.c).trim() !== "")
  .filter(entry => entry.score > 0 || solutionText(entry.item).includes("製造"))
  .sort((a, b) => b.score - a.score || a.index - b.index);
```

效果：

- 官方欄與其他欄都源自 `scored`，因此兩欄同時排除缺公司名方案。
- `pickTop3()` 與結論生成使用 official/others，因此也不會收到缺公司名方案。
- 不猜測、不補寫 company_id 或公司名。

## 實測狀態

本地未連 Airtable / Vercel Preview 做真實推薦結果實測。

已完成靜態驗證：

- `git diff` 確認只新增一個 filter 條件。
- `git diff --check -- public/manufacturing.html` 通過。
- `node` 解析 `public/manufacturing.html` 內嵌 script 通過。

建議 Preview 驗收：

1. 產生推薦後，官方欄不應出現「未提供業者」或「廠商資訊待補」。
2. 其他欄不應出現「未提供業者」或「廠商資訊待補」。
3. 兩欄仍應各有前 5 筆推薦。

