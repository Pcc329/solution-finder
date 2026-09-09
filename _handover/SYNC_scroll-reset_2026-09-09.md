# SYNC：畫面切換時捲動位置歸零

日期：2026-09-09

## 改動檔案

- `public/index.html`（唯一功能檔）
  - 在 `activePage` state 宣告後新增共用 `useEffect`：

```js
useEffect(() => {
  window.scrollTo(0, 0);
}, [activePage]);
```

插入位置為目前檔案第 171–173 行，緊鄰第 170 行的
`const [activePage, setActivePage] = useState("home");`。

## 實作說明

`activePage` 是首頁、列表與詳情三種畫面的共用切換 state。effect 只監控它，因此涵蓋既有所有入口，而不需逐一更動按鈕：

- 方案卡片進入詳情。
- 返回搜尋結果或回首頁。
- 首頁搜尋、快速搜尋及分類瀏覽。
- 瀏覽器上一頁／下一頁對應的 state 切換。

未修改既有七個 `setActivePage(...)` 呼叫點，也未修改 `goToPage` 或 `listTopRef` 的既有分頁捲動行為。

## 驗證

- 靜態檢查：
  - `setActivePage(...)` 呼叫數：改前 7、改後 7。
  - `<script type="text/babel">` 維持原樣。
  - `goToPage` 函式原始內容維持不變。
  - 本 branch 的功能 diff 僅有 `public/index.html`：新增 3 行、刪除 0 行。
- Vercel Preview：Ready
  https://solution-finder-git-fix-scrol-148015-patrick0814-6136s-projects.vercel.app/

### 真實互動驗證狀態

Preview 已實際開啟，但先顯示既有「內部系統登入」密碼頁。為遵守 API authentication Phase 1，未讀取、推測或繞過共用密碼、session 或資料庫內容。因此需登入後才能完成以下三種真實互動與截圖：

- [ ] 列表下捲後點方案卡片，詳情頁回到頂端。
- [ ] 詳情返回列表後，列表頁在頂端。
- [ ] 首頁快速搜尋／瀏覽器上一頁等其他入口也回到頂端。

## 驗收清單

- [x] 以單一 `activePage` effect 覆蓋所有畫面切換入口。
- [x] 未修改七個既有 `setActivePage(...)` 呼叫點。
- [x] 未修改 `listTopRef` 或 `goToPage` 的分頁捲動。
- [x] 未加入任何函式庫或修改 `diagnosis.html`。
- [x] Preview 部署成功。
- [ ] 待已授權登入 Preview 後完成三種互動截圖。

## Git

- Branch：`fix/scroll-reset-2026-09-09`
- 功能 commit：`f96c84e7d6dca22d8bca02edeb5cc50ec79cfeab fix: reset scroll position on page changes`
- PR：https://github.com/Pcc329/solution-finder/pull/151
