const GITHUB_API_ROOT = "https://api.github.com";
const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;

type CacheEntry = {
  expiresAt: number;
  value: unknown;
};

type GitHubFetchOptions = {
  cache?: boolean;
  fetchImpl?: typeof fetch;
  token?: string;
};

const responseCache = new Map<string, CacheEntry>();
const pendingRequests = new Map<string, Promise<unknown>>();

export class GitHubApiError extends Error {
  readonly status: number;
  readonly retryAt?: string;

  constructor(
    message: string,
    status: number,
    retryAt?: string,
  ) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
    this.retryAt = retryAt;
  }
}

function resetTime(response: Response) {
  const reset = Number(response.headers.get("x-ratelimit-reset"));
  if (!Number.isFinite(reset) || reset <= 0) return undefined;
  return (
    new Date(reset * 1000).toISOString().replace("T", " ").slice(0, 16) +
    " UTC"
  );
}

function rateLimitError(response: Response) {
  const retryAt = resetTime(response);
  const retryAfter = response.headers.get("retry-after");
  const remaining = response.headers.get("x-ratelimit-remaining");

  if (remaining === "0") {
    return new GitHubApiError(
      retryAt
        ? `GitHub's API rate limit was reached. Please retry after ${retryAt}.`
        : "GitHub's API rate limit was reached. Please try again later.",
      response.status,
      retryAt,
    );
  }

  return new GitHubApiError(
    retryAfter
      ? `GitHub temporarily limited this deployment. Please retry in ${retryAfter} seconds.`
      : "GitHub temporarily limited this deployment. Please try again shortly.",
    response.status,
  );
}

function pruneCache(now: number) {
  for (const [key, entry] of responseCache) {
    if (entry.expiresAt <= now) responseCache.delete(key);
  }
  while (responseCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = responseCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    responseCache.delete(oldestKey);
  }
}

export async function githubFetch<T>(
  path: string,
  options: GitHubFetchOptions = {},
): Promise<T> {
  if (!path.startsWith("/"))
    throw new Error("GitHub API paths must begin with '/'.");

  const cacheEnabled = options.cache !== false;
  const now = Date.now();
  if (cacheEnabled) {
    const cached = responseCache.get(path);
    if (cached && cached.expiresAt > now) return cached.value as T;
    if (cached) responseCache.delete(path);
    const pending = pendingRequests.get(path);
    if (pending) return pending as Promise<T>;
  }

  const request = (async () => {
    const token = (options.token ?? process.env.GITHUB_TOKEN ?? "").trim();
    const headers: HeadersInit = {
      Accept: "application/vnd.github+json",
      "User-Agent": "DevPortfolio-AI",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    let response: Response;
    try {
      response = await (options.fetchImpl ?? fetch)(`${GITHUB_API_ROOT}${path}`, {
        headers,
      });
    } catch {
      throw new GitHubApiError(
        "GitHub could not be reached. Please try again shortly.",
        502,
      );
    }

    if (response.status === 404) {
      throw new GitHubApiError("We could not find that GitHub profile.", 404);
    }
    if (response.status === 401) {
      throw new GitHubApiError(
        "GitHub authentication is misconfigured. Check the server's GITHUB_TOKEN.",
        401,
      );
    }
    if (response.status === 403 || response.status === 429) {
      throw rateLimitError(response);
    }
    if (!response.ok) {
      throw new GitHubApiError(
        "GitHub data is temporarily unavailable.",
        response.status,
      );
    }

    const value = (await response.json()) as T;
    if (cacheEnabled) {
      pruneCache(now);
      responseCache.set(path, { value, expiresAt: now + CACHE_TTL_MS });
    }
    return value;
  })();

  if (cacheEnabled) pendingRequests.set(path, request);
  try {
    return await request;
  } finally {
    if (cacheEnabled) pendingRequests.delete(path);
  }
}

export function clearGitHubCache() {
  responseCache.clear();
  pendingRequests.clear();
}
