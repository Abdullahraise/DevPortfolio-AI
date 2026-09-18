import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanPortfolio, extractHtmlDocument } from "../lib/generated-html.ts";
import { isSupportedGitHubToken, POST as publish } from "../app/api/publish/route.ts";

const validPage = `<!doctype html><html lang="en"><head><title>Portfolio</title><style>body{color:#111}</style></head><body><main><h1>Arun Kumar</h1><a href="https://github.com/arun">GitHub</a></main></body></html>`;

test("sanitizes executable content from generated portfolios", () => {
  const cleaned = cleanPortfolio(
    validPage.replace("</main>", '<script>alert(1)</script><iframe src="https://example.com"></iframe></main>'),
  );
  assert.doesNotMatch(cleaned, /<script|<iframe/i);
  assert.match(cleaned, /Content-Security-Policy/);
  assert.match(cleaned, /noopener noreferrer/);
});

test("rejects incomplete generated pages", () => {
  assert.throws(() => cleanPortfolio("<h1>Incomplete</h1>"), /incomplete/i);
});

test("recovers a complete document from Gemini wrapper text", () => {
  const wrapped = `Here is the finished page:\n\`\`\`html\n${validPage}\n\`\`\``;
  assert.equal(extractHtmlDocument(wrapped), validPage);
  assert.match(cleanPortfolio(wrapped), /<h1>Arun Kumar<\/h1>/);
});

test("publishing requires explicit public-repository consent", async () => {
  const response = await publish(new Request("https://portfolio.test/api/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://portfolio.test" },
    body: JSON.stringify({ repository: "arun/site", token: "github_pat_invalid", html: validPage, consent: false }),
  }));
  const result = (await response.json()) as { error: string };
  assert.equal(response.status, 400);
  assert.match(result.error, /public/i);
});

test("publishing rejects credentials over non-local HTTP", async () => {
  const response = await publish(new Request("http://portfolio.test/api/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://portfolio.test" },
    body: JSON.stringify({ repository: "arun/site", token: `github_pat_${"a".repeat(26)}`, html: validPage, consent: true }),
  }));
  assert.equal(response.status, 403);
});

test("publishing accepts classic and fine-grained GitHub token formats", () => {
  assert.equal(isSupportedGitHubToken(`ghp_${"a".repeat(36)}`), true);
  assert.equal(isSupportedGitHubToken(`github_pat_${"a".repeat(30)}`), true);
  assert.equal(isSupportedGitHubToken("github-token"), false);
});
