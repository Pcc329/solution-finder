# SYNC - Diagnosis Input Lock v2

Date: 2026-06-29

## Branch

- Branch: `main`
- Change type: direct main fix, per spec.

## Modified Files

- `public/diagnosis.html`

## Completion Condition

Existing terminal condition is used:

```javascript
agentStepIndex >= agentSteps.length
```

No additional state variable was added.

## Modified Functions and Lines

### `isAgentComplete()`

Location: `public/diagnosis.html:336`

```javascript
function isAgentComplete() {
  return agentStepIndex >= agentSteps.length;
}
```

### `updateAgentInputState(loading = false)`

Location: `public/diagnosis.html:340`

Disabled trigger:

```javascript
const complete = isAgentComplete();
const disabled = loading || allSolutions.length === 0 || complete;
```

Applied disabled behavior:

```javascript
refs.agentSendBtn.disabled = disabled;
refs.agentInput.disabled = disabled;
refs.agentInput.placeholder = complete ? "分析已完成，請點選『產生推薦』" : "也可以直接輸入回答...";
refs.agentInput.classList.toggle("opacity-50", disabled);
refs.agentInput.classList.toggle("cursor-not-allowed", disabled);
refs.agentInput.setAttribute("aria-disabled", String(disabled));
refs.agentSendBtn.setAttribute("aria-disabled", String(disabled));
```

### Completion Trigger

Location: `public/diagnosis.html:426-434`

When `agentStepIndex >= agentSteps.length`, the page:

- Clears option chips
- Sets progress to `完成`
- Adds assistant message `條件已整理完成...`
- Calls `updateAgentInputState()`
- Runs diagnosis recommendation flow

## Visual Disabled Style

Location: `public/diagnosis.html:23`

```css
.control:disabled {
  background: #f1f5f9;
  color: #94a3b8;
  cursor: not-allowed;
  opacity: 0.5;
}
```

v2 strengthened the visible disabled state by:

- matching spec opacity `0.5`
- adding `opacity-50`
- adding `cursor-not-allowed`
- adding `aria-disabled`

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

## Screenshot

Vercel / production screenshot is pending deployment after direct main push.

## Git

- Commit hash: see final Codex response after commit.

