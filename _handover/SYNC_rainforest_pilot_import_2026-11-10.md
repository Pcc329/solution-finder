# SYNC 智慧雨林擴散案試點匯入

## 交付

- 分支 `codex/rainforest-pilot-import`，基準 `915bed88cd71e25ba1817167fe56f6698f9690be`。
- 功能 commit `0bd5b38e0cf8f7dc0f3c9b1be35aa34fb1f69beb`，明確寫入 NULL 的 SQL 修訂 `c927f0e2a85af7437cbe3f6c1d4d5b1d3f045583`。[PR #304](https://github.com/Pcc329/solution-finder/pull/304)
- 功能 commit 的 Vercel Preview 建置成功。正式 Supabase 尚未執行 migration，線上 Preview 的兩筆方案與正式筆數待驗收。[Vercel 建置](https://vercel.com/patrick0814-6136s-projects/solution-finder/De5e2JNdyr6ggeVJSmhdad3PZcNB)

| 檔案 | 內容 |
| --- | --- |
| `migrations/20261110_rainforest_pilot_import.sql` | 同一交易新增一筆來源、一家公司、兩筆方案；公司已存在或新增後來源筆數不等於二時中止。 |
| `api/solutions.js:8` | `PROGRAM_EVIDENCE_SOURCES` 白名單，第 17 行加入智慧雨林。核定名單可佐證公司參與計畫，個別產品內容仍為廠商自述。 |
| `api/claude.js:36` | 語意搜尋提示的來源選項。第 63 行將來源名稱內的「官網」排除於行銷類別推斷。 |
| `public/index.html:100` | `PROGRAMS` 來源白名單，供篩選與解析使用。第 591 行處理只輸入完整來源名稱的備援查詢。第 1790、2066、2074 行顯示新來源徽章及詳情提示。 |
| `public/sources.html:582` | 來源摘要及動態筆數。第 807 行新增詳細來源卡、名單連結及人工查核說明。第 1014 行更新資料結構圖的來源數。 |
| `supabase/functions/sf-mcp/index.ts:54` | `DATA_GUIDE` 的資料來源清單及說明。狀態說明涵蓋廠商官網公開方案。 |
| `tests/program-badge-allowlist.test.mjs:7` | 第 203 行起覆蓋新增來源、精確名稱與同公司去重。 |
| `tests/sources-page.test.mjs:10` | 更新來源卡數量及人工查核說明驗證。 |
| `tests/sf-mcp/sf-mcp-v1-2.test.mjs:307` | 更新 MCP 資料指南的預期文字。 |
| `_handover/SYNC_rainforest_pilot_import_2026-11-10.md` | 交接、驗收證據及 SQL 全文。 |

`api/stats.js` 按 `program_type` 動態計數。製造業探索與戰情儀表板的近期更新可直接顯示 `data_source`。戰情儀表板和策略智庫另外維護的 `categories` 是策略分類，補助平台盤點也有獨立統計範圍。這些分類與 `program_type` 白名單各自獨立。

### 欄位對應與決定

- `data_sources.source_id` 使用 `SRC-RF-001`。`url` 是核定名單的線索頁；兩筆方案的 `website_url` 是各自的產品頁。`solutions.data_source` 與 `program_type` 使用同一完整來源名稱，讓各畫面可沿用既有顯示方式。
- 公司更名歷程使用既有 `companies.note`。公司縣市、地區、資本額與成立日期，以及方案價格、月費、類別、目標產業與服務區域，明確寫入 NULL。其餘未查證欄位未提供值，由資料庫套用欄位定義。
- 新徽章使用與製造業探索頁資策會產業調查來源相同的 slate 配色。首頁既有詳情徽章保留原有 class 組合。
- 既有交接與程式碼可確認 `solutions.data_source` 用於來源顯示。未找到已確認可用於核定計畫名稱的方案欄位，對照保留在此。

| 方案 ID | 方案 | 對應擴散案計畫 |
| --- | --- | --- |
| `SOL-RF-0001` | EO Insights | EO Insights「AI 驅動的 Google Maps 與本地 SEO 自動優化與營運監測平台」 |
| `SOL-RF-0002` | AI客服－資深員工 | 新世代餐飲旅宿 AI 知識擴散平台「企業級雙引擎 AI 助理」導入計畫 |

## 驗收

| 項目 | 證據 |
| --- | --- |
| 首次執行 | 本機 PGlite 0.5.15（PostgreSQL 18.6）。`data_sources` 使用既有建表 migration，`companies` 和 `solutions` 用涵蓋匯入欄位的測試結構。新增來源 1、公司 1、方案 2。逐列比對確認既有資料相同。 |
| 重跑與回滾 | 已有 `90249191` 時回報該公司已存在。缺少 `50932719`、方案 ID 重複、已有其他方案使自檢計數大於 2，三種情形均確認交易回滾且資料與各自執行前完全相同。 |
| 搜尋與詳情 | Edge 離線使用本機 SQL 結果，由實際 API handler 產出資料。`EO Insights` 經模擬語意解析，`資深員工` 經解析失敗備援，各顯示一筆。詳情分別顯示快帶科技股份有限公司、晶新資訊，兩筆都有灰色來源徽章與廠商自述提示。完整來源名經備援搜尋顯示兩筆。 |
| 既有來源相容性 | 同一組樣本下，比對基準和分支的舊方案 API JSON、首頁既有篩選按鈕、臺灣雲市集詳情徽章 class 及來源頁筆數，結果相同。 |
| 自動測試 | `node --test 'tests/*.test.mjs'` 共 289 項通過；`tests/sf-mcp` 的 `npm test` 共 84 項通過。`git diff --check` 通過。 |
| 正式 schema 與筆數 | 本機 fixture 驗收未讀取正式 Supabase 的欄位預設值或資料。正式站的每來源筆數與已登入的 Preview 資料仍待驗收。 |

### 首頁與資料來源頁筆數對照（離線測試資料）

首頁總數及資料來源頁筆數使用同一組 `/api/stats` 回傳。

| 來源 | 匯入前 | 匯入後 |
| --- | ---: | ---: |
| 臺灣雲市集 | 1 | 1 |
| 雲市集工業館 | 1 | 1 |
| 農業雲市集-數位館 | 1 | 1 |
| 農業雲市集-AI館 | 1 | 1 |
| 資策會產業調查 | 1 | 1 |
| SME AI平台 | 1 | 1 |
| 商業服務業專區 | 1 | 1 |
| 新創嚴選網 | 1 | 1 |
| 新北產業AI化輔導計畫 | 1 | 1 |
| 政府軟體採購網 | 1 | 1 |
| 智慧雨林擴散案（廠商官網） | 0 | 2 |
| 首頁累計方案 | 10 | 12 |

### 上線順序

1. 合併 PR 並確認網站部署完成。執行 SQL 前擷取正式站 `/api/stats` 的 `total` 和 `byProgramType`。如有 Preview 專用資料庫，可先在該環境執行本 migration 並登入驗收兩筆方案。
2. 在正式 Supabase SQL Editor 執行本 migration。若欄位、約束或前置資料不符而中止，保留錯誤並檢查實際 schema 後再決定對應方式。
3. 重新擷取 `total` 和 `byProgramType`，確認試點來源為 2，其他來源與上線前一致。登入搜尋 `EO Insights` 和 `資深員工`，核對詳情公司與來源頁說明。
4. 依既有 sf-mcp 部署流程更新 Edge Function，透過 `describe_data` 確認新來源說明。

## Migration 全文

```sql
begin;

do $migration$
declare
  rainforest_source constant text := '智慧雨林擴散案（廠商官網）';
begin
  insert into public.companies (company_id, company_name, website, note, city, region, capital, established_date)
  values ('90249191', '快帶科技股份有限公司', 'https://www.kuai-dai.com',
          '115/07/27 由「快帶科技有限公司」更名，統編不變（商工登記公示資料名稱變更歷程）。',
          null, null, null, null)
  on conflict (company_id) do nothing;

  if not found then
    raise exception '智慧雨林試點中止：公司 90249191 已存在。';
  end if;

  perform 1 from public.companies where company_id = '50932719' for key share;
  if not found then
    raise exception '智慧雨林試點中止：找不到既有公司 50932719。';
  end if;

  if exists (select 1 from public.data_sources where source_name = rainforest_source) then
    raise exception '智慧雨林試點中止：來源「%」已存在。', rainforest_source;
  end if;

  insert into public.data_sources (
    source_id, source_name, url, organizer, program_name, program_year,
    acquisition_channel, record_count_estimate, notes
  ) values (
    'SRC-RF-001', rainforest_source, 'https://www.stsvpo.org.tw/tw/downloads/48', '經濟部商業發展署',
    '大南方新矽谷推動方案 115 年度智慧雨林產業創生計畫－智慧商業服務領域', '115年度',
    '以擴散案核定名單為線索，人工查核廠商官網', 2,
    '擴散案核定之資服業者中，官網有具名產品且與核定計畫名稱相關者，以人工查核收錄；方案內容為廠商自述，未經平台審核。'
  );

  insert into public.solutions (
    solution_id, company_id, solution_name, program_type, data_source, website_url,
    description_short, has_ai, record_status, price, monthly_price,
    industry_category, target_industry, service_region
  ) values
    ('SOL-RF-0001', '90249191', 'EO Insights', rainforest_source, rainforest_source,
     'https://www.kuai-dai.com/insights.html',
     '從各門市的 Google 評論，找出出餐、食安、服務問題，接近即時用 LINE 通知總部、區域督導和店長。', true, '正常',
     null, null, null, null, null),
    ('SOL-RF-0002', '50932719', 'AI客服－資深員工', rainforest_source, rainforest_source,
     'https://www.jxinfo.com.tw/service_detail.php?id=43',
     '結合了最先進的 RAG（檢索增強生成）技術與雙軌混合檢索架構，將企業內部的營運規章、產品手冊與 FAQ 轉化為永不離開、24 小時在線的數位資深員工。', true, '正常',
     null, null, null, null, null);

  if (select count(*) from public.solutions where program_type = rainforest_source) <> 2 then
    raise exception '智慧雨林試點中止：來源「%」的方案筆數不是 2。', rainforest_source;
  end if;
end;
$migration$;

commit;
```
