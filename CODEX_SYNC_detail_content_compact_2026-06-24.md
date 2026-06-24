# CODEX SYNC：方案詳細頁內容濃縮

日期：2026-06-24  
分支：`feat-diagnosis-agent-v1`  
功能 Commit：`1870f9c` (`Compact manufacturing detail content`)

## 修改範圍

- 檔案：`public/manufacturing.html`
- 函式：`renderDetail()`
- 僅修改「方案介紹」及「功能清單」的前端資料整理與渲染。
- 未修改任何 API、推薦排序、分類篩選、方案卡片或 script 標籤。

## 方案介紹拆句邏輯

```javascript
const descriptionLines = safeStr(description)
  .split(/[。；;\n]+/)
  .map(line => line.trim())
  .filter(Boolean)
  .slice(0, 4)
  .map(line => line.length > 40 ? `${line.slice(0, 40)}…` : line);
```

處理規則：

1. 使用句號、換行、全形分號與半形分號拆句。
2. 移除空白句。
3. 最多保留前四句。
4. 每句超過四十字時截斷並加上 `…`。
5. 使用 `<ul><li>` 渲染，不再顯示長段落。

## 功能清單截斷邏輯

```javascript
const featureLines = safeStr(features)
  .split(/\n|；|;/)
  .map(line => line.trim())
  .filter(Boolean);
const visibleFeatureLines = featureLines.slice(0, 5);
```

畫面只渲染 `visibleFeatureLines`。  
當 `featureLines.length > 5` 時，清單下方顯示：

```text
＋ 共 N 項功能
```

## 驗證情境

因修改尚未部署至 Vercel Preview，本次先以與實際欄位相同格式的測試方案驗證：

- 方案介紹：五句，其中第二句超過四十字。
- 功能清單：七項，混用換行、全形分號及半形分號。

結果：

- 介紹只保留前四句。
- 第二句截斷為四十字並加 `…`。
- 功能清單只保留前五項。
- 顯示 `＋ 共 7 項功能`。

推送後可在 Vercel Preview 選擇任一介紹較長、功能超過五項的方案進行實際畫面確認。

## 驗證結果

- `git diff --check -- public/manufacturing.html`：通過
- `public/manufacturing.html` inline script `new Function()` 語法檢查：通過
- 純前端字串測試：四句上限、四十字截斷、五項功能上限及總數均通過

## Git

- Branch：`feat-diagnosis-agent-v1`
- 功能 Commit：`1870f9c`
- Remote：`origin/feat-diagnosis-agent-v1`
- PR：https://github.com/Pcc329/solution-finder/pull/new/feat-diagnosis-agent-v1

