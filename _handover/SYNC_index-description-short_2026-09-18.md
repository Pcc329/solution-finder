# SYNC index.html 方案介紹改用 description_short

日期：2026-09-18

## Git
- Branch: `feat/target-scale-normalization-2026-09-18`
- Code commit: `8f2452704fc16db243ae048ca0817877aff76660`
- PR: https://github.com/Pcc329/solution-finder/pull/164
- Preview: https://solution-finder-git-feat-targ-17d333-patrick0814-6136s-projects.vercel.app/

## 改動範圍
僅修改 `public/index.html` 的 `renderDetail()`。未修改 `public/manufacturing.html`、`api/solutions.js`、資料庫或功能清單。

### 改前
```jsx
{item.desc && (
  ...
  <p ...>{item.desc}</p>
)}
```

### 改後
```jsx
const descShort = (item.ds || "").trim();
const descFull = (item.desc || "").trim();
const displayDesc = descShort || (
  descFull.length > 100 ? `${descFull.slice(0, 100)}…` : descFull
);

{displayDesc && (
  ...
  <p ...>{displayDesc}</p>
)}
```

邏輯位於 `renderDetail()` 開頭（目前約 1533-1535 行）及方案介紹區塊（約 1598-1604 行）。

## 與 manufacturing.html 對照
`public/manufacturing.html` 既有 `getInlineDetailHtml()` 先讀 `ds/description_short` 與 `desc/description`，再以短摘要優先、完整內容最多 100 字加刪節號的方式建立 `displayDesc`。本次只把同一顯示契約補到首頁詳情浮層，沒有修改參照檔案。

## Preview 驗證
- Vercel deployment: Ready
- 真實 Preview 首頁載入：2,291 筆可用方案
- 驗證方式：登入後使用首頁實際搜尋、開啟方案詳情，不使用 mock。
- Console/畫面：頁面正常載入，方案詳情正常渲染。

### 範例 1：雲偵碳組織型溫室氣體盤查系統
- 詳情「方案介紹」顯示乾淨摘要，未顯示聯絡人、電話、Email、PDF 檔名或內部審查欄位。
- 截圖：`_handover/evidence/index-description-short-20260918/carbon-summary.png`

### 範例 2：MantaGO對話式商務平台
- 一般方案的摘要正常顯示，其他區塊（功能清單、方案屬性、信任驗證）未受影響。
- 截圖：`_handover/evidence/index-description-short-20260918/mantago-summary.png`

### SOL-MOE-0582 說明
現有首頁語意搜尋不索引 `solution_id`；輸入 `SOL-MOE-0582` 回傳 0 筆，輸入完整名稱會被 Claude 解析為「研發創新 + 碳」並回傳 10 筆語意結果，因此無法在不改搜尋邏輯的前提下，從 UI 精確開啟指定 ID。這是既有搜尋能力限制，不在本次顯示層修正範圍。程式邏輯對所有詳情項目一致套用：只要該筆 API 的 `ds` 存在，就不會渲染完整 `desc`；`ds` 缺值時也只顯示 `desc` 前 100 字。

## 驗收
- [x] index 詳情優先顯示 `description_short`
- [x] `description_short` 缺值時，完整描述最多 100 字並加刪節號
- [x] 不再直接渲染完整 `item.desc`
- [x] manufacturing.html 未修改
- [x] API、資料庫、featureLines 未修改
- [x] Preview 真實資料與兩筆畫面驗證完成
- [ ] SOL-MOE-0582 指定 ID 畫面：受既有搜尋不索引 ID 限制，無法由公開 UI 精確定位；未冒用其他案例代替

## 截圖
![碳管理方案摘要](./evidence/index-description-short-20260918/carbon-summary.png)

![一般方案摘要](./evidence/index-description-short-20260918/mantago-summary.png)
