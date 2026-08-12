# SYNC：首頁 AI 搜尋瀏覽器上一頁修正

- 日期：2026-08-12
- Branch：`fix/index-history-api-2026-08-12`
- PR：[PR #122](https://github.com/Pcc329/solution-finder/pull/122)
- 實作 commit：`9260e5f615b420b66d35a419a09d952b8bb1ed1c`

## 改動範圍

僅修改 `public/index.html`；沒有修改 API、篩選、比較、ROI、AI 問答或 `manufacturing.html`。

| 位置 | 變更 |
| --- | --- |
| 188–192 | `pushHistoryView(view)`：以 `#list`／`#detail` 建立 history entry，若已在同一 view 則不重複 push。 |
| 194–196 | `goBackInApp()`：detail/list 的頁內返回統一呼叫 `window.history.back()`。 |
| 198–217 | 掛載時檢查 `#list`／`#detail`，以 `history.replaceState({}, "", location.pathname)` 清除無 state 的直連 hash；並註冊 `popstate`。 |
| 306 | `handleSearch()` 完成後建立 `list` history。 |
| 318 | `handleQuickSearch()` 建立 `list` history。 |
| 1019 | 搜尋結果卡開啟方案詳細頁時建立 `detail` history。 |
| 1122 | 「返回搜尋結果」改呼叫 `goBackInApp`。 |
| 1232 | 品牌區改呼叫 `goBackInApp`。 |

## 關鍵邏輯

```js
window.history.pushState({ view }, "", `#${view}`);
```

```js
if (event.state?.view === "list") {
  setSelectedItem(null);
  setActivePage("list");
  return;
}
setSelectedItem(null);
setActivePage("home");
```

```js
if (hash === "#list" || hash === "#detail") {
  window.history.replaceState({}, "", window.location.pathname);
}
```

`popstate` handler 沒有呼叫任何 API，也沒有改動 `filters`、`query`、`currentPage` 或 `sortBy`。

## Preview 驗證

Preview：
https://solution-finder-git-fix-index-cbc93a-patrick0814-6136s-projects.vercel.app/

測試時 `/api/solutions` 載入 **2,485** 筆方案。

### 範例 A：瀏覽器上一頁

1. 首頁點「AI 客服方案」。
2. 進入 `#list`，該次測試顯示 73 筆結果。
3. 開啟第一張方案，進入 `#detail`。
4. 按瀏覽器上一頁：回到 `#list`，仍是同一組 73 筆結果，沒有 loading 或篩選重置。
5. 再按瀏覽器上一頁：回到 home，hash 清空。
6. 此時沒有 app 內 history entry；下一次瀏覽器上一頁由原生瀏覽器處理，會離開網站。

另以另一組 12 筆搜尋結果驗證頁內按鈕：
- 詳細頁「返回搜尋結果」回到同一組 12 筆 list。
- list 的品牌區回到 home。
- Console 無 error。

### 範例 B：直接帶 hash 進站

| 輸入網址 | 結果 |
| --- | --- |
| `/#detail` | `replaceState` 清除 hash，顯示 home，沒有 detail 白屏。 |
| `/#list` | `replaceState` 清除 hash，顯示 home，沒有 list 狀態錯亂。 |

## 驗收清單

- [x] detail → list → home 依序由瀏覽器上一頁處理。
- [x] 回到 list 保留既有結果與篩選 state。
- [x] 頁內返回按鈕與品牌區走同一 history 路徑。
- [x] 直連 `#list`／`#detail` 安全回到 home。
- [x] 不重複 push 同一個 view。
- [x] 未改動 API 或其他功能頁面。
- [x] Preview Console 無 application error。
