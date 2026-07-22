# 環境變數清單 — 產業策略智庫 / Solution Finder（不含真實金鑰值）

## Vercel 環境變數

| 名稱 | 用途 |
|---|---|
| `AIRTABLE_TOKEN` | Airtable API 存取 |
| `ANTHROPIC_API_KEY` | Claude API 呼叫 |

## Airtable

- Base ID：`appttP04OnzzC7qxG`
- Token 權限範圍：至少需要 `data.records:read`，涉及寫入需 `data.records:write`

## Supabase（遷移進行中）

| 名稱 | 用途 |
|---|---|
| `SUPABASE_URL` | 專案連線位址 |
| `SUPABASE_SERVICE_KEY` | 具完整權限的服務金鑰，僅限後端/Colab 使用 |
| `SUPABASE_ANON_KEY` | 前端可安全曝露的公開金鑰，搭配 RLS 限制存取範圍 |

## GitHub Repo

| Repo | 用途 |
|---|---|
| `Pcc329/solution-finder` | 主平台：前端 + API + 部署設定 |
| `Pcc329/weekly-report` | GitHub Pages 週報與 ETL 報告發布 |
| `Pcc329/daily-english` | 個人英文練習，跟本專案無關，排除在任何交接文件之外 |

## Google Colab

- 用 `getpass()` 在執行階段輸入 Token，不寫死在 notebook 裡
- Notebook 貼進去測試用的真實 Token，執行後記得清除該 cell 的輸出再存檔
