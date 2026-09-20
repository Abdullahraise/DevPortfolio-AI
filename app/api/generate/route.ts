import { NextResponse } from "next/server.js";
import type { PortfolioProfile, Project, TimelineItem } from "../../types";
import {
  extractEmail,
  extractLinkedIn,
  extractPdf,
  skillMatches,
} from "./extraction.ts";
import {
  buildEvidenceMap,
  detectProfileGaps,
  profileScore,
  rankProfileForRole,
  sourceSnapshot,
  type VerifiedRepository,
} from "../../../lib/profile-intelligence.ts";

export const dynamic = "force-dynamic";

type GitHubUser = {
  login: string;
  name: string | null;
  bio: string | null;
  avatar_url: string;
  html_url: string;
  blog: string | null;
  location: string | null;
  email: string | null;
};

type GitHubRepo = {
  id: number;
  name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  fork: boolean;
  archived: boolean;
  topics?: string[];
  updated_at: string;
};

type AiProfileInput = {
  fullName?: unknown;
  headline?: unknown;
  bio?: unknown;
  location?: unknown;
  contactLinks?: {
    github?: unknown;
    linkedin?: unknown;
    email?: unknown;
  };
  skills?: unknown;
  featuredProjects?: unknown;
  workExperience?: unknown;
  education?: unknown;
};

type GeminiFailure = {
  notice: string;
  category: "authentication" | "quota" | "model" | "temporary";
};

const timelineSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", description: "The exact role title or degree/program name." },
    organization: { type: "string", description: "The employer, organization, school, or university." },
    period: { type: "string", description: "The date range as supported by the source, otherwise an empty string." },
    description: { type: "string", description: "One concise factual sentence using only source evidence." },
  },
  required: ["title", "organization", "period", "description"],
} as const;

const profileSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    fullName: { type: "string" },
    headline: { type: "string" },
    bio: { type: "string" },
    location: { type: "string" },
    contactLinks: {
      type: "object",
      additionalProperties: false,
      properties: {
        github: { type: "string" },
        linkedin: { type: "string" },
        email: { type: "string" },
      },
      required: ["github", "linkedin", "email"],
    },
    skills: {
      type: "object",
      additionalProperties: { type: "array", items: { type: "string" } },
    },
    featuredProjects: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          techStack: { type: "array", items: { type: "string" } },
          githubUrl: { type: "string" },
          liveUrl: { type: "string" },
          stars: { type: "number" },
          forks: { type: "number" },
        },
        required: ["id", "title", "description", "techStack", "githubUrl", "liveUrl", "stars", "forks"],
      },
    },
    workExperience: { type: "array", maxItems: 6, items: timelineSchema },
    education: { type: "array", maxItems: 6, items: timelineSchema },
  },
  required: ["fullName", "headline", "bio", "location", "contactLinks", "skills", "featuredProjects", "workExperience", "education"],
} as const;

function normalizeUsername(raw: string) {
  const value = raw.trim().replace(/\/$/, "");
  const match = value.match(/github\.com\/([^/?#]+)/i);
  return (match?.[1] ?? value).replace(/^@/, "");
}

function safeString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function conciseHeadline(value: unknown, fallback: string) {
  const headline = safeString(value, fallback).split(/\s+/).slice(0, 8).join(" ");
  if (headline.length <= 72) return headline;
  return headline.slice(0, 72).replace(/\s+\S*$/, "").trim();
}

export function headlineForTarget(
  targetRole: string,
  generatedHeadline: string,
  fallback: string,
) {
  const target = targetRole.trim().replace(/\s+/g, " ");
  const looksLikeRoleTitle =
    target.length > 0 &&
    target.length <= 72 &&
    target.split(" ").length <= 8 &&
    !/[\n\r]|(?:responsibilities|requirements|we are looking|you will)/i.test(
      targetRole,
    );
  return looksLikeRoleTitle
    ? conciseHeadline(target, fallback)
    : conciseHeadline(generatedHeadline, fallback);
}

async function githubFetch<T>(path: string) {
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "User-Agent": "DevPortfolio-AI",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (response.status === 404)
    throw new Error("We could not find that GitHub profile.");
  if (response.status === 403 || response.status === 429)
    throw new Error(
      "GitHub is temporarily rate-limiting requests. Please try again shortly.",
    );
  if (!response.ok) throw new Error("GitHub data is temporarily unavailable.");
  return (await response.json()) as T;
}

async function fetchGitHub(username: string, notices: string[]) {
  if (process.env.DEVPORTFOLIO_DISABLE_EXTERNAL_FETCH === "true") {
    notices.push(
      "GitHub lookup was skipped for this local test; resume data was used instead.",
    );
    return {
      user: null,
      repos: [] as GitHubRepo[],
      languageCounts: new Map<string, number>(),
    };
  }
  try {
    const [user, repos] = await Promise.all([
      githubFetch<GitHubUser>(`/users/${encodeURIComponent(username)}`),
      githubFetch<GitHubRepo[]>(
        `/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`,
      ),
    ]);
    const curated = repos
      .filter((repo) => !repo.fork && !repo.archived)
      .sort(
        (a, b) =>
          b.stargazers_count - a.stargazers_count ||
          b.forks_count - a.forks_count,
      )
      .slice(0, 6);
    const languageCounts = new Map<string, number>();
    curated.forEach((repo) => {
      if (repo.language)
        languageCounts.set(
          repo.language.toLowerCase(),
          (languageCounts.get(repo.language.toLowerCase()) ?? 0) + 1,
        );
    });
    return { user, repos: curated, languageCounts };
  } catch (error) {
    notices.push(
      error instanceof Error
        ? error.message
        : "GitHub data could not be loaded.",
    );
    return {
      user: null,
      repos: [] as GitHubRepo[],
      languageCounts: new Map<string, number>(),
    };
  }
}

function projectsFromRepos(repos: GitHubRepo[]): Project[] {
  return repos.map((repo) => ({
    id: String(repo.id),
    title: repo.name
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase()),
    description:
      repo.description ??
      "A public GitHub project. Add a concise outcome-focused description in the editor.",
    techStack: [
      ...new Set(
        [repo.language, ...(repo.topics ?? []).slice(0, 3)].filter(
          Boolean,
        ) as string[],
      ),
    ],
    githubUrl: repo.html_url,
    liveUrl: repo.homepage?.startsWith("http") ? repo.homepage : "",
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    visible: true,
  }));
}

function fallbackProfile(
  user: GitHubUser | null,
  repos: GitHubRepo[],
  resumeText: string,
  username: string,
  languageCounts: Map<string, number>,
): PortfolioProfile {
  const name =
    user?.name ??
    username
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  const topSkills = [...languageCounts.keys()]
    .slice(0, 2)
    .map((item) => item.replace(/\b\w/g, (letter) => letter.toUpperCase()));
  return {
    fullName: name,
    headline: topSkills.length
      ? `${topSkills.join(" & ")} Developer`
      : "Software Developer",
    bio: user?.bio ?? "",
    avatarUrl: user?.avatar_url ?? "",
    location: user?.location ?? "",
    contactLinks: {
      github: user?.html_url ?? `https://github.com/${username}`,
      linkedin: extractLinkedIn(resumeText),
      email: extractEmail(resumeText) || user?.email || "",
    },
    skills: skillMatches(
      `${resumeText}\n${repos.map((repo) => `${repo.language ?? ""} ${(repo.topics ?? []).join(" ")}`).join(" ")}`,
      languageCounts,
    ),
    featuredProjects: projectsFromRepos(repos),
    workExperience: [],
    education: [],
  };
}

export function cleanTimeline(value: unknown): TimelineItem[] {
  if (!Array.isArray(value)) return [];
  const placeholders = /^(role|position|job|degree|education|experience|unknown|n\/?a|none|-+)$/i;
  const seen = new Set<string>();
  return value
    .slice(0, 12)
    .flatMap((entry) => {
      const item = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
      const title = safeString(item.title);
      if (!title || placeholders.test(title)) return [];
      const organization = safeString(item.organization);
      const period = safeString(item.period);
      const description = safeString(item.description);
      const key = `${title}|${organization}|${period}`.toLowerCase();
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ title, organization, period, description }];
    })
    .slice(0, 6);
}

function mergeAiProfile(
  value: AiProfileInput,
  base: PortfolioProfile,
): PortfolioProfile {
  const projects = Array.isArray(value.featuredProjects)
    ? value.featuredProjects.slice(0, 6).map((item, index: number) => {
        const project =
          item && typeof item === "object"
            ? (item as Record<string, unknown>)
            : {};
        return {
        id: safeString(
          project.id,
          base.featuredProjects[index]?.id ?? String(index),
        ),
        title: safeString(
          project.title,
          base.featuredProjects[index]?.title ?? "Project",
        ),
        description: safeString(
          project.description,
          base.featuredProjects[index]?.description ?? "",
        ),
        techStack: Array.isArray(project.techStack)
          ? project.techStack
              .filter((item: unknown) => typeof item === "string")
              .slice(0, 8)
          : (base.featuredProjects[index]?.techStack ?? []),
        githubUrl: safeString(
          project.githubUrl,
          base.featuredProjects[index]?.githubUrl ?? "",
        ),
        liveUrl: safeString(
          project.liveUrl,
          base.featuredProjects[index]?.liveUrl ?? "",
        ),
        stars: typeof project.stars === "number" && Number.isFinite(project.stars)
          ? project.stars
          : (base.featuredProjects[index]?.stars ?? 0),
        forks: typeof project.forks === "number" && Number.isFinite(project.forks)
          ? project.forks
          : (base.featuredProjects[index]?.forks ?? 0),
        visible: true,
      };
      })
    : base.featuredProjects;
  const skills =
    value.skills && typeof value.skills === "object"
      ? (value.skills as Record<string, unknown>)
      : base.skills;
  return {
    ...base,
    fullName: safeString(value.fullName, base.fullName),
    headline: conciseHeadline(value.headline, base.headline),
    bio: safeString(value.bio, base.bio),
    location: safeString(value.location, base.location),
    contactLinks: {
      github: safeString(value?.contactLinks?.github, base.contactLinks.github),
      linkedin: safeString(
        value?.contactLinks?.linkedin,
        base.contactLinks.linkedin,
      ),
      email: safeString(value?.contactLinks?.email, base.contactLinks.email),
    },
    skills: Object.fromEntries(
      Object.entries(skills).map(([key, items]) => [
        key,
        Array.isArray(items)
          ? items.filter((item) => typeof item === "string").slice(0, 15)
          : [],
      ]),
    ),
    featuredProjects: projects,
    workExperience: cleanTimeline(value.workExperience),
    education: cleanTimeline(value.education),
  };
}

export function classifyGeminiFailure(error: unknown): GeminiFailure {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (/api.?key|unauthenticated|permission.?denied|\b401\b|\b403\b/.test(message))
    return {
      category: "authentication",
      notice: "Gemini rejected the configured API key. A source-based portfolio was generated instead; update the Worker secret before the final demo.",
    };
  if (/quota|resource.?exhausted|rate.?limit|\b429\b/.test(message))
    return {
      category: "quota",
      notice: "Gemini quota is temporarily unavailable. A source-based portfolio was generated instead; retry the AI analysis later.",
    };
  if (/model|not.?found|unsupported/.test(message))
    return {
      category: "model",
      notice: "The configured Gemini model is unavailable. A source-based portfolio was generated instead.",
    };
  return {
    category: "temporary",
    notice: "Gemini is temporarily unavailable. A source-based portfolio was generated instead, so you can continue editing and exporting.",
  };
}

async function synthesizeWithGemini(
  base: PortfolioProfile,
  resumeText: string,
  targetRole: string,
): Promise<{ profile: PortfolioProfile | null; failure: GeminiFailure | null }> {
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const numberedResume = resumeText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => `L${index + 1}: ${line}`)
      .join("\n");
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Extract and synthesize a factual developer portfolio profile from the GitHub base profile and résumé text below.

Accuracy rules:
- Never invent employers, institutions, degrees, roles, dates, metrics, URLs, technologies, or outcomes.
- Read the entire numbered résumé and associate adjacent lines under Experience, Internships, Leadership, Education, Projects, and Skills headings.
- workExperience includes internships, employment, volunteering, leadership, and positions of responsibility when present.
- For every workExperience item: title is the actual role; organization is the company or organization; period is the supported date range; description is one concise evidence-based sentence.
- For every education item: title is the degree or program (for example B.Tech in CSBS); organization is the institution; period is the supported date range; description contains only useful supported details.
- Never output placeholders such as Role, Position, Degree, Unknown, N/A, or section-heading text. Omit an item if its actual title cannot be identified.
- Preserve all distinct supported experience and education entries, up to six each. Do not collapse them into generic labels.
- Keep the headline to eight words or fewer and the bio to one sentence of twenty words or fewer.
- When the target is a concise job title of eight words or fewer, use that exact title as the headline.
- Curate at most six real projects and retain GitHub metrics and URLs from the base profile.
- The optional target role or job description is presentation context, never a source of candidate facts.
- When a target is provided, emphasize and order only the existing supported projects and skills that are relevant to it.
- Never copy a requirement from the target into the candidate profile unless GitHub or the résumé already supports it.

TARGET ROLE OR JOB DESCRIPTION:
${targetRole ? targetRole.slice(0, 4000) : "Not provided"}

GITHUB BASE PROFILE:
${JSON.stringify(base)}

NUMBERED RÉSUMÉ TEXT:
${numberedResume.slice(0, 22000)}`,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: profileSchema,
        temperature: 0.1,
      },
    });
    const raw = response.text?.trim();
    return {
      profile: raw ? mergeAiProfile(JSON.parse(raw), base) : null,
      failure: raw ? null : classifyGeminiFailure("empty response"),
    };
  } catch (error) {
    const failure = classifyGeminiFailure(error);
    const status = error && typeof error === "object" && "status" in error
      ? String((error as { status?: unknown }).status ?? "unknown")
      : "unknown";
    console.error("Gemini profiling failed", { category: failure.category, status });
    return { profile: null, failure };
  }
}

export async function POST(request: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        {
          error:
            "The server is missing its Gemini API key configuration. For local setup, add GEMINI_API_KEY to .env.local and restart the app.",
        },
        { status: 503 },
      );
    }
    const form = await request.formData();
    const rawUsername = form.get("github");
    const resume = form.get("resume");
    const targetRole = safeString(form.get("targetRole")).slice(0, 3000);
    if (typeof rawUsername !== "string" || !rawUsername.trim()) {
      return NextResponse.json(
        { error: "Enter a GitHub username or profile URL." },
        { status: 400 },
      );
    }
    if (!(resume instanceof File)) {
      return NextResponse.json(
        { error: "Upload your resume as a PDF." },
        { status: 400 },
      );
    }
    const username = normalizeUsername(rawUsername);
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(username)) {
      return NextResponse.json(
        { error: "That does not look like a valid GitHub username." },
        { status: 400 },
      );
    }
    const notices: string[] = [];
    const [resumeText, github] = await Promise.all([
      extractPdf(resume, notices),
      fetchGitHub(username, notices),
    ]);
    if (!github.user && !resumeText) {
      return NextResponse.json(
        {
          error:
            "We could not read enough information to build a portfolio. Check the GitHub username or try a text-based PDF.",
        },
        { status: 422 },
      );
    }
    const base = fallbackProfile(
      github.user,
      github.repos,
      resumeText,
      username,
      github.languageCounts,
    );
    const synthesis = await synthesizeWithGemini(base, resumeText, targetRole);
    if (synthesis.failure) notices.push(synthesis.failure.notice);
    const rankedProfile = rankProfileForRole(
      synthesis.profile ?? base,
      targetRole,
    );
    const profile = {
      ...rankedProfile,
      headline: headlineForTarget(
        targetRole,
        rankedProfile.headline,
        base.headline,
      ),
    };
    const repositories: VerifiedRepository[] = github.repos.map((repo) => ({
      id: String(repo.id),
      name: repo.name,
      description: repo.description ?? "",
      url: repo.html_url,
      homepage: repo.homepage?.startsWith("http") ? repo.homepage : "",
      language: repo.language ?? "",
      topics: repo.topics ?? [],
      updatedAt: repo.updated_at ?? "",
    }));
    const evidence = buildEvidenceMap(profile, repositories, resumeText);
    const gaps = detectProfileGaps(profile, evidence);
    return NextResponse.json({
      profile,
      notices,
      usedAi: Boolean(synthesis.profile),
      needsClarification:
        !targetRole && profile.headline === "Software Developer",
      targetRole,
      evidence,
      gaps,
      profileScore: profileScore(gaps),
      sourceSnapshot: sourceSnapshot(username, repositories),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Something went wrong while generating your portfolio.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
