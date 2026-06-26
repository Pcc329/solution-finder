# CODEX SYNC：參考案例展開區塊橫列式版面

日期：2026-06-26
Branch：`feature/inline-expand-multiple-solutions`
PR：https://github.com/Pcc329/solution-finder/pull/81

## 任務

依 `spec_case_expand_layout_20260626.md`，將 `public/manufacturing.html` 的參考案例 inline expand 展開內容改為橫列式版面。

## 修改檔案

- `public/manufacturing.html`

## getReferenceCaseDetailHtml() 修改說明

原本使用 `.inline-detail` 加 2 欄 grid：

- 顧問診斷結論
- 推動阻力
- 化解方法
- 可複製條件

本次改成橫列式：

- 每個欄位一列
- 每列包含 icon、label、text
- 最後一列套用 `ref-case-detail-row-last`，移除底部分隔線
- 動畫仍沿用 `inlineDetailIn 160ms ease-out`

## 新增 CSS class

- `.ref-case-detail`
- `.ref-case-detail.no-animation`
- `.ref-case-detail-row`
- `.ref-case-detail-row-last`
- `.ref-case-detail-icon`
- `.ref-case-icon-diag`
- `.ref-case-icon-resist`
- `.ref-case-icon-resolve`
- `.ref-case-icon-replic`
- `.ref-case-detail-label`
- `.ref-case-detail-text`

## icon 使用方式

目前 `manufacturing.html` 沒有載入 Tabler icons，因此依規格 fallback 使用文字符號：

- `📋`：顧問診斷結論
- `⚠️`：推動阻力
- `✅`：化解方法
- `🔁`：可複製條件

## 驗收標準確認

- [x] 展開區塊為橫列式，四個欄位各佔一列
- [x] 每列有彩色 icon + 標籤 + 內文
- [x] PC 與手機均可用同一版面，不需要 media query
- [x] 最後一列無下分隔線
- [x] 動畫沿用 `inlineDetailIn`
- [x] 不影響 `expandedReferenceCaseTitle` 展開/收起邏輯
- [x] 不影響產業篩選邏輯
- [x] 不影響推薦方案的 `expandedIds` 邏輯

## 未修改

- 未修改 `/api/`
- 未修改 `scoreSolution`
- 未修改 `getRecommendations`
- 未修改 `officialPrograms`
- 未修改推薦方案的 `expandedIds`
- 未修改推薦方案的 `toggleInlineDetail`
- 未修改 `referenceCases` 常數內容
- 未修改 `<script>` 標籤屬性

## 驗證

- `public/manufacturing.html` inline script `new Function()` 語法檢查：通過
- `git diff --check -- public/manufacturing.html`：通過

