# Airtable 專屬地雷記錄

> 這份只收錄「換一個資料庫工具就不會遇到」的 Airtable 專屬問題。
> 通用資料清洗模式見 `core/data-cleaning-patterns.md`。

## BOM 字元（`\ufeff`）逐表不同、方向不一致

- Solutions 表：只有 `solution_id` 欄位帶 BOM
- Companies 表：`company_id` 欄位帶 BOM
- 必須逐表處理，讀取要 strip，寫入要用帶 BOM 的欄位名稱
- 建議做法：`bom_map = {f.lstrip('\ufeff'): f for f in all_fields}`，用查表方式找到正確欄位名

## `filterByFormula` 對中文 Single Select 值不可靠

一律先抓全部記錄，在 Python 端用 pandas 過濾，不要依賴 Airtable 端的公式篩選

## Linked Record 欄位的陷阱

- Contacts / Digital_needs / Solutions 的 `company_id` 欄位，Airtable API 回傳格式是 `["recXXXX"]` 陣列，不是純文字的統一編號
- 必須先建立「record_id → 統編」對照表，直接拿統編字串去比對會導致外鍵 100% 落空

## Multiple Select 新增選項需要 `typecast: True`

否則寫入不存在的選項值會直接報 `INVALID_VALUE_FOR_COLUMN`

## Airtable 429 處理

- 指數退避：`0.3 × 2^attempt` 秒
- 寫入操作：每筆間隔 0.25 秒
- 分頁抓取：每頁間隔 0.2 秒

## 新欄位建立標準（本專案訂立，2026-07-16）

每個新欄位都要有三要素：①名稱 ②格式（含 Single Select 的選項清單）③說明（寫進 Airtable 欄位 Description）。沒有說明的欄位不接受建立。

## Colab 執行環境

- 每次重跑：先重新抓取 Airtable 最新狀態，再建立寫入清單，避免用舊清單重複建立
- Selenium 在 Colab（Ubuntu 22.04 snap 版本）不可用，改用 Playwright + `playwright install-deps chromium` + async API
- Cloudflare 防護網站（如農業雲市集 agdigi.atri.org.tw）：requests / Playwright 都會被擋，唯一可行方法是瀏覽器端手動 DOM 擷取
