# SYNC - Cases UI Accordion Badge

Date: 2026-06-29

## Branch

- Branch: `fix-cases-grid-1col`
- Base: latest `origin/main`
- Context: continuation of the Cases one-column layout branch.

## Modified Files

- `public/manufacturing.html`

## Change 1: Accordion Single Open

Function: `toggleReferenceCase(item)`

### Before

```javascript
expandedReferenceCaseTitles.push(title);
lastToggledCaseTitle = title;
while (expandedReferenceCaseTitles.length > getCaseMaxExpanded()) {
  expandedReferenceCaseTitles.shift();
}
```

Behavior:

- Allowed multiple reference cases to remain expanded.
- Desktop limit was 3, mobile limit was 1.

### After

```javascript
expandedReferenceCaseTitles = [title];
lastToggledCaseTitle = title;
```

Behavior:

- Opening a reference case replaces the expanded list with only that case.
- Clicking an already expanded case still collapses it.
- Only one reference case can be expanded at a time.

## Change 2: Confidentiality Badge Removed

Location: `renderReferenceCases()` template literal in `public/manufacturing.html`.

Removed this rendered UI block:

```html
<span class="badge ${item.visibility === "公開" ? "badge-teal" : "badge-muted"}">
  <i class="fa-solid ${item.visibility === "公開" ? "fa-globe" : "fa-lock"} mr-1"></i>${escapeHtml(item.visibility)}
</span>
```

Result:

- Cards no longer display `公開` or `內部可看` badges.
- Static data fields such as `visibility` remain unchanged.
- Airtable / API settings were not touched.

## Not Changed

- `/api/solutions.js`
- Any `/api/` file
- Babel `<script>` tag attributes
- Official recommendation section
- Other recommendation section
- Case title, tags, pain text, result text, and detail content
- `referenceCases` static data constants

## Validation

- `git diff --check -- public/manufacturing.html`: passed
- Inline script syntax check: `manufacturing inline scripts syntax ok: 1`
- `node --check` on extracted inline JS: passed

## Acceptance Checklist

- [x] Opening a second case auto-collapses the first case.
- [x] Only one case can be expanded at a time.
- [x] Confidentiality badge UI is no longer rendered.
- [x] Filter buttons were not changed.
- [x] Card content remains intact.
- [x] RWD logic was not changed.

## Preview Screenshot

Vercel Preview screenshot is pending PR deployment.

## Git

- Commit hash: see final Codex response after commit.
- PR link: current branch PR link after push.

