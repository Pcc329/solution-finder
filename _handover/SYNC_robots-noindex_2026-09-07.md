# SYNC: robots 與 noindex

日期：2026-09-07

## 改動

- 新增 `public/robots.txt`：
  ```text
  User-agent: *
  Disallow: /
  ```
- 以下 8 個頁面均在 `<head>` 加入 `<meta name="robots" content="noindex, nofollow">`：
  - `public/index.html`
  - `public/compare.html`
  - `public/dashboard.html`
  - `public/diagnosis.html`
  - `public/feedback.html`
  - `public/manufacturing.html`
  - `public/sources.html`
  - `public/strategy-guide.html`

## 盤點與驗證

- `public/*.html` 共 8 個檔案；robots meta 共找到 8 處。
- 專案內沒有 `sitemap.xml`，因此沒有 sitemap 設定被修改或移除。
- `git diff --check`：通過。
- Preview 驗證：`https://solution-finder-8iu2gr3sp-patrick0814-6136s-projects.vercel.app/robots.txt` 回傳 HTTP 200、`Content-Type: text/plain; charset=utf-8`，內容為上述兩行；Vercel 回應同時含 `X-Robots-Tag: noindex`。

## Git

- Branch：`robots-noindex-2026-09-07`
- Commit：`de5051b chore(seo): add robots noindex`
- PR：https://github.com/Pcc329/solution-finder/pull/145
