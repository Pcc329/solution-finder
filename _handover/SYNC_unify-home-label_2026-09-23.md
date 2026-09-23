# SYNC: 統一「回到首頁」文字標籤

日期：2026-09-23

## 改動範圍

僅修改 `public/index.html` 主題區詳情頁返回連結的一行顯示文字。

改前：

```jsx
<i className="fa-solid fa-arrow-left"></i> 返回首頁
```

改後：

```jsx
<i className="fa-solid fa-arrow-left"></i> 回到首頁
```

`onClick={resetToHome}` 與原有 class 完整保留，`public/manufacturing.html` 未修改。

## 驗證

- Preview：https://solution-finder-git-fix-unify-b81229-patrick0814-6136s-projects.vercel.app/
- 進入「生產物流」主題詳情頁，畫面顯示「回到首頁」。
- 點擊「回到首頁」後，一次直接回到首頁，確認仍呼叫既有 `resetToHome` 行為。
- 對分支完整 `public/` 執行 `git grep -n "返回首頁" ... -- public`，結果為 `NO_MATCH_IN_PUBLIC`。
- PR patch 確認功能改動只有上述一行文字，未變更事件或樣式。
- 驗收畫面已於本次 Preview 瀏覽器驗證中擷取，呈現主題詳情頁左上方「回到首頁」。

## 驗收清單

- [x] 主題區詳情頁顯示「回到首頁」
- [x] 與搜尋結果頁用字一致
- [x] 點擊仍透過 `resetToHome` 直接回首頁
- [x] `public/` 無「返回首頁」殘留
- [x] `public/manufacturing.html` 未受影響

## Git 資訊

- Branch：`fix/unify-home-label-2026-09-23`
- 功能 commit：`6cd50144c9702ebbdab571d5b61622b4d25dd3bd`
- PR：https://github.com/Pcc329/solution-finder/pull/171
