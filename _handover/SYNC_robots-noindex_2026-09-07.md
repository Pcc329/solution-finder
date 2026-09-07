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
- Preview 部署完成後應確認 `/robots.txt` 回傳上述兩行內容。

## Git

- Branch：`robots-noindex-2026-09-07`
- Commit：待建立
- PR：待建立
