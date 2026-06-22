# CODEX SYNC - manufacturing analyze Haiku

日期：2026-06-22
分支：feat-diagnosis-agent-v1

## 修改範圍

- `api/manufacturing-analyze.js`
- 未修改 `api/manufacturing-recommend.js`
- 未修改 prompt、JSON schema、文件輸入結構、前端。

## model / temperature 改動

`api/manufacturing-analyze.js` 已從：

```js
model: 'claude-sonnet-4-5',
max_tokens: 1200,
```

改為：

```js
model: 'claude-haiku-4-5-20251001',
max_tokens: 1200,
temperature: 0,
```

目的：PDF 結構化萃取改用 Haiku，降低輸入 token 成本；推薦與顧問結論仍由 Sonnet 負責。

## manufacturing-recommend 確認

`api/manufacturing-recommend.js` 未被修改，仍使用：

```js
model: 'claude-sonnet-4-5'
```

## 實測狀態

本地未執行實際 PDF 上傳測試，原因：

- 此工作環境沒有可用的 `ANTHROPIC_API_KEY`。
- 沒有在本地啟動 Vercel serverless runtime 做端到端上傳測試。

已完成的可驗證項目：

- `node --check api/manufacturing-analyze.js` 通過。
- `node --check api/manufacturing-recommend.js` 通過。
- `git diff` 確認只改 analyze API 的 `model` 與 `temperature`。

建議在 Vercel Preview 實測：

1. 上傳達易智造評量表 PDF，確認 `company_name / industry / size / pain_points / keyword`。
2. 上傳禾乃川診斷報告 PDF，確認同樣欄位。
3. 確認前端推薦與結論流程不受影響。

