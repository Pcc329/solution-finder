# SYNC: Subscribe CTA for Reference Cases

Date: 2026-06-30
Branch: `feat-strategy-merge-p2-import`
PR: https://github.com/Pcc329/solution-finder/compare/main...feat-strategy-merge-p2-import

## Scope

Implemented the simulated "訂閱看更多" CTA in `public/manufacturing.html`.

No backend/API changes were made. No payment, member, auth, or network request behavior was added.

## Files Changed

- `public/manufacturing.html`
  - Added CTA styling for `.ref-case-subscribe-cta`.
  - Added lightweight toast UI: `#subscriptionToast`.
  - Added refs for `subscriptionToast` and `subscriptionToastClose`.
  - Added helper functions:
    - `getReferenceCaseNumericId(item)`
    - `isFullReferenceCase(item)`
    - `shouldShowReferenceCaseSubscribeCta(item)`
    - `getReferenceCaseSubscribeCtaHtml()`
    - `showSubscriptionToast()`
  - Updated `getReferenceCaseDetailHtml(item, shouldAnimate)` to append CTA only for cases outside case 37-41.
  - Added click binding for `[data-subscribe-case-cta]`.

## Logic

CTA visibility:

- If `case_id` / `caseId` is 37-41: do not show CTA.
- If title mapping resolves to image case 37-41: do not show CTA.
- Otherwise: show CTA at the bottom of the expanded detail content.

Click behavior:

- CTA is a front-end-only `<button type="button">`.
- `event.preventDefault()` and `event.stopPropagation()` are used.
- Shows toast message:
  - `完整案例內容開放訂閱會員查看（功能規劃中）。`
- No navigation.
- No API call.
- No persisted state.

## Validation

Validation source:

- Local stub server for `/api/cases`, used because this branch's new UI code is not deployed before PR preview.
- Stub record count: 3
  - case 38 `台中精機`: full/image case
  - case 42 `無圖片案例`: subscribe CTA case
  - case 43 `訂閱測試案例`: second subscribe CTA case

Screenshots:

- `_handover/SYNC_subscribe-cta_before_2026-06-30.png`
- `_handover/SYNC_subscribe-cta_after_2026-06-30.png`
- `_handover/SYNC_subscribe-cta_case38_2026-06-30.png`

Observed results:

- case 42 expanded detail showed `訂閱看更多` CTA.
- CTA click showed the toast.
- URL stayed at `http://127.0.0.1:5181/manufacturing.html`.
- case 38 had no `訂閱看更多` CTA.
- case 38 still showed the image trigger and 3 images loaded with non-zero `naturalWidth`.
- case 38 had 0 `示意圖` badges, as expected for real/reference images.
- Browser console check found no `case-images` 404 / failed-load messages.

## Acceptance Checklist

- [x] case 37-41 cards keep existing behavior; no subscribe CTA added.
- [x] Other reference cases show `訂閱看更多` after expansion.
- [x] CTA click shows a planning-state toast.
- [x] Closing / timeout leaves no persistent state.
- [x] CTA visual is distinct from the blue `圖片` button.
- [x] Existing accordion open/close behavior is unchanged.
- [x] Existing image preview behavior is unchanged.
- [x] No `/api/solutions.js` changes.
- [x] No `scoreSolution`, `getRecommendations`, or `officialPrograms` changes.
- [x] No `<script>` tag attribute changes.
- [x] No `word-break: break-all`.

## Checks

- `public/manufacturing.html` inline script syntax check: PASS
- `<script>` tag audit: PASS, inline script remains `<script>` with no added attributes
- `git diff --check`: PASS, line-ending warning only if present

## Bug Follow-up: CTA Not Visible on Vercel Preview

Issue reported on 2026-06-30:

- Vercel Preview with real Airtable data did not show `訂閱看更多` for a non-37-41 case.
- Example case: `北部建設公司工程進度管理導入案`.

Root cause:

- The implementation commit `d32fdf3` existed only in the local worktree.
- The branch was still ahead of `origin/feat-strategy-merge-p2-import` by 1 commit.
- Because the commit had not been pushed, Vercel Preview was still running the previous remote branch state, which did not contain the CTA code.
- The local logic itself was rechecked and the CTA is appended by `getReferenceCaseDetailHtml(item, shouldAnimate)` when `shouldShowReferenceCaseSubscribeCta(item)` returns `true`.

Real-data implication:

- Once `d32fdf3` and this SYNC update are pushed, Vercel should rebuild the preview from the branch containing the CTA code.
- After preview rebuild, retest at least:
  - 3 non-37-41 real cases: CTA should appear after expansion.
  - 1 case 37-41 real case: CTA should not appear; image preview should still work.

## Git

- Commit: `d32fdf3` (`feat: add subscribe CTA for reference cases`)
