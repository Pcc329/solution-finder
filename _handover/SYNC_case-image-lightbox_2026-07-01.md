# SYNC_case-image-lightbox_2026-07-01

## Branch
- `feat-strategy-merge-p2-import`

## Scope
- Modified: `public/manufacturing.html`
- Added validation screenshots:
  - `_handover/SYNC_case-image-lightbox_layout_2026-07-01.png`
  - `_handover/SYNC_case-image-lightbox_case37_open_badge_2026-07-01.png`
  - `_handover/SYNC_case-image-lightbox_case37_switched_2026-07-01.png`
  - `_handover/SYNC_case-image-lightbox_case38_no_badge_2026-07-01.png`

## Changed Functions / Areas
- CSS:
  - Replaced old equal-width thumbnail row with a `2fr 1fr` grid.
  - Added fixed-position Lightbox styles:
    - `.reference-case-lightbox { position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(6px); }`
    - Main image uses `object-fit: contain` and 480px / viewport max constraints.
    - Lower thumbnail strip highlights the active image via `.is-active`.
- HTML:
  - Added `#referenceCaseLightbox` outside the card list, near the page-level toast.
  - Kept the existing caption below the thumbnail grid.
- JS:
  - `getReferenceCaseMediaHtml(item)` now renders one large thumbnail plus two small thumbnails.
  - Added `renderReferenceCaseLightbox()`.
  - Added `openReferenceCaseLightbox(item, imageIndex)`.
  - Added `closeReferenceCaseLightbox()`.
  - Added `shiftReferenceCaseLightbox(delta)`.
  - Updated `renderReferenceCases()` thumbnail click binding to open Lightbox.

## Removed Old Logic
- Removed old hover preview DOM:
  - `.reference-case-media-preview`
  - `data-reference-case-preview-*`
- Removed old hover preview behavior:
  - `mouseenter`
  - `mouseleave`
  - `.preview-open`
- No `.zoom-panel` logic exists in the file.

## Lightbox Behavior
- Backdrop uses `position: fixed` and covers the full viewport.
- Backdrop blur is enabled with `backdrop-filter: blur(6px)`.
- Close methods verified:
  - Backdrop click
  - `Esc`
  - Close button is wired to `closeReferenceCaseLightbox()`
- Image switching verified:
  - Right arrow button / `ArrowRight` shifts active image.
  - Active thumbnail border updates in the bottom strip.
- Thumbnail clicks call `event.stopPropagation()` so card accordion behavior is not triggered by image clicks.

## Do-Not-Touch Confirmation
- `/api/solutions.js` not modified.
- `scoreSolution`, `getRecommendations`, `officialPrograms` not modified.
- `referenceCaseImageMap` and `referenceCaseTitleToImageId` not modified.
- `shouldShowReferenceCaseSubscribeCta` and `showSubscriptionToast` not modified.
- `<script>` tag attributes not modified.
- `word-break: break-all` not introduced.

## Validation
- Data source: live `/api/cases` proxied from `https://solution-finder-gray.vercel.app/api/cases`.
- Case count: 35 records.
- Browser validation:
  - Layout: visible case cards show 3 thumbnails; grid computed as `492px 246px`, rows `102px 102px`, height `210px`.
  - case 37 / 振添:
    - First image opens `case-images/case37_zhentian_01.jpg`.
    - Main Lightbox badge visible (`示意圖`).
    - `ArrowRight` switches to `case-images/case37_zhentian_02.jpg`.
    - Bottom thumbnail strip active index changes from 0 to 1.
  - case 38 / 台中精機:
    - First image opens `case-images/case38_taichungseiki_01.jpg`.
    - Main Lightbox badge hidden, as expected for real photos.
  - Non-case 37-41 CTA:
    - Switched to `醫療` filter.
    - Expanded `台北醫美診所顧客管理系統案`.
    - `訂閱看更多` CTA remained visible.
- Console errors: none during validation.
- Image 404: none observed during validation.

## Checks
- `node -e` inline script syntax check: pass.
- `git diff --check`: pass, with existing Windows CRLF warning only.

## Git
- Branch: `feat-strategy-merge-p2-import`
- Commit: see latest commit on this branch after push.
- PR: existing branch PR / Vercel preview should rebuild after push.
