# SYNC_remove-illustrative-badges_2026-07-01

## Branch
- `feat-strategy-merge-p2-import`

## Scope
- Modified: `public/manufacturing.html`
- Added validation screenshot:
  - `_handover/SYNC_remove-illustrative-badges_2026-07-01.png`

## Removed HTML / CSS / JS
- CSS removed:
  - `.reference-case-media-badge`
  - `.reference-case-lightbox-badge`
  - `.reference-case-lightbox-badge.hidden`
  - `.reference-case-lightbox-thumb .reference-case-media-badge`
- HTML removed:
  - `#referenceCaseLightboxBadge` span in the Lightbox main image area.
- JS removed:
  - `refs.referenceCaseLightboxBadge`.
  - Lightbox main image badge toggle logic.
  - Thumbnail badge rendering in `getReferenceCaseMediaHtml(item)`.
  - Lightbox thumbnail-strip badge rendering in `renderReferenceCaseLightbox()`.
- User-facing text adjusted:
  - Caption changed from `圖片僅供案例脈絡輔助判讀；標示「示意圖」者非真實案場照片。`
  - To `圖片僅供案例脈絡輔助判讀。`

## Data Retained
- `referenceCaseImageMap` still keeps all `illustrative: true/false` fields.
- `referenceCaseTitleToImageId` not modified.

## Do-Not-Touch Confirmation
- `/api/solutions.js` not modified.
- `scoreSolution`, `getRecommendations`, `officialPrograms` not modified.
- Subscription CTA logic not modified.
- `<script>` tag attributes not modified.
- `word-break: break-all` not introduced.

## Validation
- Data source: live `/api/cases` proxied from `https://solution-finder-gray.vercel.app/api/cases`.
- Case count: 35 records.
- Visual validation:
  - Opened case 37 / 振添 first image in Lightbox.
  - One-large-two-small image layout still rendered.
  - Lightbox opened `case-images/case37_zhentian_01.jpg`.
  - Active thumbnail count: 1.
  - `示意圖` visible text count: 0.
  - `.reference-case-media-badge` / `.reference-case-lightbox-badge` DOM count: 0.
- Console errors: none observed during validation.

## Checks
- `node -e` inline script syntax check: pass.
- `git diff --check`: pass, with Windows CRLF warning only.

## Git
- Commit: see latest commit on this branch after push.
- PR: existing branch PR / Vercel preview should rebuild after push.
