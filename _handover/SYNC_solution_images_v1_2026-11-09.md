# SYNC 方案圖片 v1｜相容性檢查

| 項目 | 結果 |
| --- | --- |
| 1. `public.solutions.solution_id` 型別 | 既有交接紀錄記載，Supabase SQL Editor 查詢 `information_schema` 的結果為 `text`。本次未重跑線上 SQL。 [既有查核紀錄](https://github.com/Pcc329/solution-finder/blob/8851fc1e2acb7d8ddbd9b7aac231a04376756c91/_handover/SYNC_target-scale_2026-09-18.md#L20-L24) |
| 2. 圖片的獨立選用查詢 | 初查發現 `gov_registrations` 直接呼叫 `fetchAllSupabasePaged`，失敗時會讓 API 回傳 HTTP 500。依 PPC 修正，實作採用既有 `fetchOptionalSupabaseColumn`，並加上 `status=eq.active`。 [現有查詢](https://github.com/Pcc329/solution-finder/blob/8851fc1e2acb7d8ddbd9b7aac231a04376756c91/api/solutions.js#L141-L147) · [選用查詢 helper](https://github.com/Pcc329/solution-finder/blob/8851fc1e2acb7d8ddbd9b7aac231a04376756c91/api/solutions.js#L67-L84) |
| 3. 列表卡片位置與範圍 | 搜尋結果卡片位於 `public/index.html:1732–1796`，核取框和公司頭像在預估行號內。第 2055 行是方案詳情頁的公司頭像。未發現同一份搜尋結果卡片的其他重用位置，因此附件所述的條件式擴充範圍未觸發。 [搜尋結果卡片](https://github.com/Pcc329/solution-finder/blob/8851fc1e2acb7d8ddbd9b7aac231a04376756c91/public/index.html#L1732-L1796) · [詳情標頭](https://github.com/Pcc329/solution-finder/blob/8851fc1e2acb7d8ddbd9b7aac231a04376756c91/public/index.html#L2046-L2062) |
| 4. 詳情頁相框插入結構 | 結構存在。第 2046–2062 行有方案名稱、公司資訊和聯絡卡，第 2084–2092 行為獨立的方案介紹區塊。 [詳情頁結構](https://github.com/Pcc329/solution-finder/blob/8851fc1e2acb7d8ddbd9b7aac231a04376756c91/public/index.html#L2046-L2092) |

2026-11-06 初查發現第 2 項差異，當時依停止條件暫停。PPC 確認後，採用既有型別查核紀錄，圖片改用 `fetchOptionalSupabaseColumn`，前端只套用上述搜尋結果卡片與方案詳情。

## 實作與 PR

- 分支 `codex/solution-images-v1`，基準 `8851fc1e2acb7d8ddbd9b7aac231a04376756c91`。
- 功能 commit `67227f99aec0af7b21fe76d7910c03ef85a738b8`。本 SYNC 另用文件 commit 提交。
- [PR #302](https://github.com/Pcc329/solution-finder/pull/302) 已開啟，base 為 `main`，尚未合併，未設定自動合併。
- Vercel 回報 Preview Ready。[Preview](https://solution-finder-git-codex-sol-15e65f-patrick0814-6136s-projects.vercel.app)

| 檔案 | 行數 | 內容 |
| --- | --- | --- |
| `migrations/20261109_solution_images.sql` | +25 | 欄位、外鍵、HTTPS 約束、權限與 RLS |
| `api/solutions.js` | +6 | 選用查詢與 `img` 映射 |
| `AGENTS.md` | +1 | `img` 欄位說明 |
| `public/solution-image.js` | +67 | 16:9 相框、文字圖與載入失敗處理 |
| `public/index.html` | +25 / −2 | 樣式、搜尋卡片與方案詳情接點 |
| `tests/program-badge-allowlist.test.mjs` | +5 / −3 | 更新模擬查詢的允許清單與精確次數 |
| `tests/supabase-read-equivalence.test.mjs` | +56 / −7 | 驗證新增請求、狀態、關聯鍵、降級與既有資料等價 |
| `_handover/SYNC_solution_images_v1_2026-11-09.md` | +97 | 相容性檢查、驗收與交接 |

## 相框套用位置

- `public/index.html:15` 載入共用腳本，第 51–58 行定義相框樣式。
- `public/index.html:1747–1749` 建立搜尋結果卡片相框，第 1808–1812 行插入卡片。桌機在最右側置頂，手機置於卡片內容上方。
- `public/index.html:2031–2033` 建立方案詳情相框，第 2105 行在方案介紹前插入。原第 2055 行的公司頭像仍使用既有公司頭像元件。
- `public/solution-image.js:48` 提供共用 HTML 產生器。配色依現有八個服務類別加「暫無法分類」，多分類使用第一項，未知分類使用中性色。

## 驗收

| 項目 | 結果與證據 |
| --- | --- |
| 新環境 migration、權限、RLS | 本機全新 PostgreSQL 16 測試庫。預先模擬兩角色有預設全權限，migration 後只剩 SELECT。兩角色都只能讀到 `active`。HTTPS 約束與外鍵 cascade 通過。測試資料 rollback 後為 0 列。 |
| 空表 API 前 20 筆與總筆數 | 同一個 25 筆本機 mock，`8851fc1` 和本分支皆回 HTTP 200、25 筆。逐筆比對全部 25 筆的 JSON、欄位順序、回應標頭及既有查詢，差異僅多 `img: ""` 和獨立圖片查詢。 |
| 空表畫面 | Chromium 本機 mock，所有搜尋卡片顯示文字圖、詳情無相框，瀏覽器 console error 及 page error 均為 0。 |
| 寬、直、方、小與失效圖 | Chromium 攔截 mock 網址，使用 400×80、100×400、300×300、30×20 與無效 SVG。主圖 `scale-down`，背景 `cover`、模糊 14px、亮度 0.85、縮放 1.2。桌機列表相框 176×99，詳情相框 640×360 置中。失效時列表換文字圖、詳情移除相框。 |
| 查詢降級 | 本機暫時在記憶體內改用不存在的 `solution_images_missing`，模擬 404。仍回 HTTP 200、25 筆、`img` 皆空，既有 JSON 相同且有 `console.warn`。另測 403 和網路錯誤，以及 `TimeoutError`。 |
| 手機版面 | Chromium 375px，頁面 clientWidth 與 scrollWidth 都是 375px。相框在上方並佔滿內容寬，同等內容的測試卡片高度一致。 |
| 非 HTTPS | `http:`、`javascript:` 均未發出圖片請求，列表顯示文字圖，詳情無相框。 |
| 鍵盤及點擊 | 卡片既有核取框可用 Space 切換，相框沒有可聚焦元素，點擊相框進入該方案詳情。 |
| 腳本未提供元件 | Chromium 模擬 `solution-image.js` 未定義 renderer，列表、詳情正常顯示，沒有相框與 JavaScript 錯誤。 |
| 自動測試 | `node --check` 通過。`tests/` 頂層 11 個檔案，292 項通過、0 項失敗。 |
| 線上 Preview 及前後對照 | Vercel 建置成功。Preview 與正式站 `/api/solutions` 未登入均回 HTTP 401。待 PPC 登入後擷取 HTTP 200、前 3 筆含 `img` 的 JSON、前 20 筆差異，以及兩站總筆數。 |

### 本機 PostgreSQL 查詢結果

| table_name | column_name | data_type |
| --- | --- | --- |
| solution_images | image_url | text |
| solution_images | solution_id | text |
| solution_images | status | text |
| solutions | solution_id | text |

`information_schema.role_table_grants` 的 `solution_images` 結果

| grantee | privilege_type |
| --- | --- |
| anon | SELECT |
| authenticated | SELECT |

### 上線順序

1. PPC 先在 Supabase SQL Editor 執行 migration，確認欄位型別、兩角色的 SELECT 權限及空表。
2. 登入 Preview 與正式站完成 API 比對。這次實作的圖片測試資料僅存在本機 mock，正式庫未執行 migration 或寫入資料。
3. PPC 驗收後再決定是否合併 PR。試點圖片由 PPC 另外以 SQL 寫入。

## `api/solutions.js` 完整 diff

```diff
diff --git a/api/solutions.js b/api/solutions.js
index 6b23bbd..183edd4 100644
--- a/api/solutions.js
+++ b/api/solutions.js
@@ -105,2 +105,3 @@ export default async function handler(req, res) {
       awardRows,
+      imageUrlBySolutionId,
     ] = await Promise.all([
@@ -169,2 +170,6 @@ export default async function handler(req, res) {
       ),
+      fetchOptionalSupabaseColumn(
+        supabaseUrl, supabaseAnonKey, 'solution_images', 'solution_id', 'image_url',
+        'solution_id.asc', { status: 'eq.active' }
+      ),
     ]);
@@ -319,2 +324,3 @@ export default async function handler(req, res) {
         so: parseScore(row.score_overall),
+        img: imageUrlBySolutionId.get(String(row.solution_id || '')) || '',
       };
```
