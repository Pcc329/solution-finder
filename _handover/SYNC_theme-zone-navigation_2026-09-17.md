# SYNC — 主題區導覽與詳情頁

日期：2026-09-17  
PR：[PR #161](https://github.com/Pcc329/solution-finder/pull/161)  
Preview：[Vercel Preview](https://solution-finder-3h1cxfgjt-patrick0814-6136s-projects.vercel.app/)

## 本次範圍
- 實際程式修改：`public/index.html`。
- 本文件僅為交接與驗證紀錄。
- 未修改 API、Supabase、資料庫、`public/manufacturing.html`，也未修改 `<script type="text/babel">` 標籤屬性。

## 實作摘要
- 在首頁「熱門分類」下新增 8 張主題區導覽卡片。
- 卡片由已載入的 `allData` 即時計算：`allData.filter(item => item.cat === category).length`。
- 新增 `theme-detail` 畫面，統計方案數、唯一供應商、CDM 分類家數、官方登錄家數，以及前四個來源加總的「其他」。
- CTA 復用既有 `handleCategoryBrowse(category)`；未新增第二套篩選邏輯。
- 瀏覽器上一頁狀態以 `history.state.category` 回復主題詳情。

## Preview 實測
驗證環境：上述 PR #161 Vercel Preview；資料載入完成後首頁共 2,462 筆方案。

### 首頁 8 張卡片
| 主題區 | 顯示方案數 |
| --- | ---: |
| 銷售管理 | 673 |
| 行銷推廣 | 418 |
| 生產物流 | 261 |
| 協作辦公 | 198 |
| 人力資源 | 145 |
| 資安合規 | 147 |
| 研發創新 | 133 |
| 醫療照護 | 46 |

已在瀏覽器實際截圖確認八張卡片與數字均完整呈現。

### 資安合規主題詳情
實際點擊「資安合規」卡片後，Preview 顯示：
- 收錄方案數：147
- 供應商家數：93
- CDM 分類家數：26
- 官方登錄家數：13
- 來源分布：政府軟體採購網 67、臺灣雲市集 60、雲市集工業館 9、SME AI平台 8、其他 3

上述畫面已以瀏覽器截圖驗證。接著點擊「瀏覽『資安合規』全部 147 個方案」，既有結果列表顯示「類別：資安合規」與「147 筆」，確認 CTA 導向和篩選同步正常。

### 生產物流 261 / 266 核對
- Preview 的首頁卡片與主題詳情均顯示 261；主題詳情進一步顯示 122 家供應商、8 家 CDM、23 家官方登錄。
- 前端欄位對應已確認：`api/solutions.js` 的 Supabase 路徑直接輸出 `cat: row.industry_category || ''`；Airtable 路徑直接輸出 `cat: f['industry_category'] || ''`。首頁使用的 `item.cat` 沒有再做分類轉換。
- 已在 Supabase Production SQL Editor 執行唯讀核對查詢，結果為：原始 `industry_category = '生產物流'` 共 **266** 筆；套用與 API 相同的條件 `record_status is null or record_status <> '已下架_資料異常'` 後為 **261** 筆；被排除的明確下架資料為 **5** 筆。
- 結論：261／266 的差異不是時間差，也不是 `item.cat` 欄位對應錯誤，而是 `/api/solutions` 對活躍資料的既有 `record_status` 過濾所致。Airtable 使用 `ACTIVE_SOLUTIONS_FILTER`；Supabase 使用 `(record_status.is.null,record_status.neq.已下架_資料異常)`，兩者語意一致。
- 實際核對 SQL：
```sql
select
  count(*) filter (where industry_category = '生產物流') as raw_count,
  count(*) filter (
    where industry_category = '生產物流'
      and (record_status is null or record_status <> '已下架_資料異常')
  ) as api_equivalent_count,
  count(*) filter (
    where industry_category = '生產物流'
      and record_status = '已下架_資料異常'
  ) as excluded_count
from solutions;
-- 結果：266 / 261 / 5
```
## Console 排查
使用者提供的 Preview console 截圖中只有：
- Tailwind CDN production 警告
- in-browser Babel 警告
- Vercel Live 的 CSP report-only 訊息

這些均非本 PR 新增，且沒有 React、JS 語法或執行錯誤；依補充說明，本 PR 不處理。

## Git
- Branch：`feat/theme-zone-navigation-2026-09-17`
- 功能 commit：`8039f4c993f700ba7212049ada2ba88a753ea51a`
- SYNC commit：本文件提交後以 PR 最新 commit 為準。
