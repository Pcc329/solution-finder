# SYNC_chat-height-fix_2026-07-01

## Branch
- `feat-strategy-merge-p2-import`

## Scope
- Modified: `public/manufacturing.html`
- Added validation screenshot:
  - `_handover/SYNC_chat-height-fix_2026-07-01.png`

## Problem
- The sticky left panel did not solve the root issue when the AI Agent conversation grew.
- The chat history could push the input area and related controls downward.
- Requirement: the chat history must scroll internally so users can see and click `產生推薦` without page scrolling after the 5th answer.

## Implementation
- Added flex layout to the AI Agent card:
  - `.agent-card { display: flex; flex-direction: column; }`
  - `.agent-card-fixed { flex-shrink: 0; }`
- Applied `.agent-card` to the AI Agent card section.
- Applied `.agent-card-fixed` to:
  - card header
  - option button row
  - input/send row
  - progress row
- Updated `.chat-panel`:
  - `min-height: 220px`
  - `max-height: min(360px, calc(100vh - 430px))`
  - `overflow-y: auto`
- Desktop sticky mode:
  - `.diagnosis-input-panel` keeps `position: sticky; top: 88px`.
  - changed from `overflow-y: auto` to `overflow: visible`.
  - `.agent-card { max-height: calc(100vh - 430px); overflow: hidden; }`
  - `.agent-card .chat-panel { flex: 1; min-height: 0; max-height: none; }`

## Validation
- Data source: live `/api/solutions` proxied from `https://solution-finder-gray.vercel.app/api/solutions`.
- Loaded solution count: 2,322 records.
- Full agent flow tested:
  - `金屬加工`
  - `10-50人`
  - `剛起步`
  - `生產排程`
  - `30萬以下`
- Final state after 5th answer:
  - `runDisabled: false`
  - `runText: 產生推薦`
  - `runVisible: true`
  - `runRect: top 30 / bottom 77`
  - `inputVisible: true`
  - `chatMetrics.clientHeight: 95`
  - `chatMetrics.scrollHeight: 620`
  - `chatMetrics.overflowY: auto`
  - `hasPulseClass: true`
  - `animationName: runBtnPulse`
- Console errors: none observed.

## Non-Regression
- Pulse animation still triggers.
- Recommendation is not auto-triggered.
- No changes to `/api/solutions.js`.
- No changes to `scoreSolution`, `getRecommendations`, or `officialPrograms`.
- No `<script>` tag attribute changes.
- `word-break: break-all` not introduced.

## Checks
- `node -e` inline script syntax check: pass.
- `git diff --check`: pass, with Windows CRLF warning only.

## Git
- Commit: see latest commit on this branch after push.
- PR: existing branch PR / Vercel preview should rebuild after push.
