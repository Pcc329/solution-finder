# CODEX SYNC：manufacturing.html 參考案例 Phase 1 v2

日期：2026-06-26
Branch：`feature/inline-expand-multiple-solutions`
PR：https://github.com/Pcc329/solution-finder/pull/81

## 任務

依 `spec_reference_cases_phase1_20260626 (2).md` 更新參考案例 Phase 1。

## 修改檔案

- `public/manufacturing.html`

## referenceCases 常數宣告位置

位置：`public/manufacturing.html` 的 `<script>` 區塊內，`agentSteps` 後、`let allSolutions = []` 前。

本次將 `referenceCases` 從 3 筆擴充為 30 筆，涵蓋：

- 製造
- 醫療
- 零售
- 服務業
- 物流
- 旅遊住宿
- 金融
- 教育
- 電商
- 建築營造
- 餐飲

## 區塊位置

依 v2 規格調整為：

- 推薦方案清單下方
- `resultView` 結尾前
- 初始狀態仍為 `display:none`

## renderReferenceCases() 說明

`renderReferenceCases()` 會：

1. 依 `selectedReferenceCaseIndustry` 過濾 `referenceCases`
2. 顯示 `referenceCasesCard`
3. 更新案例數量 chip
4. 產生產業篩選 chip
5. 渲染案例卡片
6. 若無符合案例，顯示「目前無此產業的參考案例」

產業篩選 chip 改為由資料自動產生：

```javascript
const referenceCaseFilterOptions = ["全部", ...new Set(referenceCases.map(item => item.industry))];
```

## 卡片 UI

每張案例卡顯示：

- 案例名稱
- 產業 chip：綠色
- 方案類型 chip：藍色
- 規模 chip：灰色
- 右上角公開等級：公開 / 內部可看，含 icon
- 導入痛點
- 導入成果：綠色小標 + 成果文字

案例卡左側色條：

```css
border-left: 3px solid #185FA5;
```

## 顯示 / 隱藏觸發點

- `renderResult()`：推薦結果產生後呼叫 `renderReferenceCases()`
- `resetAgent()`：呼叫 `hideReferenceCases()`，重置篩選並隱藏
- `clearAllFiles()`：呼叫 `hideReferenceCases()`，重置篩選並隱藏

## 驗收標準確認

- [x] 參考案例區塊位於推薦方案下方
- [x] 案例卡包含名稱、產業、規模、方案類型、公開等級、痛點、成效
- [x] 左側色條為藍色 `#185FA5`
- [x] 產業篩選 chip 可切換
- [x] 未產生推薦前區塊隱藏
- [x] 重新分析或清除文件後區塊隱藏並重置篩選
- [x] 不新增任何 API 或 Airtable 串接
- [x] 不影響推薦方案排序與分類篩選邏輯
- [x] 不影響複數行內展開功能

## 未修改

- 未新增或修改 `/api/`
- 未修改 `scoreSolution`
- 未修改 `getRecommendations`
- 未修改 `officialPrograms`
- 未修改 `buildCategoryFilter`
- 未修改 `applyCategoryFilter`
- 未修改 `expandedIds`
- 未修改 `toggleInlineDetail`
- 未修改 `description_short / ds`
- 未修改 `<script>` 標籤屬性

## 驗證

- `public/manufacturing.html` inline script `new Function()` 語法檢查：通過
- `referenceCases title count`：30
- `git diff --check -- public/manufacturing.html`：通過
- `node --check api/manufacturing-recommend.js`：通過

