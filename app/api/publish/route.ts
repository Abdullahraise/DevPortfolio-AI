import { Buffer } from "node:buffer";
import { cleanPortfolio } from "../../../lib/generated-html.ts";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
class PublishError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
type RepositoryMetadata = {
  private?: boolean;
  archived?: boolean;
  fork?: boolean;
  owner?: { login?: string };
  name?: string;
  permissions?: { admin?: boolean };
  default_branch?: string;
};
type PagesMetadata = { status?: string };
export function isSupportedGitHubToken(token: unknown) {
  return typeof token === "string" && /^(?:github_pat_[A-Za-z0-9_]{20,250}|ghp_[A-Za-z0-9]{20,255})$/.test(token);
}
// No token persistence, logging or token forwarding to Gemini. All destinations are fixed GitHub API paths.
export async function POST(request: Request) {
  let fileWritten = false;
  let repositoryUrl = "";
  try {
    const url = new URL(request.url);
    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin) throw new PublishError("Cross-origin publishing is not allowed.", 403);
    if (url.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new PublishError("Publishing credentials require HTTPS (or localhost).", 403);
    const raw = await request.text();
    if (raw.length > 240_000) throw new PublishError("Publishing request is too large.", 413);
    const { token, repository, html, consent } = JSON.parse(raw);
    if (consent !== true) throw new PublishError("Confirm that your portfolio and repository will be public.");
    if (!isSupportedGitHubToken(token)) throw new PublishError("Use a valid GitHub personal access token beginning with ghp_ or github_pat_.");
    if (typeof repository !== "string" || !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(repository)) throw new PublishError("Enter a repository as owner/repository.");
    const safeHtml = cleanPortfolio(html);
    const [owner, repo] = repository.split("/");
    const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    repositoryUrl = `https://github.com/${owner}/${repo}`;
    async function github(path: string, method = "GET", body?: unknown) {
      let response: Response;
      try {
        response = await fetch(`https://api.github.com${path}`, {
          method,
          headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "User-Agent": "DevPortfolio-AI", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
      } catch {
        throw new PublishError("The app could not reach GitHub. Check the connection and retry.", 502);
      }
      if (response.status === 401) throw new PublishError("GitHub rejected this token. Check its expiry and repository access.", 401);
      if (response.status === 403 || response.status === 429) throw new PublishError("GitHub blocked the request. Check token permissions, account policies and rate limits.", 403);
      return response;
    }
    const repoResponse = await github(base);
    if (!repoResponse.ok) throw new PublishError("Repository not found or inaccessible. Create a dedicated public repository first.");
    const metadata = (await repoResponse.json()) as RepositoryMetadata;
    if (metadata.private || metadata.archived || metadata.fork || metadata.owner?.login?.toLowerCase() !== owner.toLowerCase() || metadata.name?.toLowerCase() !== repo.toLowerCase()) throw new PublishError("Use a dedicated public, non-archived, non-fork repository.");
    if (!metadata.permissions?.admin) throw new PublishError("You must administer this repository to enable GitHub Pages.", 403);
    const branch = metadata.default_branch || "main";
    const existing = await github(`${base}/contents?ref=${encodeURIComponent(branch)}`);
    if (existing.ok) {
      const entries = await existing.json();
      if (!Array.isArray(entries) || entries.some((entry: { name: string }) => !/^readme(?:\.md)?$/i.test(entry.name))) throw new PublishError("This repository contains existing work. Use an empty repository (a README is okay). Nothing was overwritten.", 409);
    } else if (![404, 409].includes(existing.status)) throw new PublishError("Could not verify that this repository is empty.");
    const pages = await github(`${base}/pages`);
    if (pages.ok) throw new PublishError("This repository already has Pages enabled. Use a fresh dedicated repository.", 409);
    if (pages.status !== 404) throw new PublishError("Could not check GitHub Pages permissions.");
    // Create only: omitting sha makes concurrent/existing index.html a conflict, never an overwrite.
    const upload = await github(`${base}/contents/index.html`, "PUT", {
      message: "Publish generated portfolio", content: Buffer.from(safeHtml, "utf8").toString("base64"), branch,
    });
    if (!upload.ok) throw new PublishError("GitHub could not create index.html. Check Contents write permission and branch rules.", 409);
    fileWritten = true;
    const enable = await github(`${base}/pages`, "POST", { build_type: "legacy", source: { branch, path: "/" } });
    if (!enable.ok) throw new PublishError("index.html was uploaded, but Pages setup failed. Enable Pages manually in repository Settings > Pages. Do not retry publishing to this repository.", 502);
    const page = (await enable.json()) as PagesMetadata;
    const deploymentUrl = repo.toLowerCase() === `${owner.toLowerCase()}.github.io` ? `https://${owner.toLowerCase()}.github.io/` : `https://${owner.toLowerCase()}.github.io/${repo}/`;
    return Response.json({ repositoryUrl, deploymentUrl, status: page.status === "built" ? "built" : "pending", message: "Files uploaded and Pages enabled. GitHub may take several minutes to publish. You may now revoke the token." }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof PublishError ? error.message : error instanceof Error ? error.message : "Publishing could not be completed. Check the repository on GitHub before retrying.", fileWritten, ...(repositoryUrl ? { repositoryUrl } : {}) }, { status: error instanceof PublishError ? error.status : 502, headers });
  }
}
