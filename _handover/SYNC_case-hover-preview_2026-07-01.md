# SYNC: Reference Case Thumbnail Hover Preview

Date: 2026-07-01
Branch: `feat-strategy-merge-p2-import`
PR: https://github.com/Pcc329/solution-finder/compare/main...feat-strategy-merge-p2-import

## Scope

Implemented the reference-case thumbnail hover preview behavior in `public/manufacturing.html`.

Only `public/manufacturing.html` was changed. No API files were modified.

## Files / Functions Changed

- `public/manufacturing.html`
  - Replaced old `.reference-case-media-trigger` / `.reference-case-media-panel` CSS with thumbnail-row + shared-preview CSS.
  - Updated `getReferenceCaseMediaHtml(item)`:
    - removed the top-right `圖片` trigger button.
    - renders 3 inline thumbnail buttons.
    - renders one shared `.reference-case-media-preview` panel per image row.
    - keeps the caption under the thumbnail row.
  - Updated reference-case media event binding in `renderReferenceCases()`:
    - each thumbnail binds `mouseenter`, `mouseleave`, `focus`, `blur`, and `click`.
    - all handlers use the same shared preview update path.
    - click propagation remains stopped so accordion open/close is not affected.

Unchanged by requirement:

- `referenceCaseImageMap`
- `referenceCaseTitleToImageId`
- `shouldShowReferenceCaseSubscribeCta`
- `getReferenceCaseSubscribeCtaHtml`
- `showSubscriptionToast`
- `scoreSolution`
- `getRecommendations`
- `officialPrograms`
- `<script>` tag attributes

## Shared Preview Positioning

The preview is positioned relative to `.reference-case-media`.

CSS variables:

- `--case-thumb-size: 72px`
- `--case-thumb-gap: 8px`

Left offset:

```css
left: calc((var(--case-thumb-size) * 3) + (var(--case-thumb-gap) * 2) + 12px);
```

This means:

- 3 thumbnails x 72px
- 2 gaps x 8px
- 12px spacing between thumbnail row and preview
- fixed preview size: `280px x 280px`
- preview top: `0`
- image display: `object-fit: contain`, padding `16px`

## Validation Data

Data source:

- Live API proxied from `https://solution-finder-gray.vercel.app/api/cases`
- Record count: 35

Validated cases:

- case 37 `振添股份有限公司｜預鑄混凝土製程數位化`
  - expected: all 3 previews show `示意圖` badge.
- case 38 `台中精機廠股份有限公司｜供應鏈碳數據管理`
  - expected: preview has no `示意圖` badge.

## Screenshots

- `_handover/SYNC_case-hover-preview_case37_thumb1_2026-07-01.png`
- `_handover/SYNC_case-hover-preview_case37_thumb2_2026-07-01.png`
- `_handover/SYNC_case-hover-preview_case37_thumb3_2026-07-01.png`
- `_handover/SYNC_case-hover-preview_case38_no-badge_2026-07-01.png`

## Observed Results

case 37 thumbnail preview:

- Thumb 1 preview source: `case-images/case37_zhentian_01.jpg`
- Thumb 2 preview source: `case-images/case37_zhentian_02.jpg`
- Thumb 3 preview source: `case-images/case37_zhentian_03.jpg`
- Preview rect stayed fixed across all 3 states:
  - `x: 711.333`
  - `y: 402.083`
  - `width: 280`
  - `height: 280`
- `示意圖` badge visible for all 3.

case 38 thumbnail preview:

- Preview source: `case-images/case38_taichungseiki_01.jpg`
- Preview size: `280 x 280`
- Thumbnail count: 3
- Top-right image trigger count: 0
- `示意圖` badge visible: false

Console notes:

- No `case-images` 404 observed.
- Tailwind CDN warning remains pre-existing.
- Earlier proxy retry produced a temporary local HTTP 500 before the live-data proxy was restarted with network access; final validation loaded 35 live case records successfully.

## Acceptance Checklist

- [x] Top-right `圖片` trigger removed.
- [x] Card header right side has no image-related button.
- [x] Three thumbnails are displayed inline.
- [x] Shared 280 x 280 preview appears to the right of the thumbnail row.
- [x] Preview position stays fixed when switching thumbnail 1 / 2 / 3.
- [x] Preview image content switches correctly.
- [x] `illustrative: true` shows `示意圖` badge in preview.
- [x] Non-illustrative case does not show preview badge.
- [x] Caption remains below the thumbnail row.
- [x] Existing image path mapping and illustrative flags unchanged.
- [x] Accordion click handling remains intact.
- [x] Subscribe CTA logic untouched.
- [x] No `/api/solutions.js` changes.
- [x] No `word-break: break-all`.

## Checks

- `public/manufacturing.html` inline script syntax check: PASS
- `<script>` tag audit: PASS, inline script remains `<script>` with no added attributes
- `git diff --check`: PASS, line-ending warning only if present

## Git

- Commit: `d805e91` (`feat: add shared case image hover preview`)
