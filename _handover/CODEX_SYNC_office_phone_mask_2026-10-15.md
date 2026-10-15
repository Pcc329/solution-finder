# CODEX SYNC — office phone mask（2026-10-15）

## 分支與交付

- Repo：https://github.com/Pcc329/solution-finder
- 最新 main 基準：`581c9785d72f57b699b2c0ad60179ddef03f927a`（已 git pull --ff-only origin main，包含已 merge 的 PR #257）。
- 新分支：`fix/office-phone-mask`，從上述 main 建立。
- 程式 commit：[02f7adea90f987018b2ab7bd80f91fae31f50f47](https://github.com/Pcc329/solution-finder/commit/02f7adea90f987018b2ab7bd80f91fae31f50f47)
- 一般 PR：[PR #258](https://github.com/Pcc329/solution-finder/pull/258)，非 Draft，未 merge。
- 產品程式只改 `api/company-detail.js`；另新增本交接文件。
- 未修改資料庫、前端、auth、MCP、migration；既有 isMaskedMobile、isInvalidEmail 與其他欄位邏輯保留。

## 實作與行號

`api/company-detail.js:33–36` 新增具名函式，先取 # 前的主號碼，再移除非數字；僅接受 10 碼且末 6 碼全為 0 的來源遮罩形態。

```js
function isMaskedOfficePhone(value) {
  const mainNumber = String(value ?? '').split('#')[0].replace(/\D/g, '');
  return /^\d{4}0{6}$/.test(mainNumber);
}
```

`api/company-detail.js:140` 於 contacts.map 清空整個 office_phone，命中時分機一併移除：

```js
office_phone: isMaskedOfficePhone(contact.office_phone) ? '' : textOrBlank(contact.office_phone),
```

既有手機判斷位於 29–31 行，email 判斷位於 38–41 行，contacts.map 的 email/mobile 位於 141–142 行，內容均未變更。

## 真實 Vercel Preview 驗收

- 驗收日期：2026-10-15，約 17:27–17:29（Asia/Taipei）。
- 固定分支 Preview：https://solution-finder-git-fix-offic-15b57d-patrick0814-6136s-projects.vercel.app/
- 驗收部署：https://solution-finder-cuap1ceew-patrick0814-6136s-projects.vercel.app/
- Vercel 部署：https://vercel.com/patrick0814-6136s-projects/solution-finder/HYy3mKrjjA5ATHVLAYkR3rT7U6jZ
- 部署對應程式 commit：`02f7adea90f987018b2ab7bd80f91fae31f50f47`，Ready，GitHub Vercel status success。
- 使用共用密碼登入後的真實 Preview API 與前台方案頁；無 mock、無資料庫寫入。
- 改動前對照使用 PR #257 分支 Preview：https://solution-finder-git-feat-cont-e70f1a-patrick0814-6136s-projects.vercel.app/ ，僅唯讀比較。

| 案例 | company_id / solution_id | API 結果 | 前台結果 |
|---|---|---|---|
| 卓碼資訊股份有限公司／VPosAPP 線上商圈系統 | 42714922；SOL-0361（使用者提供）；前台 id recIHdg114ODnUgFw | 舊 office_phone 主號碼符合遮罩 regex；新版 office_phone 為空字串 | 公司電話「暫無資訊」；該欄無 a/tel 連結；無 # 或分機殘留。PASS |
| 人工智能股份有限公司／QbiAI全通路智能客服平台 | 55790788；recIpLJU4FDT217LK | 有效公司電話與 # 分機原值完整保留，整份 API 回應與舊版一致 | 公司電話含分機照常顯示；tel href 與原電話去除格式字元、# 轉逗號後逐字相等。PASS |
| 鉅碼科技股份有限公司／Hahago Ads商家行銷導客雲端數位行銷入門方案 | 66258228；recHxpd47ZmyTvDsj | 公司電話原值保留；mobile 仍為空字串；整份 API 回應與舊版一致 | 公司電話照常顯示且 tel href 正確；手機「暫無資訊」且無連結。PASS |

電話與 tel 展示紀錄一律遮罩：卓碼 `02-xxxx-xxxx` → 空字串；QbiAI `xx-xxxx-xxxx#xxx`／`tel:xxxxxxxxxx,xxx`；鉅碼 `03-xxxxxxx#xx`／`tel:03xxxxxxx,xx`。完整值僅於驗收過程暫存比對，未寫入本文件、PR 或 commit message。

補充：
- 使用者確認智雲聯網方案 SOL-0753 為「已下架_公司歇業佐證」，前台不顯示，指定改用卓碼。
- 卓碼實際舊值不含 #；新版整欄為空，畫面無 # 殘留。帶 # 分機的遮罩輸入另由函式邊界檢查確認會命中並清空整欄。
- 卓碼除 office_phone 清空外，完整 API 回應其餘欄位逐字一致；QbiAI、鉅碼整份回應逐字一致。

### 真實 HTTP 請求證據

Vercel Request Logs 顯示驗收部署共 6 次 `GET /api/company-detail`，皆為 200（API 直接讀取及 UI 首次展開各一次）。這是 Vercel 請求紀錄，並非聲稱讀取 Chrome Network 面板。

| 案例 | API 直接讀取時間 | UI 展開時間 | 狀態 |
|---|---|---|---|
| QbiAI | 17:27:22.01 | 17:27:37.58 | 200 / 200 |
| 鉅碼 | 17:27:53.87 | 17:28:15.12 | 200 / 200 |
| 卓碼 | 17:28:46.28 | 17:29:02.15 | 200 / 200 |

卓碼 UI 請求詳情另確認 Search Params `company_id=42714922`，Request ID：`qxt5l-1792056542150-13c42c899cfe`。
[該請求紀錄](https://vercel.com/patrick0814-6136s-projects/solution-finder/HYy3mKrjjA5ATHVLAYkR3rT7U6jZ/logs?datasource=legacy-logs&selectedLogId=qxt5l-1792056542150-13c42c899cfe)

## 其他檢查

- `node --check api/company-detail.js`：PASS。
- `git diff --check`：PASS。
- 8 組純函式邊界檢查：PASS，涵蓋遮罩帶分機、無格式遮罩、有效號碼帶分機、9 碼／11 碼不命中、null、空字串、只有分機。
- 純函式檢查是補充驗證；上述三組實際驗收均於真實 Vercel Preview 完成。
- PR 保持 open、非 Draft，未執行 merge。
