# SYNC_companies-api-supabase_2026-07-28.md

## 一句話結論

companies API 的 Supabase 路徑已對齊 Airtable、驗收通過，可 merge。
比對差異全數釐清：真問題已修，其餘為「Supabase 更準」或「無意義邊界差異」的已知豁免。

---

## 本次處理歷程（differences: 197 → 4 豁免）

第二支 API（companies）比對從 197 筆差異，逐一拆解為六個欄位來源，全部釐清：

| 欄位 | 初始差異 | 性質 | 處理 |
|---|---|---|---|
| tags | 13 | 陣列順序不同、內容一致（假警報）+ 缺欄位殘差 | ETL 補 2 欄 + 比對排序正規化 → 對齊 0 |
| tech_tags | 122 | 空值格式 `[]` vs `""` | Supabase 分支空陣列轉空字串 → 對齊 0 |
| avg_score | 33 | parseScore 把 null 當 0，拉低平均（真 bug） | 修 parseScore → 33 筆歸零；剩 4 筆 ±0.1 邊界差異 → 豁免 |
| contact_count | 165 | Supabase 即時 JOIN 為真值，Airtable 預存快照過時 | 豁免（SQL 全表驗證 852 筆自洽 mismatched=0） |
| award_count | 20 | 同上，Supabase 真值、Airtable 快照過時 | 豁免（SQL 抽驗 view=actual） |
| has_award | 19 | 由 award_count 衍生，同上 | 豁免 |

---

## 程式碼變更（api/companies.js，只改 Supabase 分支相關）

三個 commit 疊加：

1. `feat(api): add Supabase source flag for companies`（初版）
2. `fix(api): align Supabase company tags and scores`（加掃 solutions 算 tags/avg_score）
3. `fix(api): scan industry_category and features_list for company tags`（tags 掃描補 2 欄）
4. `fix(api): parseScore null handling and tech_tags empty format`（修 null bug + tech_tags 空值對齊）

關鍵修正兩處：
- `parseScore` 開頭加 `if (value === null || value === undefined || value === '') return null;`
  —— 修正 Supabase 回傳 null 分數被 `Number(null)=0` 當成 0 計入平均的 bug。
  對 Airtable 分支安全（Airtable 空分數為 undefined，行為不變）。
- Supabase 分支輸出 tech_tags：空陣列轉空字串，對齊 Airtable 輸出格式。

Airtable 分支邏輯全程未動。

---

## 資料層變更（ETL，一次性）

為對齊 tags，補 2 欄進 Supabase solutions 表：
- 先 `ALTER TABLE solutions ADD COLUMN industry_category text, features_list text`
- Colab ETL：Airtable → Supabase，用 airtable_rec_id 對齊，service key 寫入
- 成功 2153 / 2153，錯誤 0
- 抽驗 5 筆 category/features 逐字一致、中文無亂碼
- Supabase 有值：industry_category 2030、features_list 1955（對齊 Airtable 原始比例）

另兩欄（industry_vertical、tech_tags）Airtable 端僅 5-6% 有值，補了對 tags 無實質貢獻，略。

---

## Validation（比對結果）

用 compare_companies_v3.ps1（陣列排序正規化 + 豁免欄位分離）：

```
supabaseCount   = 200
airtableCount   = 200
realDifferences = 4   （全為 avg_score ±0.1 四捨五入邊界差異）

豁免欄位差異（Supabase 真值，記錄用）：
  contact_count  165 筆
  award_count     20 筆
  has_award       19 筆
```

- tags / tech_tags：對齊 0 差異 ✓
- avg_score：33 筆 null bug 已修；剩 4 筆為 ±0.1 浮點四捨五入邊界差異（3.55 該進該捨），
  非算法錯誤。avg_score 定位為相對排序輔助值、非精確顯示值，0.1 差異不影響用途，豁免。
- contact_count / award_count / has_award：Supabase 即時 JOIN 為真值，Airtable 預存快照過時，
  已用 SQL 驗證（contact 全表 852 筆自洽、award 抽驗 view=actual），豁免。

---

## 已知待辦（並入後續，非本 PR 範圍）

1. Supabase solutions 少 4 筆（無名、未分類、company_id 空的空殼記錄），
   遷移時合理排除，非缺口。清單存 solutions_missing_in_supabase.json。
2. industry_vertical / tech_tags 兩欄 Airtable 端本就稀疏（5-6%），未補。
3. Production 切換 DB_SOURCE_COMPANIES=supabase：建議等 pilot test 結束再決定。

---

## 給下一步的提示

companies 收尾後，主線回到 sources.html 更新（先跑
`SELECT data_source, count(*) FROM solutions GROUP BY data_source;` 拿各來源正確筆數）。
solutions API 遷移為後續最大工作項，本次補的 industry_category/features_list 已提前完成其部分前置。
