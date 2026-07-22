# SETUP — 產業策略智庫 / Solution Finder 專案專屬

> 這份是這個專案的專屬事實，通用方法論請看 `core/`。

## 一、這是什麼專案

- 資策會數位轉型研究院「產業策略智庫」，AI 語意搜尋智庫，彙整台灣中小企業數位轉型補助與解決方案
- 服務對象：內部顧問輔導團隊，不是對外產品

## 二、誰是誰

- 直屬組長：Carrie，負責耕偉組、中原組兩個顧問團隊
- 平行合作團隊：坤達領軍的共構平台組，是 MCP 整合的潛在合作對象
- 自身定位：「軍火供應者」——做資料底層，不跟其他團隊的產品範疇重疊

## 三、系統跟資料在哪

- Airtable Base ID：`appttP04OnzzC7qxG`
- 主要資料表：Solutions（`tblqQkVQ4dSo7xgoE`）、Companies（`tblkOaOBGK96vfRm1`）、Cases（`tblgkjVcaohcQntzV`）、Contacts（`tblAn0hEu2zVbksq3`）
- 前端部署：Vercel，主網址 `solution-finder-gray.vercel.app`
- GitHub Repo：`Pcc329/solution-finder`（主平台）、`Pcc329/weekly-report`（週報與 ETL 報告發布）
- 週報/ETL 報告公開頁面：`pcc329.github.io/weekly-report/`
- 資料庫遷移狀態：Airtable → Supabase 遷移進行中，查最新交接清冊確認階段進度

## 四、目前工作模式

- 標準流程：Claude 產規格書 → 貼給 Codex（chatgpt.com/codex）執行 → Codex 回傳 SYNC.md → Claude review → PR → Vercel Preview 驗收 → Merge
- 資料匯入：Google Colab，手動分段執行
- 詳見 `core/workflow-pipeline.md`

## 五、正在做的事 vs 之後才要做的事

查最新一份交接清冊的「進行中」與「刻意不做的事」章節。

已知的「刻意不做」案例：
- MCP Server 整合：有三個明確觸發條件（案例庫需跨源查詢 / Supabase 遷移完成 / 坤達團隊主動提出需求），條件不到不主動推進
- 院內開發環境標準化（GitLab/DB/前端架構）：組長層級的討論，範圍可能大於本專案，先聽不先提方案

## 六、跟本專案無關、要分開看的東西

- `daily-english` repo：個人英文練習，跟工作完全無關
- `career-log` 私人 repo：職涯轉換相關的個人資產，跟公司系統嚴格分開
- 這份 `workflow-kit` 的 `core/` 資料夾本身：屬於個人可攜帶資產，`instances/` 底下才是公司資產
