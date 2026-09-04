# SYNC: Manufacturing Detail Tabs

Date: 2026-09-04

## Scope

Implemented Patch 4 only: the expanded solution detail in `public/manufacturing.html` now has three tabs:

- `方案介紹` (default)
- `公司介紹`
- `案例文章`

No API files, recommendation logic, scoring logic, reference-case mapping, or script tag attributes were changed.

## Mandatory Pre-checks

The preconditions were checked against the deployed API before the frontend work:

| Check | Result |
| --- | --- |
| `GET /api/cases` | HTTP 200, 85 cases. Each record exposes `provider_linked_company_id` and `case_relationship_type`. |
| Case relationship values | `客戶案例`: 38, `媒合案例`: 40, `廠商案例`: 7. |
| `GET /api/company-detail?company_id=50849424` | HTTP 200. Company detail, one contact, and four awards returned. |
| Contacts contract | The returned contact object contains only `contact_name`, `title`, and `office_phone`. No `email` or `mobile` is rendered or requested by this frontend change. |

## Implementation

Changed file: `public/manufacturing.html`

### Detail tab state and rendering

- Added per-solution selected-tab state with the default `solution` tab.
- `getDetailTabsHtml()` renders the three fixed tab buttons.
- `getInlineDetailHtml()` and the retained legacy `renderDetail()` render the current tab while preserving the existing solution-description layout for `方案介紹`.
- `toggleInlineDetail()` resets a newly opened detail card to `方案介紹`, as required.

### Company introduction tab

- `loadCompanyDetail()` makes the first, lazy request only after `公司介紹` is selected:
  `GET /api/company-detail?company_id=<cid>`.
- `companyDetailCache` stores loading, success, and failure states by company ID. Returning to the tab does not make a second request for the same card.
- `getCompanyDetailTabHtml()` renders the company profile, basic attributes, introduction, contacts, and awards. Empty values use `未提供`; an empty or failed result displays `暫無公司資料`.
- Contacts deliberately read only `contact_name`, `title`, and `office_phone`, matching the deployed data-minimisation contract. Email and mobile are not present in the UI code.

### Case articles tab

- `getVendorReferenceCases()` filters the already-loaded `referenceCases` array by the solution `cid` and provider relationship type.
- Production data labels vendor examples as `廠商案例`; the predicate accepts that deployed value and the original `廠商` value for backward compatibility.
- No additional cases request is made on tab selection. `loadCases()` refreshes an already-open case tab once the page-level cases request completes.
- `getReferenceCaseCardsHtml()` and `bindReferenceCaseCardInteractions()` reuse the existing reference-case accordion, image/lightbox, and subscription CTA behaviours. This is presentation reuse, not a new case-card implementation.

### Styling

- Added only scoped detail-tab, company-profile, and case-list styles.
- The tab row is horizontally scrollable on narrow screens; company detail fields collapse to one column below 768px.
- Chinese text wrapping uses `overflow-wrap: break-word` and `word-break: break-word`; no `word-break: break-all` was added.

## Preview Verification

Preview deployment:

https://solution-finder-git-feat-manu-bd793c-patrick0814-6136s-projects.vercel.app/manufacturing.html

The Preview page loaded successfully in Chrome and reported `已載入 2,462 筆方案` with no rendered error state.

API samples used for the tab data contract:

| Scenario | Live Preview result |
| --- | --- |
| Complete company data | `50849424` (`谷林運算股份有限公司`): 1 contact with exactly `contact_name`, `title`, `office_phone`; 4 awards. It also has the vendor case `老廠房的無痛數位化——谷林運算雲端戰情室加速傳產製程決策`. |
| Empty optional company data | `24965995` (`博世科智能股份有限公司`): HTTP 200 with 0 contacts and 0 awards; the UI uses its normal empty-state fallback. |
| Another empty optional-data case | `00012558` (`群曜數位科技股份有限公司`): HTTP 200 with 0 contacts and 0 awards. |
| Vendor-case mapping | The seven production `廠商案例` records match solution company IDs `24965995`, `50849424`, `54931699`, `85127726`, `90220687`, `93484971`, and `93786700`; each has an existing solution record in the Preview data. |

The API verification used the Preview deployment, not mocked data. Counts at verification time: 2,462 solutions and 85 cases.

## Static Checks

```text
git diff --check
# passed

inline script syntax check (Node)
# passed

rg -n "contact_name|office_phone|\\.email|\\.mobile" public/manufacturing.html
1074:                    contact.contact_name,
1076:                    contact.office_phone,
```

## Git

- Branch: `feat/manufacturing-detail-tabs-2026-09-04`
- Implementation commit: `09d101e77bc0b501b175e68e83d16d867c720cba`
- Pull request: https://github.com/Pcc329/solution-finder/pull/139

