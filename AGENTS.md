# Solution Finder — Codex 工作說明書

## 專案概述
台灣資服業者方案查詢系統，iii 內部使用。
架構：純 HTML + Vanilla JS + Vercel Serverless Functions（Node.js ESM）。
非 Next.js，非 React，非 TypeScript。

## GitHub & 部署
- Repo：https://github.com/Pcc329/solution-finder
- 部署：Vercel，push main → 自動上線
- 現有功能網址：https://solution-finder-gray.vercel.app

## 資料庫（Airtable）
- Base ID: appttP04OnzzC7qxG
- Solutions Table: tblqQkVQ4dSo7xgoE（約 2,069 筆方案）
- Companies Table: tblkOaOBGK96vfRm1（約 784 筆業者）
- API Token 環境變數名稱：process.env.AIRTABLE_TOKEN
- Claude API 環境變數名稱：process.env.ANTHROPIC_API_KEY
- Claude Model：claude-sonnet-4-5

## 欄位縮寫對照（api/solutions.js 回傳格式）
id=方案ID s=方案名 c=公司名 cid=統編
p=方案類型 ai=是否AI(bool) d=目標產業
cat=類別 iv=產業垂直 pr=價格(數字) pt=費用級距
mo=月費 mt=月費級距 r=地區 st=是否新創(bool)
city=城市 desc=說明 feat=功能列表 tags=技術標籤
scale=目標規模 slogan=標語

## 強制規範（違反會導致功能壞掉）
1. 每個 api/*.js 開頭必須加：
   res.setHeader('Access-Control-Allow-Origin', '*');
   res.setHeader('Access-Control-Allow-Methods', 'GET');
2. Airtable 撈取必須用分頁 while loop（pageSize=100），禁止單次撈取
3. 禁止修改 api/solutions.js（現有搜尋功能，勿動）
4. 新 API 檔案放 api/，新頁面放 public/
5. 外部 JS 套件只能用 CDN（cdnjs.cloudflare.com）
6. export default async function handler(req, res) 格式

## 費用欄位注意
- price（pr）為數字，195 筆空值，統計時需排除 null
- price_tier（pt）有 859 筆空值，顯示時需標注有效筆數
- service_region 格式為複合字串「北北基,桃竹苗,中彰投」，47% 空值
- Companies.city 有「台北市」與「臺北市」兩種寫法，需正規化

## 待開發功能（依優先序）
1. api/stats.js + public/dashboard.html（儀表板）
2. 方案並排比較（前端功能）
3. api/ask.js（LLM 問答）
4. api/compare.js（AI 比較摘要）
5. 台灣地圖（D3.js choropleth）
6. 交叉分析（Recharts）
