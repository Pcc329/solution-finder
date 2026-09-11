# SYNC：solution_reviews 審查軌跡表

日期：2026-09-10

## 改動檔案

- `migrations/20260910_create_solution_reviews.sql`
  - 唯一功能檔；新增 `solution_reviews` schema、索引、26 筆 2026-09-10 triage 回填與手動驗證查詢。

未修改 `public/`、`api/` 或 `public.solutions` 的任何資料與 schema。

## 最終 Schema

```sql
CREATE TABLE public.solution_reviews (
    review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    solution_id TEXT NOT NULL REFERENCES public.solutions(solution_id),
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewer TEXT,
    trigger_reason TEXT,
    verdict TEXT NOT NULL,
    status_before TEXT,
    status_after TEXT,
    notes TEXT
);

CREATE INDEX idx_solution_reviews_solution_id
    ON public.solution_reviews(solution_id);
```

`solution_id` 僅有外鍵、沒有 UNIQUE 約束，因此同一方案可追加多筆不覆蓋的審查紀錄。

## 回填與防呆

- 種子資料共 26 筆且 ID 無重複：
  - 15 筆：`維持下架_資料不全`
  - 3 筆：`維持下架_公司有其他方案`（`SOL-0242`、`SOL-0491`、`SOL-0772`）
  - 8 筆：`維持下架_空殼無公司關聯`
- `reviewer` 為 `PPC`；`reviewed_at` 為 `2026-09-10T00:00:00+08:00`；`trigger_reason` 為 `臺灣雲市集資料品質稽核`。
- `SOL-0906` 的 verdict 仍為「資料不全」，但依規格使用 `已下架_公司歇業佐證` 作為前後狀態；其餘 25 筆為 `已下架_資料異常`。
- migration 先把 26 筆放入交易內的 temporary seed table，並檢查：
  1. 26 個 `solution_id` 全部存在於 `public.solutions`。
  2. 每筆 `record_status` 與預期值相符。
- 若任一檢查失敗，migration 會 `RAISE EXCEPTION` 並回滾，絕不寫入局部 review 記錄。

## 執行後驗證

migration 已附以下可在 Supabase SQL Editor 執行的查詢：

1. 計算 2026-09-10 triage 回填筆數（預期 26）。
2. 取 `SOL-0071`、`SOL-0242`、`SOL-1044` 三種 verdict 範例，並比對 review 前後狀態與 Solutions 現況。
3. 以 transaction 插入 `SOL-0071` 的第二筆測試 review，再 `ROLLBACK`，驗證一對多關係可寫入且不留下測試資料。

## 驗證狀態

- [x] migration 的 table、FK 與 index 定義符合規格。
- [x] `solution_reviews.solution_id` 沒有 UNIQUE 約束。
- [x] 26 筆 seed IDs 靜態檢查皆唯一，分類數量為 15 + 3 + 8。
- [x] migration 不包含 `UPDATE public.solutions` 或 `DELETE FROM public.solutions`。
- [x] migration 含 status preflight guard 與 transaction rollback 機制。
- [ ] 尚未在 Supabase SQL Editor 執行 migration；因此表建立、實際 26 筆寫入及三組 SELECT 結果待 PPC 執行 migration 後驗證。本 PR 建立過程未寫入 Production 或 Preview DB。

## Git

- Branch：`feat/solution-reviews-2026-09-10`
- 功能 commit：`ccdb61c9cfca5be727fa545d871bce8220cfdab9 feat: add solution review audit trail`
- PR：https://github.com/Pcc329/solution-finder/pull/152
