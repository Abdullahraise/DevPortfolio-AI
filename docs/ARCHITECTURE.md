# Architecture

DevPortfolio AI uses a hybrid architecture: AI understands and improves source material, while deterministic application code owns the final HTML, CSS, responsiveness, accessibility, and publishing behavior.

## Main flow

1. The browser submits a public GitHub profile and résumé PDF to `POST /api/generate`.
2. The server validates the request, extracts PDF text, and retrieves public GitHub repositories.
3. Gemini converts those facts into a structured portfolio profile using an explicit schema.
4. The server normalizes and validates experience, education, projects, skills, and links.
5. The browser renders the profile through one of five local theme systems.
6. Edits and theme changes happen instantly without another model call.
7. The user can download a sanitized, dependency-free `index.html`.
8. Optionally, `POST /api/publish` writes that file to a fresh repository and enables GitHub Pages.

## Components

| Component | Responsibility |
| --- | --- |
| `app/page.tsx` | Upload, generation, editing, preview, download, and publishing UI |
| `app/api/generate/route.ts` | Input validation, GitHub retrieval, PDF extraction, Gemini profiling, and error mapping |
| `app/api/generate/extraction.ts` | Structured extraction and cleanup helpers |
| `lib/portfolio-template.ts` | Five deterministic portfolio layout systems and exported HTML |
| `lib/generated-html.ts` | Sanitization and safety checks for generated documents |
| `app/api/publish/route.ts` | Guarded GitHub repository upload and Pages activation |

## Trust boundaries

- `GEMINI_API_KEY` exists only in the server environment.
- Public GitHub data is retrieved without visitor credentials.
- A GitHub PAT is requested only when the user explicitly publishes, sent once to the server, and never persisted.
- Résumé contents are processed for the active request and are not stored by the application.
- Generated links and HTML are sanitized before rendering or export.

## Reliability choice

The main flow deliberately avoids asking Gemini to generate an entire website. Full-site generation increased latency, quota consumption, malformed-output risk, and demo failure rates. The hybrid renderer keeps AI central to résumé understanding and content curation while making visual output immediate and predictable.

## Deployment

The builder requires a server runtime because it contains secure API routes. The exported portfolio is static and can run on GitHub Pages, Netlify, Vercel, or any ordinary static host.
