# SYNC - Diagnosis Input Lock v3 Debug

Date: 2026-06-29

## Branch

- Branch: `main`
- Change type: direct main fix, per spec.

## Actual Input Element

HTML element:

```html
<input id="agentInput" class="control flex-1" type="text" placeholder="也可以直接輸入回答..." />
```

Reference binding:

```javascript
agentInput: document.getElementById("agentInput")
```

Conclusion:

- `refs.agentInput` correctly maps to `input#agentInput`.
- `refs.agentSendBtn` correctly maps to `button#agentSendBtn`.

## updateAgentInputState() Call Timing

Function:

```javascript
function updateAgentInputState(loading = false)
```

Called from:

- `resetAgent()` after restarting conversation.
- `handleAgentInput()` when user tries to submit after completion.
- Completion branch after message `條件已整理完成...`.
- After `await runDiagnosis(...)` returns, to re-assert lock after async recommendation flow.
- `setLoading(loading)`.
- `loadSolutions()` before and after solution data fetch.

## Debug Logging Added

Added console log inside `updateAgentInputState()`:

```javascript
console.log("[diagnosis-input-lock]", {
  inputElement: refs.agentInput ? `${refs.agentInput.tagName.toLowerCase()}#${refs.agentInput.id}` : null,
  sendButtonElement: refs.agentSendBtn ? `${refs.agentSendBtn.tagName.toLowerCase()}#${refs.agentSendBtn.id}` : null,
  agentStepIndex,
  totalSteps: agentSteps.length,
  loading,
  complete,
  disabled,
  actualInputDisabled: refs.agentInput?.disabled,
  actualSendDisabled: refs.agentSendBtn?.disabled,
});
```

Expected completed-state log:

- `inputElement: "input#agentInput"`
- `sendButtonElement: "button#agentSendBtn"`
- `complete: true`
- `disabled: true`
- `actualInputDisabled: true`
- `actualSendDisabled: true`

## Disabled Reset Audit

Search result:

- Direct disabled writes exist only inside `updateAgentInputState()`.
- Other flows (`setLoading`, `loadSolutions`, completion branch) delegate to `updateAgentInputState()`.
- No separate code path was found that directly resets `refs.agentInput.disabled = false`.

## v3 Fix

Added an extra `updateAgentInputState()` after:

```javascript
await runDiagnosis({ ...diagnosisProfile });
```

Reason:

- Ensures async recommendation generation cannot leave the input unlocked after `setLoading(false)`.
- Keeps the existing conversation flow and recommendation logic unchanged.

## Not Changed

- `/api/solutions.js`
- Any `/api/` file
- Babel / script tag attributes
- Conversation step order
- Recommendation generation logic
- `manufacturing.html`

## Validation

- `git diff --check -- public/diagnosis.html`: passed
- `node --check` on extracted inline JS: passed

## Git

- Commit hash: see final Codex response after commit.

