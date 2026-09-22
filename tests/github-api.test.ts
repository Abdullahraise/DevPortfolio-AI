import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clearGitHubCache,
  GitHubApiError,
  githubFetch,
} from "../lib/github-api.ts";

test("authenticates GitHub requests without exposing the token in the URL", async () => {
  let requestedUrl = "";
  let requestedHeaders = new Headers();
  const fetchImpl: typeof fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedHeaders = new Headers(init?.headers);
    return Response.json({ login: "arun" });
  };

  const result = await githubFetch<{ login: string }>("/users/arun", {
    cache: false,
    fetchImpl,
    token: "secret-token",
  });

  assert.equal(result.login, "arun");
  assert.equal(requestedHeaders.get("authorization"), "Bearer secret-token");
  assert.equal(requestedUrl, "https://api.github.com/users/arun");
  assert.equal(requestedUrl.includes("secret-token"), false);
});

test("keeps public GitHub lookup working when a token is not configured", async () => {
  let requestedHeaders = new Headers();
  const fetchImpl: typeof fetch = async (_input, init) => {
    requestedHeaders = new Headers(init?.headers);
    return Response.json([]);
  };

  await githubFetch("/users/arun/repos", {
    cache: false,
    fetchImpl,
    token: "",
  });
  assert.equal(requestedHeaders.has("authorization"), false);
});

test("reports GitHub's rate-limit reset time", async () => {
  const reset = 1_800_000_000;
  const fetchImpl: typeof fetch = async () =>
    new Response("rate limited", {
      status: 403,
      headers: {
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": String(reset),
      },
    });

  await assert.rejects(
    () => githubFetch("/users/arun", { cache: false, fetchImpl, token: "token" }),
    (error: unknown) => {
      assert.ok(error instanceof GitHubApiError);
      assert.equal(error.status, 403);
      assert.match(error.message, /2027-01-15 08:00 UTC/);
      return true;
    },
  );
});

test("caches successful GitHub responses and deduplicates repeated lookups", async () => {
  clearGitHubCache();
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls += 1;
    return Response.json({ login: "arun" });
  };

  const options = { fetchImpl, token: "token" };
  const [first, second] = await Promise.all([
    githubFetch<{ login: string }>("/users/cache-test", options),
    githubFetch<{ login: string }>("/users/cache-test", options),
  ]);
  const third = await githubFetch<{ login: string }>("/users/cache-test", options);

  assert.equal(first.login, "arun");
  assert.equal(second.login, "arun");
  assert.equal(third.login, "arun");
  assert.equal(calls, 1);
  clearGitHubCache();
});
