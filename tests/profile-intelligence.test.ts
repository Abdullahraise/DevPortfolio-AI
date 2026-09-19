import assert from "node:assert/strict";
import { test } from "node:test";
import type { PortfolioProfile, SourceSnapshot } from "../app/types.ts";
import {
  buildEvidenceMap,
  compareSnapshots,
  detectProfileGaps,
  profileScore,
  rankProfileForRole,
  roleTokens,
  type VerifiedRepository,
} from "../lib/profile-intelligence.ts";

const profile: PortfolioProfile = {
  fullName: "Abdullah R.",
  headline: "Full-stack developer",
  bio: "I build dependable web products.",
  avatarUrl: "",
  location: "Chennai",
  contactLinks: { github: "https://github.com/abdullah", linkedin: "", email: "abdullah@example.com" },
  skills: { Languages: ["JavaScript", "Java"], Frameworks: ["React", "Spring Boot"] },
  featuredProjects: [
    { id: "1", title: "Storefront", description: "Responsive shopping interface for a furniture business.", techStack: ["React", "JavaScript"], githubUrl: "https://github.com/abdullah/storefront", liveUrl: "https://example.com", stars: 0, forks: 0, visible: true },
    { id: "2", title: "Order API", description: "REST API for validated order processing and persistence.", techStack: ["Java", "Spring Boot"], githubUrl: "https://github.com/abdullah/order-api", liveUrl: "", stars: 0, forks: 0, visible: true },
  ],
  workExperience: [{ title: "Backend Intern", organization: "Example Labs", period: "2026", description: "Built APIs." }],
  education: [],
};

const repositories: VerifiedRepository[] = [
  { id: "1", name: "storefront", description: "React storefront", url: "https://github.com/abdullah/storefront", homepage: "https://example.com", language: "JavaScript", topics: ["react"], updatedAt: "2026-09-01" },
  { id: "2", name: "order-api", description: "Spring order API", url: "https://github.com/abdullah/order-api", homepage: "", language: "Java", topics: ["spring-boot", "api"], updatedAt: "2026-09-10" },
];

test("expands role terms and ranks verified projects without changing facts", () => {
  assert.ok(roleTokens("Java Backend Developer").includes("spring"));
  const ranked = rankProfileForRole(profile, "Java backend role using Spring Boot APIs");
  assert.equal(ranked.featuredProjects[0].id, "2");
  assert.equal(ranked.featuredProjects[0].description, profile.featuredProjects[1].description);
  assert.equal(ranked.skills.Languages[0], "Java");
});

test("maps skill and project claims to GitHub and resume evidence", () => {
  const evidence = buildEvidenceMap(
    profile,
    repositories,
    "Backend Intern at Example Labs\nBuilt services with Java and Spring Boot",
  );
  const java = evidence.find((item) => item.id === "skill:java");
  assert.ok(java?.sources.some((source) => source.type === "github" && source.label === "order-api"));
  assert.ok(java?.sources.some((source) => source.type === "resume" && source.lines?.includes(2)));
  const project = evidence.find((item) => item.id === "project:2");
  assert.equal(project?.sources[0].url, "https://github.com/abdullah/order-api");
});

test("reports actionable deterministic profile gaps and a bounded score", () => {
  const weak = {
    ...profile,
    contactLinks: { ...profile.contactLinks, email: "" },
    featuredProjects: [{
      ...profile.featuredProjects[1],
      description: "A public GitHub project.",
      techStack: [],
    }],
  };
  const evidence = buildEvidenceMap(weak, repositories, "");
  const gaps = detectProfileGaps(weak, evidence);
  assert.ok(gaps.some((gap) => gap.id === "profile:no-email"));
  assert.ok(gaps.some((gap) => gap.id === "project:2:description"));
  assert.ok(gaps.some((gap) => gap.id === "project:2:stack"));
  assert.ok(profileScore(gaps) >= 0 && profileScore(gaps) <= 100);
});

test("compares source snapshots for manual refresh", () => {
  const previous: SourceSnapshot = {
    username: "abdullah",
    generatedAt: "2026-09-01",
    repositories: [{ id: "1", title: "storefront", updatedAt: "2026-09-01" }],
  };
  const next: SourceSnapshot = {
    username: "abdullah",
    generatedAt: "2026-09-19",
    repositories: [
      { id: "1", title: "storefront", updatedAt: "2026-09-18" },
      { id: "2", title: "order-api", updatedAt: "2026-09-10" },
    ],
  };
  const changes = compareSnapshots(previous, next);
  assert.deepEqual(changes.added.map((repo) => repo.id), ["2"]);
  assert.deepEqual(changes.updated.map((repo) => repo.id), ["1"]);
});
