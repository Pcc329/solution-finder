-- Creates the independent data_sources registry used by data freshness audits.
-- Seed count: 12 (SRC-001 through SRC-012). The specification heading says 9,
-- but its INSERT list and acceptance criteria explicitly require 12 records.

BEGIN;

CREATE TABLE public.data_sources (
    source_id TEXT PRIMARY KEY,
    source_name TEXT NOT NULL,
    url TEXT,
    organizer TEXT,
    program_name TEXT,
    program_year TEXT,
    co_organizer TEXT,
    acquisition_channel TEXT,
    crawl_status TEXT,
    technical_note TEXT,
    related_source_id TEXT,
    last_liveness_check DATE,
    last_crawl_date DATE,
    record_count_estimate INTEGER,
    data_freshness_status TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.data_sources (
    source_id, source_name, url, organizer, program_name, program_year,
    co_organizer, acquisition_channel, crawl_status, technical_note,
    related_source_id, data_freshness_status, notes
) VALUES
('SRC-001', '臺灣雲市集', 'https://tcloud.gov.tw/', NULL, NULL, NULL, NULL,
 '組長提供', '已下架無需爬取', '平台已全站停止服務', NULL,
 '稽核完成', '1222筆分層標記：153確認(已下架_平台停止服務)+1069推定(疑似已下架_平台停止服務未逐筆驗證)。主辦單位/計畫名稱/年度因平台已關站無法考證。'),

('SRC-002', '商業服務業專區', 'https://www.smebiz.org.tw/service-ai.php', '經濟部商業發展署', NULL, NULL, NULL,
 '組長提供', '需繞過技術限制', 'service-ai.php僅18筆精選頁，非完整目錄；正式比對來源為官方入選名單PDF公告', NULL,
 '稽核完成', '117/117筆已比對官方PDF入選名單全數確認有效，無需標記下架。另一參考網址：https://www.sme.gov.tw/drsme/drsme/Plan/plan_more?id=ecf4d02e04094b04a50264a8582920e2。計畫名稱/年度/協辦單位待補。'),

('SRC-003', '雲市集工業館-AI工具庫方案', 'https://keid.nat.gov.tw/cloud/Web/ai_solution.aspx', '經濟部產業發展署', '產業競爭力輔導團', '115年',
 '財團法人中國生產力中心', '自行搜尋發現', '可直接爬', NULL, 'SRC-004',
 '稽核完成', '雲市集工業館三頁之一，稽核結果：139筆疑似下架、50維持、4筆company_id修復、136筆歷史資料缺口。'),

('SRC-004', '雲市集工業館-AI工具庫Lite版', 'https://keid.nat.gov.tw/cloud/Web/AITools_solution.aspx', '經濟部產業發展署', '產業競爭力輔導團', '115年',
 '財團法人中國生產力中心', '自行搜尋發現', '可直接爬', '筆數從39筆(2026-06)成長至126筆(2026-08)，需增量複查', 'SRC-003',
 '需增量複查', '與eii.nat.gov.tw/moeai-plus/ai-tools為同一頁面的不同入口（eii為說明頁，此為實際清單頁），非全新來源。'),

('SRC-005', '雲市集工業館-雲端解決方案', 'https://keid.nat.gov.tw/cloud/Web/cloud_solution.aspx', '經濟部產業發展署', '產業競爭力輔導團', '115年',
 '財團法人中國生產力中心', '自行搜尋發現', '可直接爬', NULL, 'SRC-003',
 '稽核完成', '雲市集工業館三頁之一，與SRC-003/SRC-004同計畫。'),

('SRC-006', '政府軟體採購網', 'https://gsmarket.adi.gov.tw/portal/', '數位發展部數位產業署', '數位服務採購環境躍升計畫', '常設平台',
 '財團法人資訊工業策進會', '同仁提供', '可直接爬', NULL, NULL,
 '稽核完成', '已匯入100筆，資料由III中心同仁提供，8/21確認存活。'),

('SRC-007', '新北產業AI化輔導-經發局頁', 'https://www.economic.ntpc.gov.tw/Custom/AITransformation', '新北市政府經濟發展局', '新北產業AI化輔導計畫', '115年',
 '台灣智慧雲端服務股份有限公司', '組長提供', '可直接爬', 'HTML表格版，建議優先使用此網址', 'SRC-008',
 '尚未稽核', '56筆待稽核。'),

('SRC-008', '新北產業AI化輔導-媒合平台', 'https://ntpc-ai.ntpc.gov.tw/vendors', '新北市政府經濟發展局', '新北產業AI化輔導計畫', '115年',
 '台灣智慧雲端服務股份有限公司', '組長提供', '需繞過技術限制', '純JS動態載入，fetch抓不到資料；資料與SRC-007相同，技術卡關時改用SRC-007', 'SRC-007',
 '尚未稽核', NULL),

('SRC-009', '農業雲市集-數位館', 'https://agdigi.atri.org.tw/Market', '農業部', '雲世代產業數位轉型-農漁產銷與農機創新營運計畫', '110年度起',
 '財團法人農業科技研究院', '組長提供', '需繞過技術限制', 'Cloudflare Turnstile阻擋，requests/Playwright headless皆失敗，需採瀏覽器localStorage手動擷取法', NULL,
 '尚未稽核', '93筆待稽核。'),

('SRC-010', 'SME AI平台', 'https://www.smeai.tw/service/category-card', NULL, NULL, NULL, NULL,
 '自行搜尋發現', '需繞過技術限制', 'JS動態載入', NULL,
 '尚未稽核', '279筆，8/21確認存活，主辦單位/計畫名稱/年度/協辦單位待補。'),

('SRC-011', '新創嚴選-解決方案', NULL, '經濟部中小及新創企業署', '新創嚴選', NULL, NULL,
 '同仁提供', '後台匯出不需爬蟲', '資料由後台直接匯出，非爬蟲取得', NULL,
 NULL, '152筆已匯入，年度/協辦單位待補。'),

('SRC-012', '新創嚴選-示範案例', 'https://startup.sme.gov.tw/startupselect/article', '經濟部中小及新創企業署', '新創嚴選', NULL, NULL,
 '組長提供', '人工複製', 'robots.txt阻擋自動化存取，採人工逐篇複製', NULL,
 '稽核完成', '共複製39篇文章，經v4篩選標準審核後24篇通過納入Cases表，15篇改列入Solutions。年度/協辦單位待補。');

COMMIT;
