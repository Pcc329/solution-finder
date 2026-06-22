# CODEX SYNC - manufacturing run button state

日期：2026-06-22
分支：feat-diagnosis-agent-v1

## 修改範圍

- `public/manufacturing.html`
- 未修改 API、版面結構、推薦排序、公司名稱不一致警告。

## 新增狀態旗標

- `hasGenerated`：目前條件是否已產生過推薦。
- `isGenerating`：是否正在生成，防止連點。

## 重置點

以下條件變動來源會將 `hasGenerated = false`：

- `resetAgent()`：重新規劃時重置 `hasGenerated` 與 `isGenerating`。
- `handleAnswer()`：未上傳文件時，問答寫入 `profile[step.key]` 後重置。
- `applyExtractedProfile()`：文件解析套入 profile 後重置。
- `handleFile()`：文件解析完成並 merge/update 文件條件後重置。
- `clearAllFiles()`：清除文件後完整重置 `hasGenerated` 與 `isGenerating`。

另在 `restoreResult()`：

- 若成功還原上一輪結果，設定 `hasGenerated = true`、`isGenerating = false`，避免重新整理後無條件重打 API。

## 按鈕狀態控制

`updateProfilePreview()` 改為集中控制「產生推薦」按鈕：

- `isGenerating = true`：disabled，顯示「生成中…」。
- `hasGenerated = true`：disabled，顯示「已產生推薦」。
- 其他狀態：依 `profile.subIndustry && profile.size && profile.pain && allSolutions.length` 判斷可不可按，文字為「產生推薦」。

## 生成流程

`runExplore()`：

- 若 `isGenerating || hasGenerated` 直接 return，防止重複觸發。
- 開始時設定 `isGenerating = true` 並刷新按鈕。
- 成功產生顧問結論後設定 `hasGenerated = true`。
- `finally` 設定 `isGenerating = false`，並刷新按鈕狀態。

## 驗收檢查

- 生成中：按鈕反灰並顯示「生成中…」。
- 生成完成：按鈕反灰並顯示「已產生推薦」。
- 重複點擊：`runExplore()` 會被 `hasGenerated` 擋下，不重打 API。
- 改條件：問答、重新上傳、清除文件、重新規劃都會重置 `hasGenerated`，按鈕回到可生成狀態。
- 條件不齊：仍依原條件維持 disabled。

## 驗證

- `git diff --check -- public/manufacturing.html` 通過。
- `node` 解析 `public/manufacturing.html` 內嵌 script：通過。

