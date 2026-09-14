# CSP 外部資源盤點

- 日期：2026-09-14
- 範圍：`public/` 下全部 HTML 與 JavaScript 檔案
- 掃描基準：`main` @ `98aa5212f861ab21d659e517a625e6e51753c71f`
- 本文件是 CSP 第二波啟用前的盤點與 Report-Only 草稿；**未修改** `vercel.json`、HTTP 標頭或任何前端資源引用。

## 掃描方法

已逐一檢查以下 10 個檔案：

```text
public/auth-gate.js
public/company-avatar.js
public/compare.html
public/dashboard.html
public/diagnosis.html
public/feedback.html
public/index.html
public/manufacturing.html
public/sources.html
public/strategy-guide.html
```

靜態搜尋涵蓋：

- HTML 的 `<script src>`、`<link rel="stylesheet">`、`<iframe>`、`<img src>`
- CSS 的 `@import`
- JavaScript 的 `fetch()`、`XMLHttpRequest`、`WebSocket`、`EventSource`、動態 `import()`
- 動態節點建立，例如 `document.createElement('script')`、`appendChild()`
- 寫入 HTML 的資源 URL、公司 Logo URL 正規化與案例圖片路徑

相對路徑和 `/api/*` 同源端點不列為外部網域。

## script-src

| 網域 | 用途 | 發現位置 | 共用範圍 |
|---|---|---|---|
| `https://cdnjs.cloudflare.com` | Marked、DOMPurify、Chart.js、D3 | `compare.html:9-10`、`dashboard.html:9-10`、`diagnosis.html:10`、`index.html:16,19-20`、`manufacturing.html:12`、`strategy-guide.html:9` | 多頁面共用 |
| `https://cdn.tailwindcss.com` | Tailwind CDN runtime | `diagnosis.html:9`、`index.html:15`、`manufacturing.html:10` | 多頁面共用 |
| `https://unpkg.com` | React UMD、ReactDOM UMD、Babel Standalone | `index.html:17-18,21` | 單一頁面獨有 |
| `https://cdn.jsdelivr.net` | Marked | `manufacturing.html:11` | 單一頁面獨有 |

補充：各 HTML 檔含有 inline `<script>`，`index.html` 也使用 Babel Standalone 編譯 `text/babel`。現階段 Report-Only 草稿須保留 `'unsafe-inline'`；Babel Standalone 的執行行為也需要先以 Report-Only 驗證是否必須保留 `'unsafe-eval'`。

## style-src

| 網域 | 用途 | 發現位置 | 共用範圍 |
|---|---|---|---|
| `https://cdnjs.cloudflare.com` | Font Awesome CSS | `diagnosis.html:10`、`index.html:16`、`manufacturing.html:12` | 多頁面共用 |

所有頁面另含 inline `<style>` 或 `style` 屬性；`auth-gate.js` 也會動態插入一段 inline `<style>`。因此現有架構下 Report-Only 草稿需要 `style-src 'unsafe-inline'`。

未發現 Google Fonts 或任何 CSS `@import`。

## font-src

| 網域 | 用途 | 發現位置 | 共用範圍 |
|---|---|---|---|
| `https://cdnjs.cloudflare.com` | Font Awesome CSS 所引用的 webfont | `diagnosis.html:10`、`index.html:16`、`manufacturing.html:12` | 多頁面共用 |

## connect-src

| 網域 | 用途 | 發現位置 | 共用範圍 |
|---|---|---|---|
| `https://raw.githubusercontent.com` | 台灣 GeoJSON 地圖資料 | `dashboard.html:2775` | 單一頁面獨有 |

其餘前端 `fetch()` 都是同源端點，包括 `/api/solutions`、`/api/stats`、`/api/cases`、`/api/companies`、`/api/ask`、`/api/claude`、`/api/feedback`、`/api/manufacturing-*`、`/api/company-detail`、`/api/login` 與 `/api/session-check`，由 `'self'` 覆蓋。

未發現瀏覽器端直接連 Supabase、Airtable、GitHub API、Vercel API、WebSocket 或 EventSource 的程式碼。

## img-src

| 網域／來源 | 用途 | 發現位置 | 共用範圍 |
|---|---|---|---|
| 同源 `case-images/` | 案例縮圖與 Lightbox 圖片 | `manufacturing.html:744-768` | 單一頁面獨有 |
| 動態 `http:`／`https:` Logo URL | 公司 Logo；URL 由 API 資料的 `logo_url` 提供，`company-avatar.js` 僅接受 HTTP(S) | `company-avatar.js:20-28,46-51`，由 `manufacturing.html:1048,1819` 呼叫 | 多頁面可共用 helper，目前製造業頁使用 |

靜態碼沒有硬編碼任何外部圖片網域。公司 Logo 是資料驅動 URL，靜態掃描無法列出有限白名單；目前 helper 接受任意 HTTP(S) 主機。正式 CSP 收斂前，應在已登入的各頁面以 DevTools Network 匯出實際 Logo 主機清單，再將 `img-src` 從暫時性的協定白名單縮減為實際網域。

## frame-src

未發現 `<iframe>`、第三方 frame embed 或動態建立 iframe。因此草稿可先設為 `frame-src 'none'`。

## 非資源載入的外部導覽連結

`sources.html` 有外部 `<a>` 導覽連結，但它們不會透過 CSP 的 `script-src`、`style-src`、`connect-src`、`img-src` 或 `frame-src` 載入資源，不應誤加入本次白名單：

```text
keid.nat.gov.tw
agdigi.atri.org.tw
www.smeai.tw
startup.sme.gov.tw
www.smebiz.org.tw
gsmarket.adi.gov.tw
ntpc-ai.ntpc.gov.tw
www.economic.ntpc.gov.tw
```

位置：`public/sources.html:623-625,648,671,709,732,755,778-779`。

## CSP Report-Only 建議草稿

以下為現階段的保守草稿，僅供審閱，**不得直接寫入** `vercel.json` 或部署設定：

```http
Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://cdn.tailwindcss.com https://unpkg.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com; connect-src 'self' https://raw.githubusercontent.com; img-src 'self' http: https:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'
```

### 草稿取捨

- `'unsafe-inline'`：現有多頁 inline script、inline style、事件屬性與動態插入樣式尚未 nonce/hash 化。
- `'unsafe-eval'`：先為瀏覽器端 Babel Standalone 保留，必須在 Report-Only 期觀察 violation 後再決定能否移除。
- `img-src http: https:`：只為維持 API 資料驅動的公司 Logo；此為暫時寬鬆設定，待實測蒐集實際 Logo 網域後應縮小。
- `frame-src 'none'`：目前沒有 iframe 依賴。
- 未設定回報端點：尚未定義 CSP report collector，因此本草稿不含 `report-uri` 或 `report-to`；正式 Report-Only 上線前需先決定違規報告接收方式。

## 盤點侷限與後續驗證

本次是對儲存庫 `public/` 原始碼的靜態盤點，不等同於執行期 Network trace，可能遺漏：

1. API 回傳的 `logo_url` 所帶出的外部圖片網域。
2. CDN runtime、瀏覽器擴充功能或資料內容在執行期追加的請求。
3. 條件式互動才觸發的請求，例如製造業頁上傳、AI 分析與推薦流程。
4. CSP 對 Babel Standalone 的 `eval` 行為與 inline event handler 的細節。

CSP 第二波的下一步應先以本草稿開啟 Report-Only，搭配各頁已登入流程、搜尋、圖表、公司 Logo、問答、文件上傳與案例 Lightbox 的 DevTools Network/Console 實測，收集 violation 後再收斂為正式政策。
