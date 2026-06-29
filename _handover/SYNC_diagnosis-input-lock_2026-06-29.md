# SYNC - Diagnosis Input Lock

Date: 2026-06-29

## Branch

- Branch: `fix-diagnosis-input-lock`
- Base: latest `origin/main`

## Modified Files

- `public/diagnosis.html`

## Completion Condition

The lock uses the existing flow terminal condition:

```javascript
agentStepIndex >= agentSteps.length
```

No extra state variable was added.

## Disabled State Location

Added helper functions after `updateProfilePreview()`:

```javascript
function isAgentComplete() {
  return agentStepIndex >= agentSteps.length;
}

function updateAgentInputState(loading = false) {
  const complete = isAgentComplete();
  const disabled = loading || allSolutions.length === 0 || complete;
  refs.agentSendBtn.disabled = disabled;
  refs.agentInput.disabled = disabled;
  refs.agentInput.placeholder = complete ? "分析已完成，請點選『產生推薦』" : "也可以直接輸入回答...";
}
```

Trigger points:

- `resetAgent()` calls `updateAgentInputState()` after restarting the conversation.
- `handleAgentInput()` calls `updateAgentInputState()` when the flow reaches completion.
- `setLoading(loading)` delegates to `updateAgentInputState(loading)`.
- `loadSolutions()` delegates enable / disable behavior to `updateAgentInputState()`.

This prevents `runDiagnosis()` from re-enabling the input after the final answer.

## Visual Lock

Added disabled styling:

```css
.control:disabled {
  background: #f1f5f9;
  color: #94a3b8;
  cursor: not-allowed;
  opacity: 0.58;
}
```

## Behavior

- Before completion: input remains enabled once solution data is loaded.
- During loading: input and send button remain disabled.
- After completion: input and send button remain disabled.
- After completion: placeholder changes to `分析已完成，請點選『產生推薦』`.
- The recommendation button is not changed.

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

## Preview Screenshot

Vercel Preview screenshot is pending PR creation/deployment.

## Git

- Commit hash: see final Codex response after commit.
- PR link: see final Codex response after branch push.

