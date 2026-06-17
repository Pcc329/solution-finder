# Solution Finder — Codex 工作說明書

## 專案概述
台灣資服業者方案查詢系統，iii 內部使用。
架構：純 HTML + Vanilla JS + Vercel Serverless Functions（Node.js ESM）。
非 Next.js，非 React Framework，非 TypeScript。
index.html 例外使用 React UMD + Babel standalone（瀏覽器端編譯）。

## GitHub & 部署
- Repo：https://github.com/Pcc329/solution-finder
- 部署：Vercel，push main → 自動上線
- 現有功能網址：https://solution-finder-gray.vercel.app

## 資料庫（Airtable）
- Base ID: appttP04OnzzC7qxG
- Solutions Table: tblqQkVQ4dSo7xgoE（約 2,322 筆方案）
- Companies Table: tblkOaOBGK96vfRm1（約 840 筆業者）
- API Token 環境變數名稱：process.env.AIRTABLE_TOKEN
- Claude API 環境變數名稱：process.env.ANTHROPIC_API_KEY
- Claude Model（問答）：claude-sonnet-4-5
- Claude Model（搜尋/對話）：claude-haiku-4-5-20251001

## 欄位縮寫對照（api/solutions.js 回傳格式）
id=方案ID s=方案名 c=公司名 cid=統編
p=方案類型 ai=是否AI(bool) d=目標產業
cat=類別 iv=產業垂直 pr=價格(數字) pt=費用級距
mo=月費 mt=月費級距 r=地區 st=是否新創(bool)
city=城市 desc=說明 feat=功能列表 tags=技術標籤
scale=目標規模 slogan=標語

---

## ⛔ 最高禁令（違反必定導致功能損壞）

### API 禁區
1. **禁止修改 `api/solutions.js`**：語意搜尋核心，任何改動都會壞掉
2. **禁止修改 `api/ask.js`、`api/claude.js`、`api/stats.js`**：已上線功能，勿動
3. **禁止在前端 hardcode API Key**：一律走後端 api/*.js，金鑰只放環境變數

### index.html 禁區
4. **禁止修改 `<script type="text/babel">` 標籤**：不得新增任何屬性（包括 data-type、data-presets 等），此標籤維持最簡形式，否則白屏
5. **index.html 使用 React UMD + Babel standalone**：不能用 ES module import，JSX runtime 必須維持 classic 模式

### Airtable 禁區
6. **禁止用 filterByFormula 篩選中文 Single Select 值**：中文值不可靠，一律 fetch 全量資料再用 JS 過濾
7. **禁止修改 Airtable 資料結構**（除非任務明確要求）

### 資料禁區
8. **program_type 值請使用最新名稱**：SME AI平台（非 SEMI平台）、雲市集工業館、商業服務業專區

---

## 強制規範

### API 開發規範
- 每個 `api/*.js` 開頭必須加 CORS header：
  ```js
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  ```
- Airtable 撈取必須用分頁 while loop（pageSize=100），禁止單次撈取
- 新 API 檔案放 `api/`，新頁面放 `public/`
- 外部 JS 套件只能用 CDN（優先 cdnjs.cloudflare.com）
- 格式：`export default async function handler(req, res)`

### 已知資料異常（排除用）
- 國眾電腦：capital = 2147483647（整數溢位），推算相關功能需排除
- 馬太網路科技：capital = null，推算相關功能需排除

### Airtable Multiple Select 寫入
- 值必須傳陣列格式：`["全台灣"]`，不能傳字串

### BOM 字元問題
- Airtable API 回傳欄位名稱前可能有 `\ufeff`
- 讀取時需：`k.replace('\ufeff', '')`

---

## 欄位資料品質備忘
- service_region：48% 空值，複合字串格式「北北基,桃竹苗」
- price_tier：42% 空值
- Companies.city：「台北市」與「臺北市」兩種寫法需正規化
- employee_range_estimated：資本額推算，準確率約 60.8%

---

## 頁面清單
| 檔案 | 說明 |
|---|---|
| index.html | 主頁（React UMD + Babel standalone） |
| dashboard.html | 戰情儀表板 |
| compare.html | 方案比較 |
| diagnosis.html | 智能方案探索（AI Agent） |
| manufacturing.html | 製造業方案探索 |
| strategy-guide.html | 策略智庫 |
| sources.html | 資料來源 |

---

*最後更新：2026-06-17*
