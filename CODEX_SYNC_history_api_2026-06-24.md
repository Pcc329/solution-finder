# CODEX SYNC：製造業詳細頁 History API

日期：2026-06-24  
分支：`feat-diagnosis-agent-v1`  
功能 Commit：`abe2524` (`Support browser back from manufacturing detail`)

## 修改範圍

- 檔案：`public/manufacturing.html`
- 修改函式：
  - `openDetail()`
  - `backToResult(fromPopstate)`
- 初始化區新增：
  - `#detail` hash 清理
  - `popstate` 監聽

未修改任何 API、推薦排序、分類篩選、方案卡片及 script 標籤。

## openDetail() / pushState

```javascript
if (location.hash !== "#detail") {
  history.pushState({ view: "detail" }, "", "#detail");
}
```

開啟方案詳細頁時新增一筆 `#detail` history。  
先檢查目前 hash，避免重複呼叫 `openDetail()` 時堆疊多筆 detail 紀錄。

## backToResult(fromPopstate) / replaceState

```javascript
function backToResult(fromPopstate = false) {
  currentView = "result";
  selectedSolution = null;
  updateView();
  if (!fromPopstate && location.hash === "#detail") {
    history.replaceState({ view: "result" }, "", location.pathname);
  }
  window.scrollTo(0, 0);
}
```

- 使用者點「返回分析結果」時，`fromPopstate` 為 `false`。
- 此時使用 `replaceState` 清除 `#detail`，不再新增 history。
- 瀏覽器上一頁觸發時傳入 `true`，略過 history 操作，避免在 `popstate` 中再次修改紀錄。

## popstate 監聽

註冊位置位於兩個上傳區 `bindUpload()` 完成後、`resetAgent(false)` 初始化前：

```javascript
window.addEventListener("popstate", () => {
  if (currentView === "detail") {
    backToResult(true);
  }
});
```

瀏覽器回到上一筆 history 時，詳細 view 切回結果 view。  
結果 DOM 未被重建，因此分析結果與分類篩選狀態保留。

## 初始化 hash 清理

```javascript
if (location.hash === "#detail") {
  history.replaceState({}, "", location.pathname);
}
```

重新整理或直接開啟帶有 `#detail` 的網址時，先清除 hash，再執行正常頁面初始化。

## 驗證情境

狀態機測試：

1. 初始網址 `/manufacturing.html`。
2. 點方案卡片後變為 `/manufacturing.html#detail`。
3. 重複呼叫詳細頁開啟邏輯，history 仍只有一筆 `#detail`。
4. 按瀏覽器上一頁，網址回到 `/manufacturing.html`，`currentView` 回到 `result`。
5. 再次開啟詳情並點畫面上的「返回分析結果」，hash 被 `replaceState` 清除。

推送後可在 Vercel Preview 使用實際方案卡片確認相同行為。

## 驗證結果

- `git diff --check -- public/manufacturing.html`：通過
- `public/manufacturing.html` inline script `new Function()` 語法檢查：通過
- History 狀態機測試：通過

## Git

- Branch：`feat-diagnosis-agent-v1`
- 功能 Commit：`abe2524`
- Remote：`origin/feat-diagnosis-agent-v1`
- PR：https://github.com/Pcc329/solution-finder/pull/new/feat-diagnosis-agent-v1

