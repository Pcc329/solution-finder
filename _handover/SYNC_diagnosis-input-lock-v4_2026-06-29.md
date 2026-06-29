# SYNC - Diagnosis Input Lock v4

Date: 2026-06-29

## Branch

- Branch: `main`
- Change type: direct main fix, per spec.

## Completion Message Location

Function: `handleAgentInput(value)`

Location: `public/diagnosis.html:463-468`

```javascript
addMessage("assistant", "條件已整理完成。我會先做需求解析，再從資料庫篩出候選方案。");
hardLockAgentInput("completion-message");
await runDiagnosis({ ...diagnosisProfile });
hardLockAgentInput("after-runDiagnosis");
```

## Disabled Setting Location

Function: `hardLockAgentInput(reason = "completed")`

Location: `public/diagnosis.html:340-355`

```javascript
refs.agentInput.dataset.inputLocked = "true";
refs.agentInput.disabled = true;
refs.agentSendBtn.disabled = true;
refs.agentInput.placeholder = "分析已完成，請點選『產生推薦』";
refs.agentInput.classList.add("opacity-50", "cursor-not-allowed");
refs.agentInput.setAttribute("aria-disabled", "true");
refs.agentSendBtn.setAttribute("aria-disabled", "true");
```

This is a hard DOM lock and does not rely on `agentStepIndex` or `isAgentComplete()` at the completion-message trigger.

## Subsequent Disabled Reset Handling

Potential reset path:

- `runDiagnosis()` calls `setLoading(false)` after parsing.
- `setLoading(false)` calls `updateAgentInputState(false)`.

v4 handling:

- `hardLockAgentInput()` writes `refs.agentInput.dataset.inputLocked = "true"`.
- `updateAgentInputState()` now treats this DOM flag as a completed lock:

```javascript
const complete = refs.agentInput.dataset.inputLocked === "true" || isAgentComplete();
```

Result:

- `setLoading(false)` cannot unlock the input after completion.
- `hardLockAgentInput("after-runDiagnosis")` runs again after async recommendation flow to reassert the lock.

Reset path:

- `resetAgent()` clears the hard-lock flag:

```javascript
delete refs.agentInput.dataset.inputLocked;
```

This restores normal input behavior when the user restarts planning.

## Actual Element Mapping

HTML:

```html
<input id="agentInput" class="control flex-1" type="text" placeholder="也可以直接輸入回答..." />
```

Reference:

```javascript
agentInput: document.getElementById("agentInput")
```

Conclusion:

- `refs.agentInput` maps to `input#agentInput`.

## Debug Log

`hardLockAgentInput()` logs:

```javascript
console.log("[diagnosis-input-lock:hard-lock]", {
  reason,
  inputElement,
  sendButtonElement,
  actualInputDisabled,
  actualSendDisabled,
});
```

Expected production console after completion:

- `reason: "completion-message"`
- `inputElement: "input#agentInput"`
- `actualInputDisabled: true`
- `actualSendDisabled: true`

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

