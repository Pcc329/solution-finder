# CODEX SYNC：文件模式封閉快速選項

日期：2026-06-24  
分支：`feat-diagnosis-agent-v1`  
功能 Commit：`b524b6c` (`Block quick replies in document mode`)

## 修改範圍

- 檔案：`public/manufacturing.html`
- 未修改 API、推薦排序、分類篩選、方案卡片及 quick reply 外觀。

## Quick Reply 渲染位置

全頁只有一個 quick reply chip 渲染入口：

- 函式：`updateOptions()`
- 容器：`#agentOptions`
- 按鈕：`.option-chip[data-option]`
- 點擊事件：

```javascript
button.addEventListener("click", () => handleAnswer(button.dataset.option));
```

文字框的送出按鈕及 Enter 鍵同樣呼叫 `handleAnswer()`，因此三個輸入入口共用同一套文件模式封閉邏輯。

## 文件模式狀態

新增：

```javascript
let isDocumentMode = false;
let isDocumentParsing = false;
let activeDocumentName = "";
let activeDocumentNames = new Set();
```

- 選取有效 PDF 後立即進入 `isDocumentMode`。
- 解析中由 `activeDocumentNames` 追蹤檔名。
- 支援評量表與診斷報告同時解析，不會在第一份完成時過早解除封閉。
- 解析完成後，只要已有萃取資料或已上傳文件，`isDocumentMode` 維持為 `true`。
- `resetAgent()` 與 `clearAllFiles()` 會清除所有文件模式狀態。
- `restoreResult()` 會依保存的文件與萃取資料恢復文件模式。

## 封閉邏輯

`handleAnswer()` 在任何問答處理前先判斷：

```javascript
if (isDocumentMode) {
  addMessage("user", text);
  if (isDocumentParsing) {
    addMessage(
      "assistant",
      `📄 正在讀取 ${activeDocumentName || "文件"} 文件分析期間，問答功能暫停，請稍候…`
    );
  } else {
    addMessage(
      "assistant",
      "📄 已載入文件分析模式，問答功能暫停。如需使用問答，請先按「清除文件」。"
    );
  }
  refs.agentInput.value = "";
  return;
}
```

因為在此處直接 `return`，quick reply 不會更新 profile、不會推進問題步驟，也不會觸發推薦。

## 警示訊息

解析期間：

```text
📄 正在讀取 [檔名] 文件分析期間，問答功能暫停，請稍候…
```

解析完成：

```text
📄 已載入文件分析模式，問答功能暫停。如需使用問答，請先按「清除文件」。
```

Quick reply、文字送出按鈕及 Enter 鍵均使用上述相同訊息。

## 驗證情境

1. 上傳 `評量表.pdf`，解析尚未完成時點 quick reply。
2. 聊天框顯示解析期間警示，step 與 profile 不變。
3. 文件解析完成後再次點 quick reply。
4. 聊天框顯示已載入文件模式警示，選項仍不寫入條件。
5. 同時解析 `評量表.pdf` 與 `診斷報告.pdf`，完成第一份後仍維持解析中封閉。
6. 按「清除文件」，文件狀態清空，quick reply 恢復正常。

## 驗證結果

- `git diff --check -- public/manufacturing.html`：通過
- `public/manufacturing.html` inline script `new Function()` 語法檢查：通過
- 雙文件解析狀態測試：通過

## Git

- Branch：`feat-diagnosis-agent-v1`
- 功能 Commit：`b524b6c`
- Remote：`origin/feat-diagnosis-agent-v1`
- PR：https://github.com/Pcc329/solution-finder/pull/new/feat-diagnosis-agent-v1

