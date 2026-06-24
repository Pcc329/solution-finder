# CODEX SYNC：洽詢報價字型修正

日期：2026-06-24  
分支：`feat-diagnosis-agent-v1`  
功能 Commit：`a299dc5` (`Fix quote label font fallback`)

## 修改範圍

- 檔案：`public/manufacturing.html`
- 修改位置：
  - `renderDetail()` 的方案總費用
  - `renderList()` 的方案卡片費用

未修改 API、其他卡片欄位樣式或 script 標籤。

## 詳細頁 HTML

有效費用維持原本 monospace：

```javascript
`<p class="text-2xl font-black text-teal-700 font-mono">
  ${formatCurrency(price)}
</p>`
```

空費用改用指定 sans-serif：

```html
<p
  class="text-2xl font-black text-teal-700"
  style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;"
>
  📞 洽詢報價
</p>
```

## 方案卡片 HTML

有效費用維持原本 `font-mono`。  
空費用改為：

```html
<span
  class="text-xs font-black text-teal-700 shrink-0"
  style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;"
>
  📞 洽詢報價
</span>
```

## 驗證結果

- 詳細頁「📞 洽詢報價」不再套用 `font-mono`
- 方案卡片「📞 洽詢報價」不再套用 `font-mono`
- 兩者皆明確指定規格要求的字型鏈
- 有效總費用與月費仍保留原本 `font-mono`
- `git diff --check -- public/manufacturing.html`：通過
- `public/manufacturing.html` inline script `new Function()` 語法檢查：通過

## Git

- Branch：`feat-diagnosis-agent-v1`
- 功能 Commit：`a299dc5`
- Remote：`origin/feat-diagnosis-agent-v1`
- PR：https://github.com/Pcc329/solution-finder/pull/new/feat-diagnosis-agent-v1

