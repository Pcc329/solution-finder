# SYNC：農業雲市集兩館計畫分組

- 日期：2026-11-02
- 分支：`codex/program-group-agri`
- 基底：`origin/main`，`ecb72ddd2eaebc3b30504825d9e20e9299ed9b51`
- 狀態：關卡 2 完成；尚未 stage、commit、push 或建立 PR。

## 授權與範圍

PPC 已在本次對話核准 AGENTS.md 的 `api/solutions.js` 例外，僅限本規格的計畫種類計算；不延伸為日後授權。自動推送及建立 PR 的規定，本次依關卡核准流程執行。
僅修改 `api/solutions.js`、`tests/program-badge-allowlist.test.mjs` 及本檔。未修改資料庫、遷移、前端、`vercel.json` 或等價測試，未安裝套件。

## 行為

- 允許清單加入 `農業雲市集-AI館`，其他來源及排除規則維持原樣。
- 僅有數位館：`pgc=1`、`pgList=['農業雲市集-數位館']`。
- 僅有 AI 館：`pgc=1`、`pgList=['農業雲市集-AI館']`。
- 兩館都有：`pgc=1`、`pgList=['農業雲市集']`。
- 以公司為單位合併；合併後標籤位於兩館首次出現的位置，其他計畫保持原有相對順序。
- `p` 保留原始來源名稱；顯示名稱 `農業雲市集` 本身不因此成為允許來源。
- 無 AI 館的輸入不會進入合併分支，保留原有回應。

## 斷言與測試

既有六來源 fixture 與全部既有斷言逐字保留，無斷言修改前後差異。另以明確列出的七個允許來源新增測試，精確斷言合併後六組的完整內容與順序；未使用模糊或「至少包含」比對。
新增 11 項測試，涵蓋單館、兩館兩種輸入順序、與其他計畫並存的排序、排除及未知名稱、七來源分組、跨公司隔離及原始來源保留；資料均為虛構。

驗證命令（PowerShell，repo 根目錄；檔案依完整路徑排序）：

```powershell
$testFiles = @(Get-ChildItem -LiteralPath tests -Recurse -File | Where-Object { $_.FullName -notlike '*\tests\sf-mcp\*' -and $_.Name -match '\.test\.(mjs|cjs|js)$' } | Sort-Object FullName | ForEach-Object { $_.FullName })
node --test --test-reporter=tap @testFiles
```

- 全部 10 個測試檔（排除 `tests/sf-mcp/`）：284 通過、0 失敗、0 跳過；exit 0。
- 徽章測試：21 項通過（原有 10 項＋新增 11 項）。
- `tests/supabase-read-equivalence.test.mjs` 包含在全測試中並全數通過，檔案未修改。
- 等價測試修改前後 SHA-256 均為 `7184DC0E740631881F3C50F68CA5449EBEF61925487036DA5A227D0E1D8749E3`。
- 真實 Preview 尚未驗證；依規格留待 push 後由 PPC 親自驗證，不使用瀏覽器。
