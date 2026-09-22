# Architecture

DevPortfolio AI uses a hybrid architecture: Gemini interprets source material into a constrained profile, while deterministic application code owns evidence, ranking, scoring, layout, responsiveness, sanitization, and publishing.

## Request flow

1. The browser sends a public GitHub profile, résumé PDF, and optional target role to `POST /api/generate`.
2. The server validates the username and PDF, extracts selectable text, and retrieves public GitHub profile and repository data.
3. Gemini receives only the extracted evidence and target context, then returns a structured profile through a JSON schema.
4. The server normalizes the model result and removes invalid or placeholder timeline data.
5. Deterministic logic ranks supported projects and skills against target-role terms.
6. The same logic maps claims to GitHub repositories or résumé line references, detects gaps, calculates a score, and creates a repository snapshot.
7. The browser renders one of five local theme systems and lets the user edit the draft without another model call.
8. The user can download a sanitized, dependency-free `index.html` or explicitly publish it to a new GitHub repository.
9. **Refresh sources** repeats the generation request and compares the old and new repository snapshots before replacing the draft.

## Components

| Component | Responsibility |
| --- | --- |
| `app/page.tsx` | Inputs, generation, source refresh, editing, evidence/gap UI, preview, download, and publishing |
| `app/api/generate/route.ts` | Validation, coordinated GitHub and PDF retrieval, Gemini profiling, normalization, and error mapping |
| `app/api/generate/extraction.ts` | PDF and contact extraction plus skill matching helpers |
| `lib/github-api.ts` | Authenticated public GitHub requests, short-lived response caching, request deduplication, and rate-limit diagnostics |
| `lib/profile-intelligence.ts` | Role tokens, deterministic ranking, evidence map, gap report, score, and snapshot comparison |
| `lib/portfolio-template.ts` | Five deterministic portfolio layouts and standalone exported HTML |
| `lib/generated-html.ts` | Sanitization and safety checks for generated documents |
| `app/api/publish/route.ts` | Guarded GitHub repository upload and Pages activation |

## Data model

The generation response contains:

- `profile`: normalized candidate content and selected GitHub projects.
- `targetRole`: the optional presentation context supplied by the user.
- `evidence`: claims mapped to zero or more GitHub repository or résumé sources.
- `gaps`: deterministic, actionable issues labeled high, medium, or low severity.
- `profileScore`: a bounded score derived only from those deterministic gaps.
- `sourceSnapshot`: selected repository identifiers and update timestamps used for refresh comparison.

The score is a readiness aid, not a hiring judgment. A high-severity gap subtracts 12 points, medium subtracts 6, and low subtracts 2, with the result bounded from 0 to 100.

## Truthfulness boundary

The target role is context, not candidate evidence. It may change ordering and emphasis, but it must not add technologies, experience, dates, outcomes, or qualifications. The model prompt enforces that distinction, and deterministic ranking only reorders existing profile entries.

Evidence mapping is intentionally transparent:

- A project is verified when its URL matches a fetched public repository.
- A skill is supported when it appears in repository language/topic/name/description metadata or in the parsed résumé text.
- Experience and education are linked to résumé lines through normalized title and organization matching.
- Unmatched skills remain visible as gaps so the user can document or remove them.

## Trust boundaries

- `GEMINI_API_KEY` exists only in the server environment.
- Public GitHub data is retrieved with the server-only `GITHUB_TOKEN` when configured; visitor credentials are never requested for generation.
- A GitHub PAT is requested only for explicit publishing, sent once to the server, and never persisted.
- Résumé contents and evidence are held for the active request and returned to the browser; the application does not write them to a database.
- Generated links and HTML are sanitized before rendering or export.
- The preview iframe is sandboxed.

## Reliability choices

The main flow does not ask Gemini to generate an entire website. Full-site generation increases latency, quota consumption, malformed-output risk, and demo failure rates. A schema-constrained profiling call keeps AI central to source understanding, while deterministic renderers make theme switching, responsive layout, export, and tests predictable.

GitHub profile and repository requests are independently recoverable, deduplicated while in flight, and cached in a warm server instance for 15 minutes. Rate-limit reset headers are translated into actionable notices. If GitHub remains unavailable, résumé-backed generation continues without inventing repository evidence.

The refresh workflow is deliberately manual. Genuine background monitoring would require authentication, durable user state, and GitHub authorization or webhooks. Those production concerns are not hidden behind a fake scheduled feature.

## Deployment

The builder runs as a Cloudflare Worker because it contains secure API routes. Cloudflare’s Git integration builds and deploys new `main` commits, while `GEMINI_API_KEY` and `GITHUB_TOKEN` stay attached as runtime Worker secrets. Exported portfolios are static and can run on GitHub Pages, Netlify, Vercel, Cloudflare Pages, or any ordinary static host.
