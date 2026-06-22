# CODEX SYNC - manufacturing restart button

日期：2026-06-22
分支：feat-diagnosis-agent-v1

## 修改範圍

- `public/manufacturing.html`
- 未修改 API、`runBtn` 狀態邏輯、`restartBtn` 點擊邏輯、推薦排序。

## 分析結果區標題列

已將「重新分析」移到「分析結果」標題列，並放在「產生推薦」左側：

```html
<div class="flex items-center gap-3">
  <button id="restartBtn" class="text-sm text-slate-600 font-bold border border-slate-300 rounded-xl px-3 py-2 hover:bg-slate-50 hover:border-teal-500 hover:text-teal-700 transition-colors flex items-center gap-1.5" type="button">
    <i class="fa-solid fa-arrow-rotate-left"></i>重新分析
  </button>
  <button id="runBtn" class="btn-primary" type="button" disabled>
    <i class="fa-solid fa-magnifying-glass-chart mr-2"></i>產生推薦
  </button>
</div>
```

設計：

- `restartBtn` 使用 outline 外框。
- 圖示改為 `fa-arrow-rotate-left`。
- 與 `runBtn` 使用 `gap-3` 分隔。
- `runBtn` 原本 class 與狀態邏輯未改。

## 問答區底部

已移除問答區底部原本的 `restartBtn`，只保留進度文字：

```html
<div class="flex items-center justify-end mt-4">
  <span id="agentProgress" class="text-xs text-slate-400">1 / 5</span>
</div>
```

## id 與行為確認

- `id="restartBtn"` 全頁只剩 1 個。
- 既有事件仍是：

```js
refs.restartBtn.addEventListener("click", () => resetAgent(true));
```

- 點擊行為不變：清空文件、問答、結果，回到第一題。

## 文字一致性

已將對話提示中的「重新規劃」改為「重新分析」：

- 還原上一輪結果提示。
- 條件已完成提示。

## 驗證

- `git diff --check -- public/manufacturing.html` 通過。
- `node` 解析 `public/manufacturing.html` 內嵌 script：通過。
- `Select-String` 確認 `id="restartBtn"` 數量為 1。
- `Select-String` 確認已無「重新規劃」字串。

