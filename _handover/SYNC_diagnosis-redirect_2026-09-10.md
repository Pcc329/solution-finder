# SYNC：diagnosis.html 下架並導向 manufacturing.html

日期：2026-09-11

## 改動檔案

- `vercel.json`（唯一功能檔）
  - 新增 Vercel 層級永久 redirect：

```json
{
  "source": "/diagnosis.html",
  "destination": "/manufacturing.html",
  "permanent": true
}
```

採 Vercel redirect，而非修改 `public/diagnosis.html`，因為 server 在傳回舊頁前即回應 redirect；舊網址保留可用，且不會下載或執行已淘汰的互動程式。

## 未修改範圍

- `public/diagnosis.html` 仍保留在 repository，未刪除也未改寫。
- `public/manufacturing.html`、所有 API、rewrites 與 security headers 均未修改。

## 驗證

- `vercel.json` 以 JSON parser 驗證通過。
- Vercel Preview：Ready
  https://solution-finder-5v231cwe5-patrick0814-6136s-projects.vercel.app/
- 實測：
  1. 直接開啟
     `https://solution-finder-5v231cwe5-patrick0814-6136s-projects.vercel.app/diagnosis.html`
  2. 瀏覽器最終網址為
     `https://solution-finder-5v231cwe5-patrick0814-6136s-projects.vercel.app/manufacturing.html`
  3. 最終頁面標題為「方案探索 | Solution Finder」，可見現行「AI分析 幫你找出適合方案」內容。
- PR diff 僅包含本 redirect 設定與本交接文件。

## 驗收清單

- [x] `/diagnosis.html` 導向 `/manufacturing.html`，不是 404 或空白頁。
- [x] `manufacturing.html` 在 redirect 後正常載入。
- [x] 未變更其他頁面或 API。
- [x] 未刪除 `diagnosis.html`。

## Git

- Branch：`chore/redirect-legacy-diagnosis`
- 功能 commit：`19a862a2c6acce53d1fe069387edaa6921c4c6c0 chore: redirect legacy diagnosis page`
- PR：https://github.com/Pcc329/solution-finder/pull/153
