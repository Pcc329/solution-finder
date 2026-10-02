-- ============================================================
-- 稅籍行業代號匯入（2026-10-02 已於正式站執行）
-- 來源：資服業者總表_-_六萬多筆資訊_0130_EXCEL.xlsx（同事提供；財政部營業登記擷取；快照 2026-01-29）
-- 範圍：只充實現有 companies（1,103 家中 849 家在名冊），不整批匯入名冊（PPC 決策：在精不在多）
-- 結果：company_tax_industry 2,376 列／849 家；companies.it_code_rank 分布 0:164、1:424、2:141、3:91、4:29、NULL:254（不在名冊）
--       region/city 補值 346 家（只補空值；苗栗歸中部）；company_field_log 留痕 1,541 筆
-- 刻意未做：3 家 SF 現有 city 與稅籍登記地不同者（22023793、50767268、83764072）未覆蓋，待 PPC 判斷「營運據點 vs 登記地」
-- 設計：資料庫存數字（it_code_rank），畫面顯示事實（tax_primary_name：「稅籍主業：○○」）；排序先標示不重排
-- ============================================================

CREATE TABLE public.company_tax_industry (
  company_id    text NOT NULL REFERENCES public.companies(company_id) ON DELETE CASCADE,
  code_rank     smallint NOT NULL CHECK (code_rank BETWEEN 1 AND 4),
  code6         text NOT NULL CHECK (code6 ~ '^[0-9]{6}$'),
  code_name     text,
  snapshot_date date NOT NULL,
  source        text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, code_rank)
);
COMMENT ON TABLE public.company_tax_industry IS '財政部營業（稅籍）登記的行業代號（6碼，最多4個，code_rank=申報順序）。來源：同事提供之資服業者總表（2026-01 快照）。代號為營業人自行申報、少更新；僅前2碼可對應大類（62/63=資訊服務）。';
CREATE INDEX company_tax_industry_code6_idx ON public.company_tax_industry (code6);
ALTER TABLE public.company_tax_industry ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_tax_industry FROM anon, authenticated;
GRANT SELECT ON public.company_tax_industry TO anon, authenticated;
CREATE POLICY public_read ON public.company_tax_industry FOR SELECT TO anon USING (true);
CREATE POLICY mcp_read   ON public.company_tax_industry FOR SELECT TO authenticated USING (public.sf_mcp_ok());

ALTER TABLE public.companies
  ADD COLUMN it_code_rank smallint CHECK (it_code_rank BETWEEN 0 AND 4),
  ADD COLUMN tax_primary_code text,
  ADD COLUMN tax_primary_name text;
COMMENT ON COLUMN public.companies.it_code_rank IS '稅籍登記中 62/63（資訊服務）代號首次出現的順位：1~4；0=登記中無62/63；NULL=不在名冊（未知，不可當作0）。';
COMMENT ON COLUMN public.companies.tax_primary_code IS '稅籍登記第1個行業代號（6碼）';
COMMENT ON COLUMN public.companies.tax_primary_name IS '稅籍登記第1個行業代號名稱（畫面顯示「稅籍主業：○○」用）';

CREATE TABLE public.company_field_log (
  id          bigserial PRIMARY KEY,
  company_id  text NOT NULL,
  field_name  text NOT NULL,
  old_value   text,
  new_value   text,
  reason      text NOT NULL,
  changed_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.company_field_log IS '公司資料欄位變更留痕（來源、改前值、原因）。後台用，前端與 MCP 不讀取。';
CREATE INDEX company_field_log_company_idx ON public.company_field_log (company_id);
ALTER TABLE public.company_field_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_field_log FROM anon, authenticated;

-- 資料匯入：以暫存表載入三份字串（代號字典、每家公司代號序列、地區補值），
-- 於單一交易中：INSERT company_tax_industry → 留痕 → UPDATE companies（it_code_rank/tax_primary_*）→ 留痕 → 只補空的 region/city。
-- 名冊端處理：29 列重複統編取第一列（4 個統編內容不同）；一格含多代號者拆開；5 碼代號（13099、32212）略過；429099 無名稱。
-- 縣市→區域對照取自網站既有資料（宜蘭=北部、花蓮臺東=東部、嘉義=南部、雲林彰化=中部），另定苗栗、南投=中部、屏東=南部。

-- 回滾（整案撤銷）：
-- BEGIN;
-- UPDATE public.companies c SET region = NULL FROM public.company_field_log l WHERE l.company_id=c.company_id AND l.field_name='region' AND l.old_value IS NULL AND l.reason LIKE '2026-10-02%';
-- UPDATE public.companies c SET city   = NULL FROM public.company_field_log l WHERE l.company_id=c.company_id AND l.field_name='city'   AND l.old_value IS NULL AND l.reason LIKE '2026-10-02%';
-- ALTER TABLE public.companies DROP COLUMN it_code_rank, DROP COLUMN tax_primary_code, DROP COLUMN tax_primary_name;
-- DROP TABLE public.company_tax_industry;
-- DROP TABLE public.company_field_log;   -- 若之後有其他留痕則改為 DELETE WHERE reason LIKE '2026-10-02%'
-- COMMIT;
