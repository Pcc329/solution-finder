# SYNC — CSP 外部資源盤點

- 日期：2026-09-14
- 分支：`docs/csp-resource-inventory-2026-09-14`
- 盤點文件：[csp_resource_inventory_20260914.md](../csp_resource_inventory_20260914.md)
- 盤點文件提交：`e33dfa2fd6f5daa33bec22584b1d73e06650484c`
- PR：https://github.com/Pcc329/solution-finder/pull/154

## 完成內容

已建立 CSP 第二波啟用前的外部資源盤點文件。此 PR 只新增文件，不修改 `vercel.json`、HTTP CSP 標頭、前端資源引用或 API。

## 掃描方法

以 `main` 的 `public/` 目錄為基準，逐一掃描 10 個 HTML／JS 檔案：

- 外部 `<script src>`、stylesheet、`@import`、圖片與 iframe。
- `fetch()`、XHR、WebSocket、EventSource、動態 `import()`。
- 動態建立的 script/link/iframe 節點與資料驅動 URL。

同源 `/api/*` 與相對路徑不列入外部來源。

## 盤點摘要

| CSP 類別 | 靜態找到的外部網域數 | 結果 |
|---|---:|---|
| `script-src` | 4 | `cdnjs.cloudflare.com`、`cdn.tailwindcss.com`、`unpkg.com`、`cdn.jsdelivr.net` |
| `style-src` | 1 | `cdnjs.cloudflare.com` |
| `font-src` | 1 | `cdnjs.cloudflare.com` |
| `connect-src` | 1 | `raw.githubusercontent.com` |
| `img-src` | 0 個可靜態列舉的外部網域 | 公司 Logo 的 `logo_url` 接受 API 資料提供的任意 HTTP(S) URL，需執行期 Network 追蹤收斂 |
| `frame-src` | 0 | 未發現 iframe |

完整檔案位置、行號、共用／單頁分類、非 CSP 資源的外部導覽連結，以及 Report-Only CSP 草稿均已收錄在盤點文件。

## 侷限與下一步

靜態掃描不會得知 API 回傳的公司 Logo 實際主機，也無法完整覆蓋需互動才觸發的請求。文件已明確要求下一步在 Report-Only 模式配合各頁功能以 DevTools Network/Console 實測，並先收集實際 Logo 網域與 CSP violations，再考慮正式啟用。

## 驗證

- 已確認變更只新增：
  - `csp_resource_inventory_20260914.md`
  - `_handover/SYNC_csp-resource-inventory_2026-09-14.md`
- 未變更任何執行期程式碼或部署設定；`node --check` 不適用於純 Markdown 文件。
