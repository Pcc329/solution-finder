# SYNC_fixed-left-final_2026-07-01

## Branch / Commit

- Branch: `feat-strategy-merge-p2-import`
- Commit: pending before final commit

## Task

Finalize `public/manufacturing.html` left-column fixed desktop layout.

Goal:

- Desktop two-column diagnosis workspace uses a fixed viewport height.
- Left column does not depend on whole-page scroll.
- Right result column scrolls independently.
- Chat area uses remaining height and scrolls internally.
- Mobile layout remains normal single-column flow.

## Modified Files

- `public/manufacturing.html`
- `_handover/SYNC_fixed-left-final_2026-07-01.md`
- `_handover/SYNC_fixed-left-final_answered_2026-07-01.png`
- `_handover/SYNC_fixed-left-final_right-scroll_2026-07-01.png`

## CSS Selectors / Actual Implementation

Base selectors:

```css
.agent-card { display: flex; flex-direction: column; }
.agent-card-fixed { flex-shrink: 0; }
.diagnosis-workspace { display: grid; grid-template-columns: 1fr; gap: 24px; align-items: start; }
.chat-panel {
  min-height: 220px;
  max-height: min(360px, calc(100vh - 430px));
  overflow-y: auto;
  padding-right: 4px;
}
```

Desktop fixed layout:

```css
@media (min-width: 1024px) {
  .diagnosis-workspace {
    display: flex;
    gap: 24px;
    height: calc(100vh - 160px);
    overflow: hidden;
    align-items: stretch;
  }

  .diagnosis-input-panel {
    display: flex;
    flex-direction: column;
    width: 390px;
    height: 100%;
    overflow: hidden;
    flex-shrink: 0;
  }

  .diagnosis-upload-card {
    flex-shrink: 0;
    padding: 14px;
  }

  .diagnosis-upload-card .dropzone,
  .diagnosis-upload-card .dropzone-indigo {
    padding: 10px;
  }

  .diagnosis-upload-card .dropzone > i,
  .diagnosis-upload-card .dropzone-indigo > i {
    font-size: 18px;
    margin-bottom: 4px;
  }

  .diagnosis-upload-card label .text-xs {
    display: none;
  }

  .agent-card {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .agent-card .chat-panel {
    flex: 1;
    min-height: 0;
    max-height: none;
  }

  .diagnosis-results-panel {
    flex: 1;
    height: 100%;
    min-height: 0;
    overflow-y: auto;
    padding-right: 4px;
  }
}
```

HTML selector changes:

```html
<section class="diagnosis-workspace">
<aside class="space-y-4 diagnosis-input-panel">
<section class="card p-5 diagnosis-upload-card">
<section class="card p-5 agent-card">
<section id="resultView" class="space-y-4 diagnosis-results-panel">
```

## Header Height Measurement

Measured in browser preview:

- `#global-nav`: `61px`
- `main > header`: `92px`
- Desktop workspace height rule: `height: calc(100vh - 160px)`
- Observed workspace height at `1280x720`: `560px`

The `160px` reserve covers nav/header/top spacing while keeping both columns inside the visible desktop viewport.

## Validation Data Source

- Preview URL: `http://127.0.0.1:5191/manufacturing.html?final=3`
- `/api/solutions`: proxied to live Vercel API
- Live solution records loaded: `2,322`

## Validation 1: Five Questions Answered

Test answers:

1. `金屬加工`
2. `10-50人`
3. `剛起步`
4. `生產排程`
5. `30萬以下`

Measured state after completion:

```json
{
  "agentProgress": "完成",
  "runDisabled": false,
  "runText": "產生推薦",
  "runVisible": true,
  "left": { "height": 560 },
  "right": { "height": 560 },
  "upload": { "height": 277 },
  "agentCard": { "height": 267 },
  "chat": {
    "clientHeight": 71,
    "scrollHeight": 620,
    "overflowY": "auto"
  },
  "pulse": {
    "hasClass": true,
    "animation": "runBtnPulse"
  }
}
```

Screenshot:

- `_handover/SYNC_fixed-left-final_answered_2026-07-01.png`

## Validation 2: Right Column Independent Scroll

After clicking `產生推薦`, results rendered:

- Official recommendations: `5 筆`
- Other recommendations: `5 筆`

Right-column scroll test:

```json
{
  "before": {
    "pageScrollY": 0,
    "rightScrollTop": 0,
    "leftRect": { "top": 209, "bottom": 769, "height": 560 },
    "rightRect": { "top": 209, "bottom": 769, "height": 560 }
  },
  "after": {
    "pageScrollY": 0,
    "rightScrollTop": 620,
    "leftRect": { "top": 209, "bottom": 769, "height": 560 },
    "rightRect": { "top": 209, "bottom": 769, "height": 560 }
  }
}
```

Result:

- Whole page did not scroll.
- Right panel scrolled independently.
- Left panel stayed fixed at same viewport coordinates.

Screenshot:

- `_handover/SYNC_fixed-left-final_right-scroll_2026-07-01.png`

## Non-Regression Checks

- `產生推薦` remains manual; no automatic recommendation trigger was added.
- Button pulse class still applies when the questionnaire reaches completed state.
- Single-open inline card behavior remains untouched.
- `/api/solutions.js` not modified.
- `scoreSolution`, `getRecommendations`, `officialPrograms` not modified.
- `<script>` tags not modified.
- No `word-break: break-all` introduced.

## Final Checks

- `git diff --check`: passed
- inline script syntax check: passed (`new Function(...)` on the inline `manufacturing.html` script)
- temp preview server: stopped; no process remains on port `5191`
- `rg "word-break: break-all|runExplore\\(\\);"`: no matches
