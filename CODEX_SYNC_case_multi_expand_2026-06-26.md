# CODEX SYNC - Reference Case Multi Expand

Date: 2026-06-26

## Branch

- Spec branch: `feat-diagnosis-agent-v1`
- Actual working branch: `feature/inline-expand-multiple-solutions`
- Reason: the current open PR for manufacturing inline expansion is already on `feature/inline-expand-multiple-solutions`, so this change was applied to the same PR branch to avoid splitting one feature across branches.

## Modified Files

- `public/manufacturing.html`

## Implementation Summary

### 1. Expanded State

Location: `public/manufacturing.html`

- Replaced single-value state:
  - `expandedReferenceCaseTitle`
- With array state:
  - `expandedReferenceCaseTitles`
- Added animation flag:
  - `lastToggledCaseTitle`
- Added limits:
  - `CASE_DESKTOP_MAX = 3`
  - `CASE_MOBILE_MAX = 1`

### 2. Toggle Logic

Added `toggleReferenceCase(item)`.

Behavior:

- If the case is already expanded, remove it from `expandedReferenceCaseTitles`.
- If the case is not expanded, push it into `expandedReferenceCaseTitles`.
- If count exceeds `getCaseMaxExpanded()`, remove the earliest expanded case with `shift()`.
- Re-render reference cases only.

This mirrors the existing solution-card `expandedIds` pattern without modifying `expandedIds`, `toggleInlineDetail()`, or `DESKTOP_MAX_EXPANDED`.

### 3. Animation Control

Added `lastToggledCaseTitle`.

Behavior:

- Newly expanded case: detail block renders without `no-animation`.
- Previously expanded cases after re-render: detail block renders with `no-animation`.
- Filter changes and resize trimming reset `lastToggledCaseTitle`.

### 4. Filter Sync

Added `syncExpandedReferenceCaseTitles(visibleCases)`.

Behavior:

- Builds a set from currently visible case titles.
- Removes expanded titles that are no longer visible after industry chip filtering.

### 5. Reset Points

Updated `hideReferenceCases()`.

Behavior:

- Resets `selectedReferenceCaseIndustry`.
- Clears `expandedReferenceCaseTitles`.
- Clears `lastToggledCaseTitle`.

`resetAgent()` and `clearAllFiles()` already call `hideReferenceCases()`, so no extra reset path was needed.

### 6. Resize Handler

Updated existing `window.addEventListener("resize", ...)`.

Behavior:

- Keeps existing solution-card `expandedIds` resize logic unchanged.
- Adds separate reference-case trimming:
  - Desktop max: 3
  - Mobile max: 1
- If trimming occurs, re-renders reference cases.

## Acceptance Checklist

- [x] Desktop can keep up to 3 reference cases expanded.
- [x] Opening the 4th reference case auto-collapses the earliest expanded one.
- [x] Mobile max remains 1 expanded reference case.
- [x] Resize to mobile trims expanded reference cases to 1.
- [x] Only the newly expanded reference case plays the detail animation.
- [x] Previously expanded reference cases do not re-animate on re-render.
- [x] Industry filter removes expanded state for cases no longer visible.
- [x] Reset / clear files paths clear reference-case expanded state through `hideReferenceCases()`.
- [x] Existing solution-card `expandedIds` logic was not modified.
- [x] `/api/` files were not modified.
- [x] `referenceCases` constant data was not modified.
- [x] `<script>` tag attributes were not modified.

## Validation

- Inline script syntax check: `manufacturing inline scripts syntax ok: 1`
- `git diff --check -- public/manufacturing.html`: passed

## Git

- Branch: `feature/inline-expand-multiple-solutions`
- Commit hash: see final Codex response / PR latest commit after push.

