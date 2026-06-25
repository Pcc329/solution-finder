# CODEX SYNC：AI 問答模式封閉文件上傳

日期：2026-06-25  
分支：`feat-diagnosis-agent-v1`  
功能 Commit：`315e468` (`Lock document uploads after agent responses`)

## 修改範圍

- 檔案：`public/manufacturing.html`
- 未修改任何 API、推薦排序、分類篩選及 script 標籤。
- 原有 `isDocumentMode` 封閉問答邏輯未修改。

## isAgentMode 觸發位置

新增狀態：

```javascript
let isAgentMode = false;
```

觸發位置為 `handleAnswer()`。初始 assistant 問題不會鎖住上傳；使用者第一筆有效回答被接受後，才啟用 Agent 模式：

```javascript
const step = agentSteps[stepIndex];
addMessage("user", text);
if (!isAgentMode) {
  isAgentMode = true;
  updateUploadLock();
}
```

此時下一則 assistant 問題出現前，兩個文件入口已完成鎖定。

## 遮罩 CSS 與 DOM

原有 label 與 input 內容不變，外層新增 `.upload-zone-wrap`：

```html
<div id="assessmentUploadWrap" class="upload-zone-wrap">
  <label id="dropzoneAssessment">...</label>
  <input id="fileInputAssessment" type="file">
  <div class="upload-lock-overlay" data-upload-lock>
    <div class="upload-lock-message">
      💬 已有問答紀錄，請先按「重新分析」清除後再使用文件上傳
    </div>
  </div>
</div>
```

診斷報告入口使用相同結構。

主要 CSS：

```css
.upload-zone-wrap { position: relative; }
.upload-zone-wrap.upload-locked > label { opacity: 0.45; }
.upload-lock-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: none;
  background: rgba(248, 250, 252, 0.58);
}
.upload-zone-wrap.upload-locked .upload-lock-overlay {
  display: flex;
}
```

`updateUploadLock()` 同時：

- 切換兩個 wrapper 的 `upload-locked` class。
- 設定兩個 `<input type="file">` 的 `disabled`。
- 解鎖時移除仍顯示中的提示。

## 點擊提示

遮罩點擊後執行：

```javascript
function showUploadLockMessage(overlay) {
  const message = overlay.querySelector(".upload-lock-message");
  if (!message) return;
  message.classList.add("show");
  clearTimeout(overlay._messageTimer);
  overlay._messageTimer = setTimeout(
    () => message.classList.remove("show"),
    2500
  );
}
```

提示文字：

```text
💬 已有問答紀錄，請先按「重新分析」清除後再使用文件上傳
```

不使用 `alert()`，提示顯示在被點擊的上傳區域內，2.5 秒後消失。

## resetAgent() 修改

`resetAgent()` 新增：

```javascript
isAgentMode = false;
updateUploadLock();
```

因此「重新分析」會：

- 移除兩個遮罩。
- 恢復兩個 file input。
- 清除提示顯示狀態。
- 重新開始 AI 問答。

`clearAllFiles()` 也防禦性執行相同解鎖。

## Session Restore

`saveResult()` 保存 `isAgentMode`。  
`restoreResult()` 在沒有文件模式時恢復 Agent 模式與上傳鎖定，避免重新整理後兩條輸入通道同時開放。

## 驗證情境

1. 初始畫面兩個上傳入口可使用。
2. 使用 quick reply 或文字框送出第一筆有效回答。
3. 評量表與診斷報告上傳區同步反灰，兩個 input 均為 disabled。
4. 點任一遮罩，區域內顯示指定提示。
5. 2500ms 後提示自動消失。
6. 按「重新分析」，遮罩消失、input 恢復可用。
7. 文件上傳模式仍會封閉 quick reply 與文字問答。

本機 `file://` 預覽受瀏覽器安全政策限制，未以繞過方式操作；推送後應在 Vercel Preview 依上述步驟做最終畫面確認。

## 驗證結果

- `git diff --check -- public/manufacturing.html`：通過
- `public/manufacturing.html` inline script `new Function()` 語法檢查：通過
- 狀態測試：
  - 第一筆回答後，兩個 input 均 disabled
  - 第一筆回答後，兩個 wrapper 均 locked
  - reset 後，disabled 與 locked 均解除
  - 提示時間為 2500ms

## Git

- Branch：`feat-diagnosis-agent-v1`
- 功能 Commit：`315e468`
- Remote：`origin/feat-diagnosis-agent-v1`
- PR：https://github.com/Pcc329/solution-finder/pull/new/feat-diagnosis-agent-v1

