# SYNC_solutions-migration-prep_2026-07-28.md

## 一句話結論

solutions API 遷移：補欄清單已敲定（6 欄）、**ETL 已全量完成（2428 筆，錯誤 0）**。
資料層完成，明天直接從「改 solutions.js」開始 → 比對 → merge。

## 進度狀態（2026-07-28 收工時）

- ✅ 補欄清單敲定（20 缺口 → 精準 6 欄）
- ✅ Supabase solutions ALTER TABLE 加 6 欄
- ✅ **ETL 全量寫入完成：2428 筆成功、錯誤 0**（含 pricing_model 陣列型別修正）
- ⬜ 改 solutions.js 加 Supabase 分支（明天起點）
- ⬜ 設 DB_SOURCE_SOLUTIONS=supabase + 比對 + merge

---

## 補欄清單（今天最重要的產出）

Airtable solutions 39 欄 vs Supabase 22 欄，缺 20 欄。但經「前端 manufacturing.html
實際使用 × Airtable 資料有值比例」交叉比對，實際只需補 6 欄：

### 必補 6 欄（前端有讀 + 有資料）— 已全數 ETL 完成
| 欄位 | Supabase 型別 | Airtable 有值 | 前端用途 |
|---|---|---|---|
| description_short | text | 96% | 卡片主描述（fallback 到 description） |
| pricing_model | **text[]（陣列）** | 75% | ⚠️ 見下方註記 |
| subscription_months | integer | 52% | 價格顯示（年約/月約判斷） |
| monthly_price | integer | 41% | 月費顯示 |
| monthly_price_tier | text | 41% | 月費級距顯示 |
| slogan | text | 6% | slogan 顯示（有 fallback，補了無害） |

**⚠️ pricing_model 型別重要註記（今天踩過的坑）：**
- Airtable 此欄為「多選」，原始值是陣列 `['訂閱制','買斷制']`（4 個可能值：訂閱制/提供試用/客製化服務/買斷制，132 筆為多值）
- 初次建欄誤用 text，ETL 用 str() 會把陣列壓成醜字串 `"['訂閱制']"` → DRY RUN 抓到
- 已 DROP 重建為 **text[]**（比照 service_region/target_industry/target_scale 等多選欄），ETL 直接寫陣列
- 前端 manufacturing.html **實際沒讀 pricing_model**（搜尋 0 匹配），格式對顯示無影響，但仍存 array 以對齊 Airtable 版 API 輸出（比對才過）
- **改 solutions.js 時**：Supabase 分支的 pricing_model 要當陣列輸出，比對時要排序正規化

**優先級最高**：pricing_model / subscription_months / monthly_price 是 formatPricing 的核心，
不補則 Supabase 版價格顯示會壞（前端明顯出錯處）。

### 確認不補（14 欄）
- **四個 score 細項**（score_function/price/support/innovation）：資料 95% 有值，
  但前端只用 score_overall 算星等，完全沒 render 細項。不補。
  （score_support 有 center-bias 問題，本就不該顯示絕對值）
- tech_tags(6%) / growth_goals(6%) / award_records(2%) / certification(2%) /
  solution_category(4%) / startup_listing_status(6%) / detail_status(4%) /
  industry_vertical(5%)：前端沒讀或資料幾乎空，跳過。

---

## 已完成的前置

1. Supabase solutions 已 ALTER TABLE 加 6 欄（型別已驗證：monthly_price/subscription_months
   為 integer 無小數，其餘 text）。確認 6 欄存在 ✓
2. ETL 腳本備妥：etl_solutions_6cols.py（分 3 段，比照 companies 補欄流程）

---

## 明天的執行順序

**注意：ETL 已完成（今天做掉了），明天直接從第 2 步開始。**

1. ~~跑 ETL~~ ✅ 已完成（2428 筆，錯誤 0）
2. **改 solutions.js**：加 Supabase 分支
   - ⚠️ 紅線：不動 scoreSolution / getRecommendations / officialPrograms 核心邏輯
   - ⚠️ 紅線：不動 <script> Babel tag 屬性（會白畫面）
   - Supabase 分支輸出對齊 shapeRecord 的欄位（id←solution_id, name←solution_name 等映射）
   - 注意 company_id：Supabase solutions 不帶 BOM（與 companies 表不同）
3. **設 DB_SOURCE_SOLUTIONS=supabase 於 Vercel Preview** + redeploy
4. **比對**：改 compare 腳本為 solutions 版（排序鍵用 solution_id 或 name）
   - 已知豁免可能項：需比對後才知道（比照 companies 經驗，注意衍生欄位、空值格式）

---

## 沿用 companies 的經驗（避免重踩）

- Vercel Deployment Protection 已關（Require Log In = off），腳本可直接抓 Preview
- PostgREST 分頁：solutions 2429 筆 > 1000，抓全量要 Range 分頁
- parseScore 已修 null bug（若 solutions.js 有類似邏輯要一併檢查）
- 陣列欄位（service_region/target_industry/target_scale）比對要排序正規化，避免順序假警報
- 空值格式 [] vs "" 可能又出現，比對時留意

---

## 整體遷移進度

cases ✓ / companies ✓ / solutions（前置完成，明天主體）/ contacts（未開始）
整體約 47%（companies 完成 45% + 今天 solutions 前置 +2%）
