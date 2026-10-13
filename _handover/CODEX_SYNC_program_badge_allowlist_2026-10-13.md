# SYNC：「跨 N 種計畫」僅計入計畫佐證來源

日期：2026-10-13（Asia/Taipei）

## Git 資訊

- 最新 main 起點：`a1b420984ab0ae5f69acfadc28dfa0ed0b020f8b`（fetch 後建立獨立 worktree／分支，未帶入既有工作目錄異動）。
- Branch：`fix/program-badge-evidence-allowlist-2026-10-13`
- 程式與測試 commit：`4c022d0419269de63df78830a67bf5df215dd228`
- PR：[Pcc329/solution-finder#204](https://github.com/Pcc329/solution-finder/pull/204)，一般 PR，未 merge。
- [Vercel Preview](https://solution-finder-git-fix-progr-c87422-patrick0814-6136s-projects.vercel.app)
- 程式 commit 的 Vercel 部署狀態：success；Preview 畫面驗收仍待 PPC 執行，不以部署成功替代實測。
- CLI 認證沿用既有環境，不重設工具設定；透過已連接的 GitHub 工具提交，核對遠端 tree 與本機一致後同步本機分支。

## 改動檔案與行號

| 檔案 | 位置 | 改動 |
| --- | --- | --- |
| `api/solutions.js` | 第 7–19 行 | 新增 PPC 決定的允許清單與判斷原則註解 |
| `api/solutions.js` | 第 303 行 | 公司來源集合加入前檢查允許清單 |
| `tests/program-badge-allowlist.test.mjs` | 全文 | 新增 10 項 API handler 測試 |
| 本 SYNC | 全文 | 交接與驗證結果 |

未修改前端、其他 API、資料庫或 Airtable 讀取分支。沒有新增 Supabase 查詢／data_sources 對應，沿用已抓取的 `solRows`。已下架排除條件、來源 `p`、徽章門檻／圖示／文案不變。

## 前後對照

改前：所有非空 `program_type` 都加入公司集合。

```js
const pt = (row.program_type || '').trim();
if (!cid || !pt) return;
if (!programTypesByCid.has(cid)) programTypesByCid.set(cid, new Set());
programTypesByCid.get(cid).add(pt);
```

改後新增常數：

```js
// 「跨N種計畫」只計入可佐證政府計畫參與的資料來源（允許清單，2026-10-13 PPC 決定）。
// 判斷標準：出現在該來源，能否佐證公司通過某政府計畫審核。
// 不計入：SME AI平台、政府軟體採購網（政府平台收錄／採購資格）、資策會產業調查、案例反推補建（非政府／內部）。
// 新增來源預設不計入，需人工判斷後加入本清單。
const PROGRAM_EVIDENCE_SOURCES = new Set([
  '臺灣雲市集',
  '雲市集工業館',
  '新創嚴選網',
  '商業服務業專區',
  '農業雲市集-數位館',
  '新北產業AI化輔導計畫',
]);
```

集合加入條件改為：

```js
const pt = (row.program_type || '').trim();
if (!cid || !pt || !PROGRAM_EVIDENCE_SOURCES.has(pt)) return;
if (!programTypesByCid.has(cid)) programTypesByCid.set(cid, new Set());
programTypesByCid.get(cid).add(pt);
```

既有第 356–357 行不需修改：`pgc` 和 `pgList` 共用這個已過濾的集合，數字與明細相符。

```js
pgc: programTypesByCid.get(cid)?.size || 0,
pgList: Array.from(programTypesByCid.get(cid) || []),
```

比對前只沿用 `.trim()`，不轉換台／臺、不補正來源名稱。集合仍去重並維持既有插入順序。排除來源仍有方案回傳、仍保留原始 `p`；此任務不是從方案列表刪掉這些來源。

## 測試結果

驗證來源：本機合成 fixture 與 mock fetch，直接執行目前 `api/solutions.js` 的 handler；沒有呼叫線上 API 或執行 SQL。

```text
node --test tests/program-badge-allowlist.test.mjs
tests 10 / pass 10 / fail 0

node --test tests/*.test.mjs
tests 64 / pass 64 / fail 0

node --check api/solutions.js
通過

git diff --check
通過
```

10 項新測試涵蓋：

| 情境 | 結果 |
| --- | --- |
| 臺灣雲市集＋資策會產業調查 | `pgc=1`，`pgList=['臺灣雲市集']` |
| 臺灣雲市集＋SME AI平台＋政府軟體採購網 | `pgc=1` |
| 臺灣雲市集＋新創嚴選網＋SME AI平台 | `pgc=2`，只列臺灣雲市集／新創嚴選網 |
| 六個允許名稱＋四個排除名稱＋新來源 | `pgc=6`，僅列六個允許名稱 |
| 僅排除／未知來源 | `pgc=0`、`pgList=[]` |
| 空白 trim、重複來源、台／臺 | trim 後去重；`台灣雲市集` 不會自動視為 `臺灣雲市集`；`p` 原字串不改 |
| 已下架／已下架_資料異常／疑似已下架／NULL | 原查詢參數逐字不變；mock 依該參數模擬排除已下架，保留疑似已下架與 NULL |
| 不同統編、無統編、空來源 | 公司間不互相污染，無統編不計入 |
| 來源 `p`／`src` 與方案筆數 | 原始來源標籤與方案保持，僅徽章集合改變 |
| Airtable 讀取分支 | 原查詢／輸出保持：`p` 不變、既有 `pgc=0`／`pgList=[]` 不變 |

下架行為的測試是查詢參數核對加本機模擬，不冒充真實 PostgREST 資料驗證。Supabase 測試仍只有既有 7 次讀取，Airtable 測試只有既有 2 次讀取，不新增查詢。

另比對起點 main：將新增常數／註解移除、把單一 guard 復原後，整份 `api/solutions.js` 文字與 main 完全相同（比較時僅正規化檔案 CRLF／LF）。因此其他查詢、已下架條件、`p`、輸出格式、auth 與 Airtable 分支都未改。

Node 的既有 module type 提示不是測試失敗，未為此修改 package.json 或環境設定。

## PPC 名稱核對結果

來源：PPC 在本次任務訊息中提供的真實查詢結果，非 Codex 重跑或 CSV 推算。

- `program_type` 共 **10 個值**。
- 未下架方案合計 **2,268 筆**。
- 允許清單 **6 個名稱逐字相符**。
- 清單內方案 **1,751 筆**；其餘來源方案合計 **517 筆**（2,268－1,751，這是方案筆數，不是公司數或徽章數）。
- PPC 未提供逐來源的各別筆數，故本文件不補造各來源明細。

名稱核對原查詢（唯讀，提供備查；本次 Codex 未執行）：

```sql
select program_type, count(*) as 筆數
  from public.solutions
 where record_status is null or record_status not like '已下架%'
 group by 1 order by 2 desc;
```

## 影響範圍：待 PPC 提供結果

本次尚未收到以下四個公司數，不以 1,751 筆方案數替代公司數，也不推算徽章消失／縮小的公司數。

| 指標 | 結果 |
| --- | --- |
| 現行有徽章公司數 | 待 PPC 執行／提供 |
| 改後有徽章公司數 | 待 PPC 執行／提供 |
| 徽章消失公司數 | 待 PPC 執行／提供 |
| 數字變小公司數 | 待 PPC 執行／提供 |

規格書影響範圍查詢（唯讀，Codex 未執行）：

```sql
with active as (
  select company_id, trim(program_type) as pt
    from public.solutions
   where coalesce(company_id,'') <> '' and coalesce(program_type,'') <> ''
     and (record_status is null or record_status not like '已下架%')
),
cnt as (
  select company_id,
         count(distinct pt) as 現行計數,
         count(distinct pt) filter (where pt in ('臺灣雲市集','雲市集工業館','新創嚴選網',
                                               '商業服務業專區','農業雲市集-數位館','新北產業AI化輔導計畫')) as 新計數
    from active group by company_id
)
select count(*) filter (where 現行計數 >= 2)                    as 現行有徽章公司數,
       count(*) filter (where 新計數 >= 2)                      as 改後有徽章公司數,
       count(*) filter (where 現行計數 >= 2 and 新計數 < 2)     as 徽章消失公司數,
       count(*) filter (where 新計數 >= 2 and 新計數 < 現行計數) as 數字變小公司數
  from cnt;
```

## Preview 實測：待 PPC 執行

1. 登入上方 PR #204 Preview。
2. 任選一家公司原計數至少 2、新計數低於 2：方案卡片與詳情不再顯示「跨 N 種計畫」徽章；來源標籤仍保持。
3. 任選一家公司新計數仍至少 2、但小於原計數：卡片徽章數字變小，詳情只列允許清單內來源，`pgList.length` 與 `pgc` 一致。
4. 確認原本排除／疑似下架行為及搜尋結果未變，回傳方案 `p` 不因徽章允許清單而改名或消失。

尚未由 Codex 操作這兩組真實公司畫面，不宣稱 Preview 已驗收，不提供 mock 畫面冒充線上截圖。

## 驗收清單

- [x] 臺灣雲市集＋資策會產業調查只計 1。
- [x] 臺灣雲市集＋SME AI平台＋政府軟體採購網只計 1。
- [x] 臺灣雲市集＋新創嚴選網＋SME AI平台計 2，明細一致。
- [x] 新來源預設不計入。
- [x] 沿用 trim，不做其他名稱正規化。
- [x] 既有已下架排除條件不變；本機模擬仍排除已下架、保留疑似已下架。
- [x] `p` 來源標籤及方案本身不受影響。
- [x] 六個名稱逐字相符：已由 PPC 查證。
- [x] 前端、其他 API、Airtable 分支、資料庫皆未修改，沒有新增查詢。
- [x] 獨立新分支／新 PR，未 merge。
- [ ] 影響範圍四個公司數：待 PPC 執行／提供結果。
- [ ] Preview 徽章消失與數字變小各一家：待 PPC 執行。
