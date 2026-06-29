# SYNC - Manufacturing Lock + Hide Diagnosis Entry

Date: 2026-06-29

## Branch

- Branch: `main`
- Change type: direct main fix, per spec.

## Modified Files

- `public/manufacturing.html`
- `public/index.html`
- `public/dashboard.html`
- `public/compare.html`
- `public/strategy-guide.html`
- `public/sources.html`
- `public/diagnosis.html`

## Manufacturing Input / Button Elements

HTML:

```html
<input id="agentInput" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-teal-500" type="text" placeholder="也可以直接輸入回答...">
<button id="agentSendBtn" class="btn-primary px-4" type="button">...</button>
```

Refs:

```javascript
agentInput: document.getElementById("agentInput")
agentSendBtn: document.getElementById("agentSendBtn")
```

Actual elements:

- `input#agentInput`
- `button#agentSendBtn`

## Completion Message Location

Function: `handleAnswer(value)`

Location: `public/manufacturing.html:948`

Completion message:

```javascript
addMessage("assistant", "條件已整理完成。你可以產生官方推薦與其他候選方案。");
```

Hard-lock calls:

```javascript
hardLockAgentInput("completion-message");
runExplore();
hardLockAgentInput("after-runExplore");
```

Locations:

- Completion message: `public/manufacturing.html:981`
- First hard lock: `public/manufacturing.html:982`
- Reassert lock after recommendation trigger: `public/manufacturing.html:984`

## Hard Lock Implementation

Function: `hardLockAgentInput(reason = "completed")`

Location: `public/manufacturing.html:878`

Behavior:

```javascript
refs.agentInput.dataset.inputLocked = "true";
refs.agentInput.disabled = true;
refs.agentSendBtn.disabled = true;
refs.agentInput.placeholder = "分析已完成，請點選『產生推薦』";
refs.agentInput.classList.add("opacity-50", "cursor-not-allowed");
refs.agentInput.setAttribute("aria-disabled", "true");
refs.agentSendBtn.setAttribute("aria-disabled", "true");
```

Visual style:

```css
#agentInput:disabled {
  background: #f1f5f9;
  color: #94a3b8;
  cursor: not-allowed;
  opacity: 0.5;
}
```

## Disabled Reset Paths

Found reset paths:

1. `resetAgent(clearSaved = true)`
   - Calls `unlockAgentInput()`
   - Clears `dataset.inputLocked`
   - Restores placeholder and input availability

2. `analyzeDocument(...).finally`
   - Previously always re-enabled input and send button
   - Now checks `refs.agentInput.dataset.inputLocked`
   - If hard-locked, calls `hardLockAgentInput("after-document-analysis")`
   - Otherwise restores input/button as before

No `setLoading()` path exists in `manufacturing.html` for agent input state.

## Diagnosis Nav Link Removal

Removed global-nav links pointing to `/diagnosis.html` from:

- `public/index.html`
- `public/dashboard.html`
- `public/compare.html`
- `public/manufacturing.html`
- `public/strategy-guide.html`
- `public/sources.html`
- `public/diagnosis.html`

Verification:

- `compare.html: no diagnosis href`
- `dashboard.html: no diagnosis href`
- `diagnosis.html: no diagnosis href`
- `index.html: no diagnosis href`
- `manufacturing.html: no diagnosis href`
- `sources.html: no diagnosis href`
- `strategy-guide.html: no diagnosis href`

`diagnosis.html` file itself remains in place and can still be opened directly.

## Not Changed

- `/api/solutions.js`
- Any `/api/` file
- Babel / script tag attributes
- Manufacturing recommendation generation logic
- Official recommendation section
- Reference Cases section
- `diagnosis.html` lock logic

## Validation

- `git diff --check` on all modified HTML files: passed
- `node --check` on extracted `manufacturing.html` inline JS: passed

## Git

- Commit hash: see final Codex response after commit.

