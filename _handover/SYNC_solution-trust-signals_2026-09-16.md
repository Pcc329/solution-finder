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


## 問題回報驗證與修正（2026-09-16）

- 已在登入後的同一個 Preview 以首頁搜尋「LEO KM-GPT」，得到 1 筆「LEO KM-GPT國眾智慧大獅」，並開啟 `#detail`。
- 回報可重現：首頁清單與 `#detail` 原本沒有信任標章，也沒有「信任驗證」區塊。
- 對照同一個 Preview 的 `manufacturing.html`：實際產生推薦後，列表已可見「官方認證／資安分級／獲獎肯定」，展開「方碼 AI 行動多碼掃描」可見完整「信任驗證」區塊。這排除 Preview 未部署、未登入或 manufacturing 渲染路徑失效。
- 根因是前端入口範圍遺漏：初始實作只修改 `public/manufacturing.html`，而使用者測試的方案搜尋與詳情由 `public/index.html` 渲染；該檔案沒有任何 `gov/cdm/cs/awd/awdTier` 的呈現邏輯。
- 本次補件在 `public/index.html` 新增共用的 JSX 信任標章與四列「信任驗證」呈現，並插入搜尋卡、詳情 header 與詳情內容。未改動 API 聚合、評分或推薦邏輯。
- 接下來以新版 Preview 對「LEO KM-GPT」、FarmiSpace、airaTrack 重新驗證三個使用者指定案例；驗證結果與新 commit SHA 追加於本文件。


## 已登入 Preview 實測（修正後）

- 驗證環境：已登入的 PR #157 Preview，`https://solution-finder-git-feat-solu-7e85d0-patrick0814-6136s-projects.vercel.app/`；首頁顯示已載入 2,462 筆方案。
- `LEO KM-GPT國眾智慧大獅`（國眾電腦股份有限公司，company_id `01517124`）：搜尋列表顯示「官方認證／資安分級／獲獎肯定」三枚 badge；詳情頁「信任驗證」為 3/4，三個來源項目通過、案例實績為累積中。
- `產品碳足跡盤查解決方案`（大云永續科技股份有限公司；原回報名稱 Products Carbon Footprint）：搜尋列表顯示「官方認證」；詳情頁為 1/4，官方能量登錄通過，其餘累積中。
- `airaTrack-全場域人臉追蹤解決方案`（城智科技股份有限公司，company_id `83522758`）：搜尋列表顯示「獲獎肯定」；詳情頁為 1/4，政府獎項通過且層級顯示為「國際級」。
- 以上三筆都是由已登入首頁實際載入的 `/api/solutions` 資料驅動，非 mock。直接以瀏覽器網址列前往 API 端點會被此環境的用戶端攔截器阻擋，故未把該攔截回應誤判為 API 失敗；改以產品頁面實際消費的回應完成驗證。
- 修正後首頁搜尋卡與 `#detail` 均能呈現信任訊號；`manufacturing.html` 原有呈現也已確認正常。


## 分母動態計算修正（2026-09-16）

- 修正 `public/index.html` 的 `renderTrustVerification(item)`：前三項固定計入分母；「案例實績佐證」僅在 `item.cs === true` 時以 `countable: true` 計入。
- 分數標示由寫死的 `{verifiedCount}/4` 改為 `{verifiedCount}/{countedSignals.length}`。因此 LEO KM-GPT 的三個已通過來源、無案例實績情況應顯示 3/3；有案例佐證時才顯示四項總分。
- `public/manufacturing.html` 已採同樣規則：前三項 `hasData: true`，案例實績僅在 `cs === true` 時計入 `verifiedItems`。
- 技術債：`index.html` 的 JSX 與 `manufacturing.html` 的字串模板各自維護等價的信任呈現邏輯。本輪只修正分母，不合併架構；後續新增信任來源時應評估收斂，避免規則再次漂移。
- 待新版 Preview 完成後，以 LEO KM-GPT 分別確認首頁與 manufacturing 頁面均為 3/3。


## 分母修正後 Preview 驗證

- 已登入新版 Preview 並以首頁搜尋 `LEO KM-GPT`：`LEO KM-GPT國眾智慧大獅` 詳情的信任分數已由 3/4 修正為 **3/3**；三個通過項目仍正常顯示，案例實績佐證為「累積中」且不列入分母。
- 方案探索頁實測同一套動態規則：
  - `AI 循環碳永續價值鏈與善良管理人雲管家` 無案例佐證時顯示 **0/3**。
  - `GenAIoT平台` 有案例佐證時顯示 **3/4**。
- `manufacturing.html` 的現有實作維持 `verifiedItems.length` 作為分母；首頁現在改為等價的 `countedSignals.length`。兩個入口在有／無案例佐證時均依相同規則切換分母。


## 移除信任分數標籤（2026-09-16）

- 依已核准的規格，僅移除使用者可見的 X/Y 分數標籤：
  - `public/index.html`：移除 `{verifiedCount}/{countedSignals.length}` 的 badge DOM。
  - `public/manufacturing.html`：移除 `${score}/${total}` 的圓形 badge DOM。
- 四列信任項目與通過／累積中顯示邏輯不變。
- `countable`／`hasData` 及動態分母相關計算保留在兩份實作中，沒有觸碰 API 信任旗標或查詢。
- 待新版 Preview 部署後，使用 LEO KM-GPT 與一筆無案例佐證方案確認兩個入口都沒有殘留分數標籤。


## 移除分數標籤 Preview 驗證（2026-09-16）

- 驗證環境：已登入的 PR #157 Preview，`https://solution-finder-git-feat-solu-7e85d0-patrick0814-6136s-projects.vercel.app/`；頁面實際載入 2,462 筆方案。
- 首頁：搜尋並開啟 `LEO KM-GPT國眾智慧大獅` 詳情。信任驗證仍顯示官方能量登錄、資安 CDM 分類、政府獎項、案例實績佐證四列；畫面沒有 `3/3` 或其他 X/Y 分數標籤。
- 方案探索：以「其他製造／10人以下／剛起步／庫存物流／30萬以下」產生推薦，展開無案例佐證的 `AI 循環碳永續價值鏈與善良管理人雲管家`。四列均正常顯示「累積中」，且沒有 `0/3` 或其他 X/Y 分數標籤。
- 已以瀏覽器截圖確認上述兩個入口。原有的綠色通過狀態、獲獎層級與累積中顯示均未改變。
- 靜態確認：`public/index.html` 仍保留 `countable`／`countedSignals`，`public/manufacturing.html` 仍保留 `hasData`／`verifiedItems`；本次只刪除可見分數的 DOM。


## 公部門計畫參與標籤（2026-09-16）

- 改動檔案：`api/solutions.js`、`public/index.html`、`public/manufacturing.html`，以及本 SYNC 文件。
- Supabase 路徑使用既有 `solRows` 在記憶體以 `company_id` 正規化後彙整不重複的 `program_type`；回傳 `pgc`（program count）。`Promise.all` 既有 7 個讀取不變，未新增任何 Supabase 查詢。
- Airtable 路徑固定回傳 `pgc: 0`，不執行此彙整。
- 首頁與方案探索卡片：僅當 `pgc >= 2` 才以 `badge-violet` 顯示「跨N種公部門計畫」。既有信任驗證四列、排序與篩選邏輯未調整。
- 待新版 Preview 部署後，將以谷林運算（預期 `pgc=5`）及單一計畫來源方案驗證 API 回應與兩個前端入口。


## 公部門計畫參與標籤 Preview 驗證（2026-09-16）

- 驗證環境：已登入 PR #157 Preview，`https://solution-finder-git-feat-solu-7e85d0-patrick0814-6136s-projects.vercel.app/`；首頁及方案探索均實際載入 2,462 筆方案。
- 首頁有標籤樣本：搜尋「谷林運算」（company_id `50849424`）得到 6 筆結果；每張谷林方案卡均顯示紫色「跨5種公部門計畫」。
- 首頁無標籤樣本：熱門查詢「AI 客服方案」的「WordPress客服系統」（一心堂智慧科技股份有限公司）卡片顯示既有「新創嚴選」來源，未顯示紫色跨計畫標籤；同一結果頁中 `pgc=2` 的數辰創藝方案正確顯示「跨2種公部門計畫」，確認門檻為 >= 2。
- 方案探索樣本：以「其他製造／10人以下／剛起步／庫存物流／30萬以下」實際產生推薦。推薦卡可見 SARA 智慧生產排程「跨3種」、AI 循環碳永續價值鏈「跨2種」、Status PowerBPM+AI「跨4種」公部門計畫標籤。
- 已截取首頁與方案探索的實際 Preview 畫面，確認紫色標籤位於卡片頂端既有 badge 旁，未進入四列「信任驗證」區塊。
- 直接用瀏覽器網址列開啟 `/api/solutions` 時，此環境的本機用戶端攔截器回報 `ERR_BLOCKED_BY_CLIENT`，故無法取得可保存的原始 JSON body，也未嘗試繞過攔截器。上述兩頁載入並呈現 `pgc` 的真實 2,462 筆資料，是由產品頁面的既有 `/api/solutions` 呼叫取得，而非 mock。
- 查詢數量佐證：本次前後 Supabase `Promise.all` 均為 7 個既有讀取（solutions、companies、data_source、gov_registrations、company_cdm_categories、cases、awards）；`programTypesByCid` 僅迭代既有 `solRows`。


## 公部門計畫明細與標籤樣式修正（2026-09-16）

- 改動檔案：`api/solutions.js`、`public/index.html`、`public/manufacturing.html`，以及本 SYNC 文件。
- API：Supabase 仍只使用既有 `solRows` 與 `programTypesByCid`；每筆輸出新增 `pgList: Array.from(programTypesByCid.get(cid) || [])`。因此不新增 Supabase 查詢；既有 `Promise.all` 仍為 7 個讀取。Airtable 路徑明確輸出 `pgList: []`。
- 首頁：`renderProgramParticipation(item)` 僅於 `pgc >= 2` 且 `pgList` 非空時，在詳情頁的「信任驗證」區塊後渲染獨立紫色區塊，標題為「跨N種計畫」，並把所有來源計畫做成 chip。搜尋結果卡不顯示明細。
- 方案探索：`getProgramParticipationHtml(item)` 使用相同條件，插入展開卡片與既有詳情頁的信任驗證區塊後；不修改四項信任驗證邏輯。
- Badge 文案統一為「跨N種計畫」。首頁的紫色 badge 補上 `inline-flex items-center gap-1`；實測 computed style 為 `display:flex`、`align-items:center`、字級 `10px`、padding `2px 8px`。製造頁的 `.badge` 原本即為 `display:inline-flex; align-items:center`，實測紫色 badge 為 `display:flex`、`align-items:center`、字級 `11px`、padding `3px 8px`，故只改文案，不額外調整 CSS。

### Preview 驗證

- 驗證環境：已登入 PR #157 Preview，`https://solution-finder-git-feat-solu-7e85d0-patrick0814-6136s-projects.vercel.app/`；兩頁皆實際載入 2,462 筆方案。
- 首頁：搜尋並開啟谷林運算股份有限公司的「谷林運算GoodLinker | 企業雲端戰情室」。卡片紫色 badge 顯示「跨5種計畫」；詳情頁在信任驗證下方顯示獨立「跨5種計畫」區塊與五個 chip：臺灣雲市集、新創嚴選網、領域型調查(人工搜查)、雲市集工業館、SME AI平台。
- 方案探索：以「其他製造／10人以下／剛起步／庫存物流／30萬以下」產生推薦，展開「SARA 智慧生產排程系統 (入門版)」。卡片顯示「跨3種計畫」；展開後的獨立區塊列出新創嚴選網、領域型調查(人工搜查)、雲市集工業館。
- 已透過瀏覽器可視畫面與 accessibility tree 確認上述首頁、方案探索兩個詳情入口；首頁區塊與製造頁區塊均未混入原有四項信任驗證。
- 靜態檢查：Supabase/Airtable 各一處 `pgList` 輸出、首頁一處詳情 helper、製造頁兩處詳情插入點皆存在；舊文案「跨N種公部門計畫」不存在。

### Git

- 分支：`feat/solution-trust-signals-2026-09-16`
- 實作 commit：`1f17ffdb04945a3dc537d66caf37f60c7e7421f0`（`feat: 顯示跨計畫參與明細`）
- SYNC commit：待本次文件提交後補入。