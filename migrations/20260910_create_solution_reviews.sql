-- Adds an append-only review trail for solution data-quality triage.
-- This migration intentionally does not update or delete rows in public.solutions.

BEGIN;

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

-- Keep the seed set in a transaction-local table so it can be validated before
-- any review rows are inserted. This table is dropped automatically at COMMIT.
CREATE TEMP TABLE solution_review_seed (
    solution_id TEXT PRIMARY KEY,
    verdict TEXT NOT NULL,
    expected_status TEXT NOT NULL,
    notes TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO solution_review_seed (
    solution_id,
    verdict,
    expected_status,
    notes
) VALUES
    (
        'SOL-0071',
        '維持下架_資料不全',
        '已下架_資料異常',
        '臺灣雲市集來源，AI生成制式文案，無實質方案內容（price/website_url/target_industry 皆空），無原始資料源可補，2026-09-10人工複查確認'
    ),
    (
        'SOL-0075',
        '維持下架_資料不全',
        '已下架_資料異常',
        '臺灣雲市集來源，AI生成制式文案，無實質方案內容（price/website_url/target_industry 皆空），無原始資料源可補，2026-09-10人工複查確認'
    ),
    (
        'SOL-0137',
        '維持下架_資料不全',
        '已下架_資料異常',
        '臺灣雲市集來源，AI生成制式文案，無實質方案內容（price/website_url/target_industry 皆空），無原始資料源可補，2026-09-10人工複查確認'
    ),
    (
        'SOL-0188',
        '維持下架_資料不全',
        '已下架_資料異常',
        '臺灣雲市集來源，AI生成制式文案，無實質方案內容（price/website_url/target_industry 皆空），無原始資料源可補，2026-09-10人工複查確認'
    ),
    (
        'SOL-0355',
        '維持下架_資料不全',
        '已下架_資料異常',
        '臺灣雲市集來源，AI生成制式文案，無實質方案內容（price/website_url/target_industry 皆空），無原始資料源可補，2026-09-10人工複查確認'
    ),
    (
        'SOL-0474',
        '維持下架_資料不全',
        '已下架_資料異常',
        '臺灣雲市集來源，AI生成制式文案，無實質方案內容（price/website_url/target_industry 皆空），無原始資料源可補，2026-09-10人工複查確認'
    ),
    (
        'SOL-0513',
        '維持下架_資料不全',
        '已下架_資料異常',
        '臺灣雲市集來源，AI生成制式文案，無實質方案內容（price/website_url/target_industry 皆空），無原始資料源可補，2026-09-10人工複查確認'
    ),
    (
        'SOL-0593',
        '維持下架_資料不全',
        '已下架_資料異常',
        '臺灣雲市集來源，AI生成制式文案，無實質方案內容（price/website_url/target_industry 皆空），無原始資料源可補，2026-09-10人工複查確認'
    ),
    (
        'SOL-0619',
        '維持下架_資料不全',
        '已下架_資料異常',
        '臺灣雲市集來源，AI生成制式文案，無實質方案內容（price/website_url/target_industry 皆空），無原始資料源可補，2026-09-10人工複查確認'
    ),
    (
        'SOL-0680',
        '維持下架_資料不全',
        '已下架_資料異常',
        '臺灣雲市集來源，AI生成制式文案，無實質方案內容（price/website_url/target_industry 皆空），無原始資料源可補，2026-09-10人工複查確認'
    ),
    (
        'SOL-0736',
        '維持下架_資料不全',
        '已下架_資料異常',
        '臺灣雲市集來源，AI生成制式文案，無實質方案內容（price/website_url/target_industry 皆空），無原始資料源可補，2026-09-10人工複查確認'
    ),
    (
        'SOL-0834',
        '維持下架_資料不全',
        '已下架_資料異常',
        '臺灣雲市集來源，AI生成制式文案，無實質方案內容（price/website_url/target_industry 皆空），無原始資料源可補，2026-09-10人工複查確認'
    ),
    (
        'SOL-0876',
        '維持下架_資料不全',
        '已下架_資料異常',
        '臺灣雲市集來源，AI生成制式文案，無實質方案內容（price/website_url/target_industry 皆空），無原始資料源可補，2026-09-10人工複查確認'
    ),
    (
        'SOL-0904',
        '維持下架_資料不全',
        '已下架_資料異常',
        '臺灣雲市集來源，AI生成制式文案，無實質方案內容（price/website_url/target_industry 皆空），無原始資料源可補，2026-09-10人工複查確認'
    ),
    (
        'SOL-0906',
        '維持下架_資料不全',
        '已下架_公司歇業佐證',
        '臺灣雲市集來源，AI生成制式文案，無實質方案內容（price/website_url/target_industry 皆空），無原始資料源可補，2026-09-10人工複查確認'
    ),
    (
        'SOL-0242',
        '維持下架_公司有其他方案',
        '已下架_資料異常',
        '公司名下有其他正常上架方案，此筆異常不影響公司整體曝光'
    ),
    (
        'SOL-0491',
        '維持下架_公司有其他方案',
        '已下架_資料異常',
        '公司名下有其他正常上架方案，此筆異常不影響公司整體曝光'
    ),
    (
        'SOL-0772',
        '維持下架_公司有其他方案',
        '已下架_資料異常',
        '公司名下有其他正常上架方案（例如SOL-0772對應森福德有限公司的「旅宿E管家」），此筆異常不影響公司整體曝光'
    ),
    (
        'SOL-1044',
        '維持下架_空殼無公司關聯',
        '已下架_資料異常',
        'company_id 為 null，無法關聯任何公司，非唯一方案風險'
    ),
    (
        'SOL-1062',
        '維持下架_空殼無公司關聯',
        '已下架_資料異常',
        'company_id 為 null，無法關聯任何公司，非唯一方案風險'
    ),
    (
        'SOL-1066',
        '維持下架_空殼無公司關聯',
        '已下架_資料異常',
        'company_id 為 null，無法關聯任何公司，非唯一方案風險'
    ),
    (
        'SOL-1120',
        '維持下架_空殼無公司關聯',
        '已下架_資料異常',
        'company_id 為 null，無法關聯任何公司，非唯一方案風險'
    ),
    (
        'SOL-1122',
        '維持下架_空殼無公司關聯',
        '已下架_資料異常',
        'company_id 為 null，無法關聯任何公司，非唯一方案風險'
    ),
    (
        'SOL-1142',
        '維持下架_空殼無公司關聯',
        '已下架_資料異常',
        'company_id 為 null，無法關聯任何公司，非唯一方案風險'
    ),
    (
        'SOL-1149',
        '維持下架_空殼無公司關聯',
        '已下架_資料異常',
        'company_id 為 null，無法關聯任何公司，非唯一方案風險'
    ),
    (
        'SOL-1154',
        '維持下架_空殼無公司關聯',
        '已下架_資料異常',
        'company_id 為 null，無法關聯任何公司，非唯一方案風險'
    );

DO $$
DECLARE
    matched_solution_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO matched_solution_count
    FROM solution_review_seed AS seed
    JOIN public.solutions AS solution
      ON solution.solution_id = seed.solution_id;

    IF matched_solution_count <> 26 THEN
        RAISE EXCEPTION
            'solution_reviews seed validation failed: expected 26 matching solutions, found %',
            matched_solution_count;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM solution_review_seed AS seed
        JOIN public.solutions AS solution
          ON solution.solution_id = seed.solution_id
        WHERE solution.record_status IS DISTINCT FROM seed.expected_status
    ) THEN
        RAISE EXCEPTION
            'solution_reviews seed validation failed: one or more record_status values do not match';
    END IF;
END;
$$;

INSERT INTO public.solution_reviews (
    solution_id,
    reviewed_at,
    reviewer,
    trigger_reason,
    verdict,
    status_before,
    status_after,
    notes
)
SELECT
    seed.solution_id,
    '2026-09-10T00:00:00+08:00'::timestamptz,
    'PPC',
    '臺灣雲市集資料品質稽核',
    seed.verdict,
    seed.expected_status,
    seed.expected_status,
    seed.notes
FROM solution_review_seed AS seed
ORDER BY seed.solution_id;

COMMIT;

-- Manual post-migration checks:
--
-- SELECT COUNT(*) AS review_count
-- FROM public.solution_reviews
-- WHERE trigger_reason = '臺灣雲市集資料品質稽核'
--   AND reviewed_at::date = DATE '2026-09-10';
--
-- SELECT
--     review.solution_id,
--     review.verdict,
--     review.status_before,
--     review.status_after,
--     solution.record_status
-- FROM public.solution_reviews AS review
-- JOIN public.solutions AS solution
--   ON solution.solution_id = review.solution_id
-- WHERE review.solution_id IN ('SOL-0071', 'SOL-0242', 'SOL-1044')
-- ORDER BY review.solution_id;
--
-- The following verifies that a second review is allowed without persisting it:
-- BEGIN;
-- INSERT INTO public.solution_reviews (
--     solution_id, reviewer, trigger_reason, verdict, status_before, status_after, notes
-- )
-- SELECT
--     solution_id,
--     'PPC',
--     '重複審查測試',
--     '測試_不覆蓋',
--     record_status,
--     record_status,
--     'Transaction will be rolled back'
-- FROM public.solutions
-- WHERE solution_id = 'SOL-0071';
-- SELECT COUNT(*) AS review_count
-- FROM public.solution_reviews
-- WHERE solution_id = 'SOL-0071';
-- ROLLBACK;
