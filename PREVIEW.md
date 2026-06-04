# Local Preview and Smoke Checks

This repo uses plain HTML plus Vercel Serverless Functions.

## Setup

```bash
npm install
npx playwright install chromium
copy .env.local.example .env.local
```

On Windows PowerShell, if `npm` is blocked by execution policy, use:

```powershell
npm.cmd install
npx.cmd playwright install chromium
Copy-Item .env.local.example .env.local
```

Fill `.env.local`:

```text
AIRTABLE_TOKEN=...
ANTHROPIC_API_KEY=...
```

## Run locally

```bash
npm run dev
```

PowerShell:

```powershell
npm.cmd run dev
```

Default local URL:

```text
http://localhost:3000
```

## Smoke test and screenshots

In another terminal:

```bash
npm run smoke
```

PowerShell:

```powershell
npm.cmd run smoke
```

Outputs:

```text
artifacts/screenshots/
artifacts/smoke-summary.json
```

The smoke script checks:

- `/`
- `/dashboard.html`
- `/strategy-guide.html`
- `/compare.html`
- Global nav exists.
- Console has no page errors.
- Screenshots are written for desktop and mobile.
