# SYNC: 資料來源頁官方連結與 SME AI平台文字修正

Date: 2026-09-07

## Scope

Changed `public/sources.html` only. Existing source-count attributes, filtering/count synchronization, source agencies, and the 產業案例知識庫 section were not changed.

## Changes

- Corrected all five `SMEI` typos to `SME AI平台`.
- Added the reusable `source-links` disclosure UI and its vanilla-JS click handler.
- Added the required 臺灣雲市集 shutdown notice instead of an external link.
- Added mobile styling so the disclosure button spans its available width and link text wraps safely.

## Official Link Audit

| Detail card | Links added |
| --- | --- |
| 雲市集工業館 | 雲端解決方案, AI工具庫方案, AI工具庫Lite版 |
| 農業雲市集-數位館 | 農業雲市集數位館 |
| SME AI平台 | SME AI平台官網 |
| 新創嚴選網 | 新創嚴選網官網 |
| 商業服務業專區 | 商業服務業專區官網 |
| 政府軟體採購網 | 政府軟體採購網官網 |
| 新北產業AI化輔導計畫 | 媒合平台, 經發局公告頁 |
| 臺灣雲市集 | No link. Displays `平台已停止服務（原因：計畫結束及相關政策調整）`. |
| 領域型調查 | No link. Intentionally unchanged. |

The specification's acceptance text says eight cards should receive disclosures, but its table contains seven sources with URLs after excluding both 臺灣雲市集 and 領域型調查. The implementation follows the table: 7 toggles and 7 menus.

## Interaction

Each `.source-links-toggle` starts with `aria-expanded="false"` and its adjacent menu is `hidden`. On click, the handler updates both values, allowing the menu to expand and collapse without any framework dependency. Every external link uses `target="_blank" rel="noopener noreferrer"`.

## Verification

```text
rg -n "SMEI" public/sources.html
# no matches

source-links-toggle count: 7
source-links-menu count: 7
status-closed text: present exactly once
official URL count: 10

git diff --check
# passed

inline script syntax check
# passed
```

## Git

- Branch: `feat/sources-official-links-2026-09-07`
- Functional commit: `f895a25744559ed3905994dd0df3d5a532150a50`
- Pull request: https://github.com/Pcc329/solution-finder/pull/143
