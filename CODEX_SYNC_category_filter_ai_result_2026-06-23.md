# CODEX SYNC - category filter and AI result

日期：2026-06-23
分支：feat-diagnosis-agent-v1

## 修改範圍

- `public/manufacturing.html`
- `api/manufacturing-recommend.js`

未修改：

- `/api/solutions`
- `<script>` 標籤
- `scoreSolution`
- `getRecommendations` 排序與排除缺公司名邏輯
- `officialPrograms`
- 方案卡片 HTML 結構

## 版面順序

`public/manufacturing.html` 已調整為：

1. 分析結果標題列與條件資訊
2. AI分析結果
3. 分類篩選
4. AI工具庫(產發署)推薦方案
5. 其他合適的解決方案

原本下方的「結論建議」區塊已改名為「AI分析結果」並上移到方案列表上方。

## AI分析結果

前端：

- `renderSummaryFromJson()` 改為只渲染 `summary`。
- 移除前端未使用的逐方案 `top3 / reasons / benefits / fit_score` 渲染輔助函式。
- `requestAiRecommendation()` 改為送入官方欄前 5 筆方案做整體分析。

後端 `api/manufacturing-recommend.js`：

- Prompt 改為要求整體綜合評比，不逐一剖析個別方案。
- JSON 輸出簡化為：

```json
{
  "summary": "..."
}
```

- 回傳也只保留 `success` 與 `summary`。

## 分類篩選

新增狀態：

- `currentOfficial`
- `currentOthers`
- `selectedCategories`

新增函式：

- `resetCategoryFilter()`
- `buildCategoryFilter(official, others)`
- `applyCategoryFilter()`

實作方式：

- `renderResult()` 會先呼叫 `buildCategoryFilter()`，從當前 official + others 的 `item.cat` 去重產生 tag。
- 類別數小於等於 1 時，`categoryFilterCard` 維持隱藏。
- 點 tag 只更新 `selectedCategories` 與重新呼叫 `applyCategoryFilter()`。
- `applyCategoryFilter()` 沿用既有 `renderList()` 渲染方案卡片，不改卡片 HTML。
- 篩選為 OR 邏輯；不選 tag 時顯示全部。
- 篩選只操作前端目前 10 筆結果，不呼叫任何 API。

## 篩選重置點

- `renderResult()`：每次重新產生推薦時重建分類並清空選取。
- `resetAgent()`：呼叫 `resetCategoryFilter()`。
- `clearAllFiles()`：呼叫 `resetCategoryFilter()`。
- `restoreResult()`：透過 `renderResult()` 重建分類。

## 驗證

本地完成：

- `git diff --check -- public/manufacturing.html api/manufacturing-recommend.js` 通過。
- `node --check api/manufacturing-recommend.js` 通過。
- `node` 解析 `public/manufacturing.html` 內嵌 script 通過。

未完成：

- 未在 Vercel Preview 做實際 UI 點選測試。
- 未用真實 API 回應驗證 summary 內容，因本地沒有可用 runtime/API key。

建議 Preview 驗收：

1. 產生推薦後，AI分析結果位於分類篩選與方案列表上方。
2. AI分析結果為整體綜合評比，不出現逐方案卡片。
3. 分類篩選 tag 來自當前 10 筆方案類別。
4. 點選單一或多個類別後，官方欄與其他欄即時過濾並更新筆數。
5. 過濾不觸發 `/api/manufacturing-recommend` 或其他 API。
6. 類別小於等於 1 時分類篩選卡片不顯示。

