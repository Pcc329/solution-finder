# SYNC: Case Card Image Preview

Date: 2026-06-30
Branch: feat-strategy-merge-p2-import

## Scope

Implemented case-card image preview support in `public/manufacturing.html`.

The implementation adds a small image trigger on reference case cards only when the case has image mapping data. Cases without mapping show no trigger and continue rendering normally.

## Changed Files

- `public/manufacturing.html`
- `_handover/SYNC_case-card-images_2026-06-30.md`
- `_handover/SYNC_case-images-page-load_2026-06-30.png`

## Functions / Sections Changed

- CSS:
  - `.reference-case-media`
  - `.reference-case-media-trigger`
  - `.reference-case-media-panel`
  - `.reference-case-media-frame`
  - `.reference-case-media-badge`
  - mobile override for `.reference-case-media-panel`
- Data:
  - `referenceCaseImageMap`
  - `referenceCaseTitleToImageId`
- JS helpers:
  - `getReferenceCaseImageId(item)`
  - `getReferenceCaseImages(item)`
  - `getReferenceCaseMediaHtml(item)`
- Rendering:
  - `renderReferenceCases()` now injects image trigger HTML when mapping exists.
  - `renderReferenceCases()` binds click handlers for mobile/touch behavior and uses `stopPropagation()` so image preview clicks do not toggle the case accordion.

## Image Mapping

Implemented fixed frontend mapping for the image paths listed in the spec:

- case 37: `case37_zhentian_01..03.jpg`, all marked `illustrative: true`
- case 38: `case38_taichungseiki_01..03.jpg`, all real/reference images
- case 39: `case39_chimei_01..03.jpg`, all real/reference images
- case 40: `case40_shude_01.jpg` real/reference, `02..03` illustrative
- case 41: `case41_mengchuang_01..02.jpg` real/reference, `03` illustrative

Note: the spec text says 19 images, but the fixed mapping table lists 5 cases x 3 images = 15 image paths. I implemented the explicit table and did not invent missing paths.

## Interaction

- Desktop:
  - Hover or focus on the image trigger shows a floating 3-image panel.
- Mobile:
  - Click/tap the image trigger toggles `.open` on that trigger.
  - Only one image panel stays open at a time.
- Accordion safety:
  - Image trigger click uses `event.stopPropagation()` and does not trigger reference case expand/collapse.

## Badge Behavior

- `illustrative: true` images render:
  - `<span class="reference-case-media-badge">示意圖</span>`
- Non-illustrative images render without this badge.
- Caption added:
  - `圖片僅供案例脈絡輔助判讀；標示「示意圖」者非真實案場照片。`

## Verification

- `git diff --check -- public/manufacturing.html`
  - PASS, only Git line-ending warning.
- Inline script syntax check:
  - PASS: `inline script syntax ok 2 77551`
- `node --check api/claude.js`
  - PASS.
- `git diff -- api`
  - PASS: no diff.
- `rg -n "word-break:\s*break-all" public/manufacturing.html`
  - PASS: no matches.
- Local browser load:
  - PASS: `http://127.0.0.1:5178/manufacturing.html` loads with title `方案探索 | Solution Finder`.
  - PASS: browser console errors list was empty.

## Verification Limitations

The repo currently does not contain `public/case-images/`.

Commands checked:

- `Test-Path -LiteralPath 'public/case-images'`
  - Result: `False`
- `git ls-files | Select-String -Pattern 'case-images|case37|case38|case39|case40|case41'`
  - Result: no tracked image files.

Because the image files are missing from this branch, I could not verify actual image loading or produce the required hover screenshots for:

- a real/reference image case
- an illustrative image case
- a no-image case

I did capture a local page-load screenshot only:

- `_handover/SYNC_case-images-page-load_2026-06-30.png`

## Acceptance Checklist

- Case cards add an image trigger only when mapping exists: DONE.
- Desktop hover/focus support: DONE.
- Mobile click support: DONE.
- Illustrative badge support: DONE.
- No-image cases render without trigger and without errors: DONE by logic; full UI validation pending images/data.
- Existing reference case single-column and single-open logic preserved: DONE.
- Existing solution expansion limits preserved: DONE.
- `/api/solutions.js`, `scoreSolution`, `getRecommendations`, `officialPrograms` untouched: DONE.
- No `word-break: break-all`: DONE.

## Commit / PR

- Implementation Commit: 27967d4
- SYNC Commit: see latest branch commit after this file update
- PR: https://github.com/Pcc329/solution-finder/compare/main...feat-strategy-merge-p2-import
