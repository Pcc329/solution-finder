# SYNC_three-ui-optimizations_2026-07-01

## Branch
- `feat-strategy-merge-p2-import`

## Scope
- Modified: `public/manufacturing.html`
- Added validation screenshots:
  - `_handover/SYNC_three-ui-optimizations_pulse_2026-07-01.png`
  - `_handover/SYNC_three-ui-optimizations_single-open_2026-07-01.png`

## Changed Areas
1. Sticky left input panel
   - Added `.diagnosis-input-panel` CSS under desktop breakpoint.
   - Applied class to the left `<aside>`.
2. Run button pulse guidance
   - Added `.run-btn-pulse` and `@keyframes runBtnPulse`.
   - Added `runBtnWasReady` state guard.
   - Updated `updateProfilePreview()` to add pulse only when the button transitions into ready/enabled state.
   - Added `animationend` listener to remove the pulse class after the 3 pulse iterations.
3. Recommendation card single-open behavior
   - Changed `DESKTOP_MAX_EXPANDED` from 3 to 1.
   - Updated `toggleInlineDetail(item)` so opening a new solution replaces the previous expanded solution with `expandedIds = [itemId]`.
   - Mobile remains 1.

## Sticky Implementation
- Parent layout remains the existing grid:
  - `grid grid-cols-1 lg:grid-cols-[390px_1fr] gap-6 items-start`
- The left panel is now:
  - `<aside class="space-y-4 diagnosis-input-panel">`
- Desktop CSS:
  - `position: sticky`
  - `top: 88px`
  - `align-self: start`
  - `max-height: calc(100vh - 104px)`
  - `overflow-y: auto`
- The `88px` offset avoids the existing sticky global nav covering the input panel.

## Pulse Implementation
- CSS:
  - `.run-btn-pulse { animation: runBtnPulse 0.72s ease-out 3; }`
  - Keyframes use the existing teal button color family via `rgba(13, 148, 136, ...)`.
  - Effect: slight `scale(1.03)` plus box-shadow pulse.
- Trigger:
  - In `updateProfilePreview()`.
  - Condition: `ready && !isGenerating && !hasGenerated`.
  - Class is only added when transitioning from not-ready to ready.
  - Class is removed on `animationend`.
- No automatic recommendation trigger is used.

## Manual Recommendation Fix
- The old completion branch called `runExplore()` immediately after the final answer.
- Removed that auto-call so users must manually click `產生推薦`.
- `hasGenerated` / `isGenerating` timing remains controlled by `runExplore()`.

## Single-Open Implementation
- `getMaxExpanded()` now returns 1 on desktop and mobile.
- `toggleInlineDetail(item)`:
  - Clicking the currently expanded card closes it.
  - Clicking another card replaces the previous expanded card.
- Reference case accordion logic not modified.

## Validation
- Data source: live `/api/solutions` proxied from `https://solution-finder-gray.vercel.app/api/solutions`.
- Loaded solution count: 2,322 records.
- Full agent flow tested:
  - `金屬加工`
  - `10-50人`
  - `剛起步`
  - `生產排程`
  - `30萬以下`
- Pulse state after final answer:
  - `runDisabled: false`
  - `runText: 產生推薦`
  - `hasPulseClass: true`
  - `animationName: runBtnPulse`
  - `animationIterationCount: 3`
  - Recommendation list still showed `尚未產生推薦。`, confirming no auto-run.
- Manual click on `產生推薦`:
  - Official count: 5
  - Other count: 5
- Single-open result:
  - After expanding first card: `expandedCards: 1`, `detailRows: 1`, status `已展開 1 / 1`.
  - After expanding second card: first card closed, second card open, `expandedCards: 1`, `detailRows: 1`.
- Sticky scroll validation:
  - After page scroll `scrollY ~= 2339`, left panel remained at `rectTop: 88`.
- Console errors: none observed.

## Do-Not-Touch Confirmation
- `/api/solutions.js` not modified.
- `scoreSolution`, `getRecommendations`, `officialPrograms` not modified.
- Reference case accordion not modified.
- Case image / Lightbox / subscription CTA logic not modified.
- `<script>` tag attributes not modified.
- `word-break: break-all` not introduced.

## Checks
- `node -e` inline script syntax check: pass.
- `git diff --check`: pass, with Windows CRLF warning only.

## Git
- Commit: see latest commit on this branch after push.
- PR: existing branch PR / Vercel preview should rebuild after push.
