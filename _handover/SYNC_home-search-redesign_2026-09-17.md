# SYNC: 首頁搜尋區塊重新設計

- 日期：2026-09-17
- Branch：`feat/home-search-redesign-2026-09-17`
- PR：[PR #163](https://github.com/Pcc329/solution-finder/pull/163)
- Preview：[Vercel Preview](https://solution-finder-git-feat-home-935f92-patrick0814-6136s-projects.vercel.app)
- Base：`main` @ `f4c8e61c9de486982806b5ce175b2a7634c82658`

## 實際改動

| 檔案 | 變更 |
| --- | --- |
| `api/solutions.js` | 在既有 Supabase Solutions 主查詢 select 加入 `pricing_model`，並在 Supabase、Airtable 既有 converted 物件輸出 `pm`。 |
| `public/index.html` | 首頁搜尋提示輪播、三個直列快捷搜尋、三個熱門直接篩選，以及相應的前端篩選條件。 |

### pricing_model 輸出

Supabase 沿用原本的單一 Solutions 主查詢，沒有新增 endpoint 或額外 Supabase 請求：

```js
'monthly_price,monthly_price_tier,subscription_months,features_list,pricing_model',
...
pm: Array.isArray(row.pricing_model) ? row.pricing_model : [],
```

Airtable 路徑的 `fetchAll` 已取得完整欄位，僅在既有 converted 物件補上：

```js
pm: Array.isArray(f['pricing_model']) ? f['pricing_model'] : [],
```

`pm` 避免與現有 `ds`（`description_short`）衝突，代表 `pricing_model`；無值時統一輸出空陣列。

### 首頁篩選

- 提示字串每 3 秒輪播；`query` 有內容時 effect 不建立 interval，清空時才恢復輪播。
- 快捷搜尋仍呼叫既有 `handleQuickSearch`。
- 新創嚴選：`program: ['新創嚴選網']`
- 官方認證供應商：`isGov: true`
- 免費試用：`pricingModel: '提供試用'`
- 清除與語意搜尋 fallback 均會重設 `isGov`、`pricingModel`，避免殘留篩選。
- 舊的首頁「熱門分類」九類 chips 已移除；PR #161 的「主題區導覽」維持不變。

## 驗證

驗證環境：上述 Preview，登入後以實際 `/api/solutions` 資料載入完成的首頁操作。

| 項目 | 結果 |
| --- | --- |
| 首頁資料 | 正常載入 `2,291` 筆方案。 |
| 提示輪播 | 初始畫面與等待 3.2 秒後顯示不同的規格字串，確認每 3 秒切換。 |
| 新創嚴選 | 點擊後進入 list，套用「來源：新創嚴選網」，回傳 `148` 筆。 |
| 官方認證供應商 | 點擊後進入 list，回傳 `311` 筆方案。規格中的 53 為公司層級數量，不是此頁的方案筆數。 |
| 免費試用 | 點擊後進入 list，套用「提供試用」，回傳 `54` 筆。 |
| 快捷搜尋 | 點擊「找北部的 AI 客服方案」後，既有語意搜尋解析為北部、AI 方案、客服，回傳 `99` 筆。 |
| 主題區導覽 | 首頁仍顯示 8 個主題區與方案計數，例如銷售管理 669、生產物流 259。 |
| 舊熱門分類 | 首頁不再出現舊的「熱門分類」區塊，僅保留新的「熱門篩選」。 |

資料預檢：Supabase `solutions.pricing_model` 實際型態為 `text[]`。目前即時資料中，新創嚴選網為 148 筆、`pricing_model @> ARRAY['提供試用']` 為 54 筆，和規格的歷史預期 152／55 有資料更新差異。

## Diff 與檢核

`main..HEAD`（程式提交）：

```text
api/solutions.js   | 3 insertions, 1 deletion
public/index.html  | 75 insertions, 16 deletions
```

無 JavaScript build pipeline；已以真實 Preview 完整載入首頁、呼叫既有搜尋流程及三項直接篩選，未見執行期錯誤。

## Commits

1. `b87858ec751b7753e5a4c86efcba602079233bce` feat(api): expose pricing model in solutions response
2. `51f4cf23d1e42ba43216cc782120b77496008c82` feat(home): redesign search shortcuts and popular filters


## 跑馬燈隨機詞庫升級

已依 PPC 確認，將固定四句範例改為前端詞庫加模板的隨機組句；未新增 API 或資料庫查詢。

### industry_category 盤點

盤點來源：Supabase Production `solutions`，條件為 `record_status IS NULL OR record_status NOT LIKE '已下架%'`。

| industry_category | 方案數 | 詞庫決策 |
| --- | ---: | --- |
| 銷售管理 | 669 | 納入 |
| 行銷推廣 | 418 | 納入 |
| 生產物流 | 259 | 納入 |
| 協作辦公 | 196 | 納入 |
| 資安合規 | 146 | 納入 |
| 人力資源 | 143 | 納入 |
| 研發創新 | 132 | 納入 |
| 醫療照護 | 45 | 納入 |
| NULL | 241 | 排除 |
| 空字串 | 20 | 排除 |
| 暫無法分類 | 16 | 排除 |
| CNC精密加工業、節能減碳、精品咖啡業、行銷數位轉型、製造業、食品製造業(冷鏈) | 各 1 | 排除 |

PPC 已確認使用上述八個代表性類別作為 `POOL_CATEGORY`，並排除缺值、未分類及六個長尾單筆類別。

### 實作

```js
const POOL_CATEGORY = [
  "銷售管理", "行銷推廣", "生產物流", "協作辦公",
  "資安合規", "人力資源", "研發創新", "醫療照護",
];
const POOL_REGION = ["北北基", "桃竹苗", "中彰投", "雲嘉南", "高屏", "宜花東", "離島", "全台灣"];
const POOL_SCALE = ["9人以下", "10~20人", "21~50人", "51~100人", "101~200人", "不限規模"];
```

- `SENTENCE_TEMPLATES` 有三種可讀句型，每次從模板和對應詞庫隨機取值。
- `createRandomSearchSentence(previousSentence)` 最多嘗試八次，確保跑馬燈不會連續顯示相同句子。
- 跑馬燈延用既有 3 秒 interval；`query` 有內容時不建立 interval。
- 三個 `quickSearchExamples` 在 React state 初始化時獨立產生，之後不會自動變更。
- 快捷按鈕仍只呼叫既有 `handleQuickSearch(text)`。
- 第三模板改為「相關方案」，未使用會被既有語意解析轉成無效關鍵字的泛用詞「數位轉型」。

### Preview 驗證

| 項目 | 結果 |
| --- | --- |
| 隨機跑馬燈 | 初始：`搜尋：我想找全台灣的人力資源方案，適合9人以下的企業...`；3.2 秒後：`搜尋：找101~200人企業適用、高屏地區的研發創新系統...`。兩次不同。 |
| 快捷搜尋穩定性 | 三個載入時產生的文字經過跑馬燈輪替後完全未變更。 |
| 快捷搜尋互動 | 點擊「搜尋：找101~200人企業適用、中彰投地區的人力資源系統...」後，既有流程解析為中部、人力資源、人資，並回傳 2 筆結果。 |
| 既有區塊 | 熱門篩選與八個主題區導覽仍在首頁且正常顯示。 |

Preview 已 Ready；驗證過程的首頁與搜尋結果截圖保留在本任務操作紀錄。

### 追加 commits

3. `636a7a49b2d6b137d1291f52690df8d0177bc9e0` feat(home): randomize search suggestions
4. `163e71413333cbb5c76df52d3b2d63ab99b0d23e` fix(home): avoid generic random search keywords
