# SYNC: 適用規模顯示為不限規模

Date: 2026-09-04

## Scope

Changed only `public/manufacturing.html` for the visual presentation of a solution's `scale` field. No API, database, search, filter, recommendation, scoring, CSS, or shared `safeStr()` changes were made.

## Implementation

Added `formatScaleDisplay(scaleValue)` immediately after the existing `safeStr()` helper.

```js
function formatScaleDisplay(scaleValue) {
  const list = Array.isArray(scaleValue) ? scaleValue : (scaleValue ? [scaleValue] : []);
  if (!list.length) return "";
  const cleaned = list.map(value => safeStr(value).trim()).filter(Boolean);
  if (!cleaned.length) return "";
  if (cleaned.includes("不限規模")) return "不限規模";
  if (cleaned.length >= 4) return "不限規模";
  return cleaned.join("、");
}
```

The helper is used only in the two solution-detail display paths:

1. `getInlineDetailHtml()` now uses `scaleDisplay` for the `適用規模` property.
2. `renderDetail()` now uses `scaleDisplay` for both the `適用規模` property and its muted scale badge.

`safeStr()` remains unchanged. It continues to join arrays with a space for all other fields and logic.

## Grep Audit

`rg -n -C 2 '適用規模|badge-muted.*scale|item\\.scale' public/manufacturing.html` found:

- Lines 1216-1219: inline detail uses `scaleDisplay`.
- Lines 1324-1327: full detail uses `scaleDisplay`.
- Lines 1338-1341: full-detail muted badge uses `scaleDisplay`.
- Lines 1703-1704: `solutionText()` retains raw `item.scale` for search indexing.
- Lines 1723-1726: `scoreSolution()` retains raw `item.scale` and existing scoring comparison.

There are no other raw-scale display sites. The final two matches are deliberately unchanged search and scoring logic.

## Verification

Source: live Production `https://solution-finder-gray.vercel.app/api/solutions`, queried during implementation. Current response count: 2,462 solutions.

| Case | Live source value | Expected display after this change |
| --- | --- | --- |
| Five intervals | `Shopass數位共榮護照OMO電商會員系統` (`recvOVaf88wEB4WHZ`): `["9人以下","10~20人","21~50人","51~100人","101~200人"]` | `不限規模` |
| Existing unlimited value | `PCB散熱解決方案` (`recnl3v482GWTixRO`): `"不限規模"` | `不限規模` |
| Two intervals | `雲端網路防毒與資安服務` (`recm3pfIhh3EZURXj`): `["9人以下","10~20人"]` | `9人以下、10~20人` |
| Four intervals unit case | `["9人以下","10~20人","21~50人","51~100人"]` | `不限規模` |

The helper's unit checks covered all four rows above and passed.

## Search and Scoring Regression Guard

The change does not touch either of the existing raw data paths:

```js
return [item.s, item.c, item.cat, item.d, item.iv, item.desc, item.feat, item.tags, item.scale, item.slogan, item.p]
  .map(safeStr).join(" ").toLowerCase();

if (safeStr(item.scale).includes(profile.size.replace("人", ""))) score += 8;
```

`git diff` contains only display-layer substitutions to `scaleDisplay`; both the search index and score comparison remain byte-for-byte unchanged from `main`.

## Checks

```text
git diff --check
# passed

formatScaleDisplay tests
# passed
```

## Git

- Base: `origin/main` at `400b03159b3c7430fe05837c05c1a5d299b06c49`
- Branch: `fix/scale-display-unlimited-2026-09-04`
- Pull request: https://github.com/Pcc329/solution-finder/pull/140
