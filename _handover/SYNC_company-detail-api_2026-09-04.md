# SYNC: Company Detail API

- Date: 2026-09-04
- Branch: `feat/company-detail-api-2026-09-04`
- PR: https://github.com/Pcc329/solution-finder/pull/138

## Scope

Added one new endpoint only: `api/company-detail.js`.

- `GET /api/company-detail?company_id={id}`
- No existing API, frontend page, database schema, or Patch 4 work changed.
- The endpoint uses `SUPABASE_SERVICE_ROLE_KEY` only inside the Vercel serverless function. The key is never returned to the browser.

## Public response and minimization

The contacts contract was deliberately minimized before implementation:

```json
{
  "contacts": [
    {
      "contact_name": "...",
      "title": "...",
      "office_phone": "..."
    }
  ]
}
```

The endpoint does not select or return `email` or `mobile`. Validation records below redact individual contact values.

Company fields returned are exactly:

```
company_id, company_name, ceo_name, capital, established_date,
website, company_intro, employee_range, company_type
```

Award fields returned are exactly:

```
award_name, award_level, host_org, award_year, confidence
```

Internal fields such as `airtable_rec_id`, `note`, `data_source`, `b05_matched`, `crunchbase_profile`, and `match_method` are not returned.

## Implementation

### `api/company-detail.js`

- `companies`: query by `company_id`, select only the nine required company fields, and use `limit=1`.
- `contacts`: query by `company_id`, select only `contact_name,title,office_phone`.
- `awards`: query by `company_id`, select `match_method` only to map the public `confidence` field:
  - `EXACT` / `PARTIAL` / `PARTIAL_GROUP` -> `verified`
  - `AI_EXTRACT` -> `ai_extracted`
- Capital values greater than or equal to `2147483647` return `null`.
- Missing company returns HTTP 404 with `{"error":"company not found"}`.
- Empty contacts and awards return `[]`.

## Real Preview validation

Preview used:

https://solution-finder-git-feat-comp-7c74f7-patrick0814-6136s-projects.vercel.app

All requests below were made against the deployed Preview endpoint, not mocks.

| Scenario | Request | Result |
| --- | --- | --- |
| Full data + AI-extracted awards | `?company_id=50849424` | HTTP 200; company `谷林運算股份有限公司`; capital `60000000`; 1 contact; 4 awards, all `confidence: "ai_extracted"`. |
| Capital overflow | `?company_id=01517124` | HTTP 200; company `國眾電腦股份有限公司`; `capital: null`; 1 contact and 2 awards. |
| Partial/missing data + empty arrays | `?company_id=00012558` | HTTP 200; `company_intro: ""`, `website: ""`, `contacts: []`, `awards: []`. |
| Multiple contacts | `?company_id=50783870` | HTTP 200; company `以力股份有限公司`; 2 contacts returned; each contact has only `contact_name,title,office_phone`. |
| Not found | `?company_id=00000000` | HTTP 404 with `{"error":"company not found"}`. |

Example response shape from the full-data validation, with person-specific contact values redacted:

```json
{
  "company_id": "50849424",
  "company_name": "谷林運算股份有限公司",
  "capital": 60000000,
  "contacts": [
    {
      "contact_name": "[redacted]",
      "title": "[redacted]",
      "office_phone": "[redacted]"
    }
  ],
  "awards": [
    {
      "award_name": "金漾獎",
      "award_level": "獲獎",
      "host_org": "",
      "award_year": "",
      "confidence": "ai_extracted"
    }
  ]
}
```

## Verification outcome

- Preview endpoint returned HTTP 200 for real Supabase-backed detail requests.
- The not-found contract returned the required HTTP 404 body.
- The response omits `email`, `mobile`, `match_method`, and listed internal fields.
- CORS, `OPTIONS`, and non-`GET` method handling are present in the endpoint.
- Vercel successfully deployed the branch revision used for the real endpoint checks.

## Git history

- Initial endpoint commit: `b7f6c0a24ef3f59edb2d82b6140d2f55cbfb47a2`
- Data-minimization/service-role commit: `4de46a7306b2b13213285a1d658c68036ba83029`
