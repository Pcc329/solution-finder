# SYNC: 方案信任訊號顯示

- 日期：2026-09-16
- 分支：`feat/solution-trust-signals-2026-09-16`
- 基底：`main` @ `d34b23398355094cfe6cc07301581abb5a5fa1eb`

## 修改範圍

1. `api/solutions.js`
   - 僅 Supabase 路徑在既有 `Promise.all` 加入四個讀取：`gov_registrations`、`company_cdm_categories`、`cases`（僅 `provider_linked_company_id` 非空）、`awards`。
   - 前三者分別轉為以正規化公司統編為 key 的 `Set`；重複列不會重複計分。
   - `awards` 以 `awardTierByCid` Map 彙整，層級優先序為 `國際級` > `國家級` > `產業級`；未知或空白分類仍保留獲獎事實，但 `awdTier` 回傳 `null`。
   - Supabase 每筆方案新增 `gov`、`cdm`、`cs`、`awd`、`awdTier`。
   - Airtable 路徑不新增查詢，固定回傳 `false` / `null`，維持既有資料來源行為。

2. `public/manufacturing.html`
   - 搜尋結果卡片顯示官方認證、資安分級、獲獎肯定三種 badge；案例實績不放列表，避免卡片資訊過密。
   - 行內展開詳情與保留的全頁詳情共用「信任驗證」區塊，四列狀態永遠可見。無資料或尚未通過時顯示中性「累積中」，不顯示紅色叉號。
   - 分數依規格計算：前三項固定納入分母，案例實績僅在 `cs === true` 時納入；全部通過才顯示綠色圓形指標。

## 靜態驗證

- 以 JavaScript parser 檢查 `api/solutions.js`：通過。
- 以 JavaScript parser 檢查 `manufacturing.html` 的內嵌腳本：通過。
- 待 Vercel Preview 完成後，將補上真實 `/api/solutions` 回應與信任訊號驗證結果。

## 未修改項目

- 未修改 Airtable `Solutions` 查詢流程或排序/評分邏輯。
- 未修改任何 Supabase 資料表、DDL、快取設定、`scoreSolution`、`getRecommendations` 或 `officialPrograms`。

## Preview 部署與動態驗證狀態

- Vercel Preview：`https://solution-finder-git-feat-solu-7e85d0-patrick0814-6136s-projects.vercel.app`，部署狀態 Ready。
- 未登入的 Preview 瀏覽器請求會先被共用密碼登入閘門攔下，`/api/solutions` 回應為 401；此回應發生於 API handler 執行前，不能用來判斷 Supabase 查詢成功或失敗。
- 因本工作階段沒有可使用的 Preview 登入憑證，未傳送共用密碼，也未將未授權 401 誤記為功能失敗。
- 以完整的 fetch mock 驗證 Supabase 路徑：同一公司同時具備政府登錄、CDM、案例、產業級與國際級獎項時，回傳 HTTP 200、`gov/cdm/cs/awd=true`、`awdTier=國際級`，並正確輸出 `src=農業部`。
- 以完整的 fetch mock 驗證 Airtable 路徑：回傳 HTTP 200，且 `gov/cdm/cs/awd=false`、`awdTier=null`。
- 仍待已登入 Preview 工作階段實測：呼叫真實 `/api/solutions`，確認四個 Supabase table query 與實際 3 組公司/方案資料；這是登入保護造成的外部驗證前置條件，不是程式執行錯誤。
