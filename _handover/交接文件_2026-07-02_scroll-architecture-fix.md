# 交接文件｜2026-07-02 小螢幕捲動架構修正完整記錄

---

## 一、今日事項總覽

延續 7/1 的小螢幕左欄修正（分支 `fix-small-screen-layout-codex`，已 merge），今天處理後續發現的問題：右欄 sticky 卡片重疊、以及最終發現的「三層獨立捲動」架構問題。

**最終結論**：拆光所有內部獨立捲動容器，改成**整頁單一捲動**（只由瀏覽器 body/main 負責）。

**Branch**：`fix/analysis-sticky-overlap`（2 個階段、3 個 commit）
**狀態**：已確認可行，待 merge

---

## 二、今日完整歷程

### 階段一：發現右欄 sticky 卡片蓋住推薦列表

**起因**：7/1 上午加的「分析結果卡片 sticky」功能（讓「重新分析」按鈕固定在右欄頂部），在後續左欄捲動修正後產生副作用。

| Commit | 內容 |
|---|---|
| `a2936dc` | 先嘗試修正：保留 `z-index: 10`，在推薦區起點補 `padding-top: 272px` 做間距補償 |
| `01b941b` | **復原**：直接移除 `.analysis-result-sticky` 的 `position: sticky` / `z-index`，移除補償用的 `padding-top`。讓分析結果卡片回到正常文件流 |

**根因**：`position: sticky` 的定位基準是「最近的可捲動祖先」。當外層 `.diagnosis-workspace` 被改造成捲動容器後，sticky 的行為基準跟著改變，導致視覺重疊與非預期的雙捲動區域。與其持續補償，直接復原更乾淨。

### 階段二：發現三層獨立捲動架構，改成整頁單一捲動

**起因**：復原 sticky 後，使用者實測發現「右欄滾動時左欄不動、左欄滾動時右欄不動」，操作體感割裂，明確要求改成「整頁一起捲動，不要任何區塊自己開獨立滾輪」。

**診斷結果**（DevTools 實測祖先鏈）：

| 層級 | Class | overflow-y | scrollableY |
|---|---|---|---|
| 推薦方案標題列 | `flex flex-wrap items-center...` | visible | false |
| 右欄容器 | `.diagnosis-results-panel` | auto | **true** |
| 左右欄外層 | `.diagnosis-workspace` | auto | false（高度剛好打平，非真正可捲）|
| 左欄對話 | `.agent-card .chat-panel` | auto | **true** |

確認存在**兩個真正獨立在捲動的容器**（`.chat-panel` 與 `.diagnosis-results-panel`），彼此互不相干，導致滑鼠移到不同區域滾動時只有局部反應。

**Commit**：`7d8990e`（`fix: remove nested manufacturing scroll containers`）

修正內容（`@media (min-width: 1024px)` 內）：

```css
.diagnosis-workspace {
  /* 移除 height: calc(100vh - 61px - 80px) */
  height: auto;
  /* 移除 overflow-y: auto / overflow-x: hidden */
  overflow: visible;
  align-items: flex-start; /* 原本是 stretch */
}

.diagnosis-input-panel {
  height: auto; /* 原本 height: 100% */
}

.agent-card {
  flex: 0 0 auto; /* 原本 flex: 1 */
  overflow: visible;
}

.agent-card .chat-panel {
  overflow: visible; /* 移除 overflow-y: auto */
  max-height: none;
  height: auto;
}

.diagnosis-results-panel {
  height: auto; /* 原本 height: 100% */
  overflow: visible; /* 移除 overflow-y: auto */
  padding-right: 0;
}
```

**驗證結果**：
- 實測 `internalScrollables: []`（1280×800、1920×1080 皆確認無殘留內部捲動條）
- 官方 5 筆 + 其他 5 筆推薦邏輯不受影響
- 使用者截圖確認畫面恢復正常，UI 可行

---

## 三、關鍵技術筆記（累積自 7/1 + 7/2，避免重踩）

**坑 1：`overflow-x` 與 `overflow-y` 混用會被瀏覽器悄悄轉換**
CSS 規範：兩軸 overflow 值不同、且其中一軸不是 `visible` 時，`visible` 會被瀏覽器 computed style 自動轉成 `auto`。
例：`overflow-y: visible; overflow-x: hidden;` 實際 computed 會變成 `overflow: hidden auto`，等於改了等於沒改。
→ 之後要讓某軸保持 `visible`，兩軸盡量一起處理，不要只改一軸；或用 `overflow: visible`（不分軸）更保險。

**坑 2：真正的裁切邊界常常在更外層的祖先，不是眼前這一層**
花了好幾輪一直調整最內層元素的 overflow，但真正造成「內容整組消失、連捲動條都沒有」的，是再往上一層的祖先容器（`.diagnosis-workspace`）本身設了 `overflow: hidden` + 固定高度。
→ 遇到「內容消失不見」，先用 DevTools 往上一路檢查祖先鏈的 overflow / height 設定，別只改眼前這一層。

**坑 3：`position: sticky` 的定位基準會隨捲動架構改變而跟著變**
Sticky 元素是相對於「最近的可捲動祖先」定位。當外層捲動架構調整後，原本正常的 sticky 效果會產生非預期的重疊或錯位。
→ 改動捲動架構時，記得一併檢查頁面上所有 `position: sticky` 元素是否受影響。

**坑 4：截圖裁切 ≠ 實際渲染溢出**
中途曾誤判「水平溢出」，因為截圖右側被切到一個字，後來確認是使用者自行裁切截圖邊界，不是瀏覽器實際渲染問題。
→ 看到疑似溢出的截圖，先確認是否為完整視窗畫面，避免誤判方向浪費一輪修正。

**坑 5：「先猜再改」比「先診斷再改」慢很多**
這兩天的教訓：讓 Codex 用 DevTools 先回報實際的 `overflow-y` computed 值、`scrollHeight` vs `clientHeight`（`scrollableY` 判斷），比憑截圖或經驗直接猜測修改快很多，也更準確。
→ 之後遇到版面/捲動類問題，優先要求「先診斷回報數據，不要直接改」。

---

## 四、產品定位確認（重要，影響未來設計決策）

這個頁面（`manufacturing.html` 的診斷區塊）的定位是**診斷流程頁 / 長表單頁 / 報告頁**，不是**左右雙欄後台 dashboard**。

因此「整頁單一捲動」是目前正確且最終的方向。左欄 AI Agent 問答區不會固定在視窗中，會跟著頁面一起捲走——這是刻意的設計結果，不是 bug。

**如果未來需求變成**「左欄要一直固定可操作、右欄可獨立瀏覽」，那會是完全不同的 dashboard 型 layout，需要重新設計，不能在現有架構上微調。

---

## 五、下一步待辦

### 立即要做
- **Merge** `fix/analysis-sticky-overlap` 到 main（PR：https://github.com/Pcc329/solution-finder/pull/new/fix/analysis-sticky-overlap）

### 稍後處理
- **訂閱 CTA bug**（尚未修，另開新 branch）：
  真實 Airtable 資料下，非 case 37-41 的案例展開後沒有出現「訂閱看更多」CTA。
  根本原因：`isFullReferenceCase()` 用 `case_id` 判斷 37–41 這幾個數字 ID，真實資料的 `case_id` 欄位型態跟 stub 資料不同導致誤判。
  問題回報文件：`codex_問題回報_訂閱CTA未顯示_2026-06-30.md`

---

## 六、系統現況

| 項目 | 內容 |
|---|---|
| 線上正式機 | https://solution-finder-gray.vercel.app/manufacturing.html |
| GitHub | https://github.com/Pcc329/solution-finder |
| 方案資料 | 2,322 筆 |
| 案例資料 | 35 筆（5 筆真實 + 30 筆模擬）|
| Claude model | 問答 claude-sonnet-4-5 / 搜尋 claude-haiku-4-5-20251001 |
| 待 merge 分支 | `fix/analysis-sticky-overlap`（sticky 復原 + 三層捲動整合，已驗證可行）|

---

*文件由 Claude 產出，2026-07-02*
*下次開場白：貼上本文件，說明「已 merge/未 merge 捲動修正」+ 下一步任務*
