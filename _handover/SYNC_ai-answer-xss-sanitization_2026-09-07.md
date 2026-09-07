# SYNC: AI 回答 XSS 消毒

日期：2026-09-07

## 改動範圍

- `public/index.html`
  - 在既有 `marked` CDN 後載入 DOMPurify 3.1.6。
  - 將 AI 問答的 `marked.parse(askAnswer)` 改為 `DOMPurify.sanitize(marked.parse(askAnswer))` 後才交給 `dangerouslySetInnerHTML`。
- `public/compare.html`
  - 在既有 `marked` CDN 後載入 DOMPurify 3.1.6。
  - 將 AI 比較結果的 `marked.parse(data.answer || '')` 改為 `DOMPurify.sanitize(marked.parse(data.answer || ''))` 後才設定 `innerHTML`。

未修改 `public/manufacturing.html`。

## 全站 marked.parse 盤點

`rg -n "marked\\.parse" public` 的結果：

1. `public/index.html`：已消毒的 AI 問答輸出。
2. `public/compare.html`：已消毒的 AI 比較輸出。
3. `public/manufacturing.html`：`renderMarkdown()` 內的未呼叫死代碼；依規格保留不動。

## 驗證

- `git diff --check`：通過。
- `public/compare.html` 內嵌 JavaScript 經 `node --check`：通過。
- 兩個會將 AI 回答轉為 HTML 的正式渲染點都先經過 `DOMPurify.sanitize()`；因此 `<script>` 標籤與 `onerror` 等事件屬性會在寫入 DOM 前被移除，同時保留 marked 產出的粗體、清單與連結等安全 Markdown HTML。
- 瀏覽器隔離的惡意字串模擬頁受瀏覽器 URL 政策阻擋，未以替代方式繞過；待 Preview 部署後以正式頁面確認正常載入與互動。

## Git

- Branch：`fix/ai-answer-xss-sanitization-2026-09-07`
- Commit：待建立
- PR：待建立
