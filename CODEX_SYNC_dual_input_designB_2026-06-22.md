# CODEX SYNC - dual input Design B

日期：2026-06-22
分支：feat-diagnosis-agent-v1

## 修改範圍

- `public/manufacturing.html`
- 未修改 API、版面結構、推薦排序、公司名稱不一致警告。

## 四項改動

1. `analyzeDocument(file, mediaType, sourceLabel)`
   - 文件讀取開始時停用 `refs.agentInput` 與 `refs.agentSendBtn`。
   - 對話提示改為「正在讀取...問答功能暫停」。
   - 使用 `finally` 確保讀取成功或失敗後恢復輸入與送出按鈕。

2. `handleAnswer(value)`
   - 新增 `hasUpload = !!extractedData || (Array.isArray(uploadedDocuments) && uploadedDocuments.length > 0)`。
   - 已上傳文件後，對話只顯示固定引導訊息，不寫入 `profile`、不推進 `stepIndex`、不觸發 `runExplore()`。
   - 新增 `uploadChatNoticeShown`，避免使用者連續輸入時重複洗版。

3. 上傳完成訊息
   - 保留 `result.agentMessage`。
   - 追加固定狀態訊息：「已讀取文件，分析將以文件內容為準；此對話不會修改文件條件」。

4. `clearAllFiles()`
   - 完整重置文件與問答狀態：
     - `extractedData`
     - `extractedDataAssessment`
     - `extractedDataDiagnosis`
     - `documentText`
     - `uploadedDocuments`
     - `companyNameConflictIgnored`
     - `uploadChatNoticeShown`
     - `profile`
     - `stepIndex = 0`
     - `conversationHistory = []`
   - 清除結果區、進度條與 sessionStorage。
   - 恢復輸入框與送出鈕。
   - 呼叫 `askCurrentQuestion()` 回到乾淨問答起點。

## 驗收檢查

- 讀取中：`analyzeDocument()` 會鎖定輸入框與送出鈕，並在 `finally` 恢復。
- 已上傳後打字：`handleAnswer()` 只回固定引導訊息，不污染 `profile`，不重複洗版。
- 清除後打字：`clearAllFiles()` 會將 `stepIndex` 歸零、清空 `conversationHistory`，再重新問第一題，不會直接跑結果。
- 未上傳文件：保留原本逐題問答流程，完成後才會觸發推薦。

## 驗證

- `git diff --check -- public/manufacturing.html` 通過。
- `node` 解析 `public/manufacturing.html` 內嵌 script：通過。

