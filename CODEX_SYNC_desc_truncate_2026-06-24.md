# CODEX SYNC：方案介紹純截字顯示

日期：2026-06-24  
分支：`feat-diagnosis-agent-v1`  
功能 Commit：`736c9dc` (`Simplify manufacturing description preview`)

## 修改範圍

- 檔案：`public/manufacturing.html`
- 函式：`renderDetail()`
- 僅修改方案介紹的資料整理與渲染。
- 功能清單邏輯未修改。

## 修改前

```javascript
const descriptionLines = safeStr(description)
  .split(/[。；;\n]+/)
  .map(line => line.trim())
  .filter(Boolean)
  .slice(0, 4)
  .map(line => line.length > 40 ? `${line.slice(0, 40)}…` : line);
```

```html
<ul>
  ${descriptionLines.map(line => `<li>${escapeHtml(line)}</li>`).join("")}
</ul>
```

## 修改後

```javascript
const desc = safeStr(description).trim();
const shortDesc = desc.length > 100 ? `${desc.slice(0, 100)}…` : desc;
```

```html
<p class="text-sm text-slate-600 leading-relaxed">
  ${escapeHtml(shortDesc)}
</p>
```

## 行為

- description 為空：不顯示「方案介紹」區塊。
- 少於或等於 100 字：完整顯示。
- 超過 100 字：顯示前 100 字並加 `…`。
- 不再依句號、換行或分號拆句。
- 不再使用 `<ul><li>`。

## 驗證結果

- 空白字串：輸出空字串，區塊不顯示
- 短介紹：完整顯示
- 100 字：維持 100 字，不加省略號
- 101 字：前 100 字加 `…`
- 功能清單仍顯示前五項及總項數提示
- `git diff --check -- public/manufacturing.html`：通過
- `public/manufacturing.html` inline script `new Function()` 語法檢查：通過

## Git

- Branch：`feat-diagnosis-agent-v1`
- 功能 Commit：`736c9dc`
- Remote：`origin/feat-diagnosis-agent-v1`
- PR：https://github.com/Pcc329/solution-finder/pull/new/feat-diagnosis-agent-v1

