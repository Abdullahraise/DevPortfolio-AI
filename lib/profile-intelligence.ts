import type {
  EvidenceItem,
  EvidenceSource,
  PortfolioProfile,
  ProfileGap,
  SourceSnapshot,
} from "../app/types";

export type VerifiedRepository = {
  id: string;
  name: string;
  description: string;
  url: string;
  homepage: string;
  language: string;
  topics: string[];
  updatedAt: string;
};

const STOP_WORDS = new Set([
  "and", "the", "with", "for", "from", "that", "this", "you", "your",
  "our", "are", "will", "have", "has", "into", "using", "developer",
  "engineer", "role", "job", "work", "experience", "skills", "years",
  "looking", "responsible", "requirements", "preferred", "knowledge",
]);

const ROLE_EXPANSIONS: Record<string, string[]> = {
  backend: ["api", "server", "database", "spring", "node", "express", "django", "flask"],
  frontend: ["react", "next", "vue", "angular", "javascript", "typescript", "html", "css", "ui"],
  fullstack: ["api", "database", "react", "next", "node", "spring", "javascript", "typescript"],
  java: ["java", "spring", "springboot", "maven", "gradle"],
  cloud: ["aws", "azure", "gcp", "docker", "kubernetes", "terraform"],
  devops: ["docker", "kubernetes", "terraform", "jenkins", "github", "actions", "ci", "cd"],
};

function normalized(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").trim();
}

export function roleTokens(targetRole: string) {
  const base = normalized(targetRole)
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
  const expanded = base.flatMap((token) => ROLE_EXPANSIONS[token.replace(/[-\s]/g, "")] ?? []);
  return [...new Set([...base, ...expanded])].slice(0, 80);
}

function tokenScore(text: string, tokens: string[], weight: number) {
  const haystack = ` ${normalized(text)} `;
  return tokens.reduce(
    (score, token) => score + (haystack.includes(` ${normalized(token)} `) ? weight : 0),
    0,
  );
}

export function rankProfileForRole(
  profile: PortfolioProfile,
  targetRole: string,
): PortfolioProfile {
  const tokens = roleTokens(targetRole);
  if (!tokens.length) return profile;
  const scoredProjects = profile.featuredProjects.map((project, index) => ({
    project,
    index,
    score:
      tokenScore(project.techStack.join(" "), tokens, 6) +
      tokenScore(project.title, tokens, 3) +
      tokenScore(project.description, tokens, 2),
  }));
  scoredProjects.sort((a, b) => b.score - a.score || a.index - b.index);

  const rankedSkills = Object.fromEntries(
    Object.entries(profile.skills).map(([group, skills]) => [
      group,
      skills
        .map((skill, index) => ({ skill, index, score: tokenScore(skill, tokens, 5) }))
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .map(({ skill }) => skill),
    ]),
  );

  return {
    ...profile,
    skills: rankedSkills,
    featuredProjects: scoredProjects.map(({ project }) => project),
  };
}

function resumeLinesFor(value: string, resumeText: string) {
  const needle = normalized(value);
  if (!needle) return [];
  return resumeText
    .split(/\r?\n/)
    .map((line, index) => ({ line: normalized(line), number: index + 1 }))
    .filter(({ line }) => line.includes(needle))
    .map(({ number }) => number)
    .slice(0, 5);
}

function repoSupportsSkill(repo: VerifiedRepository, skill: string) {
  const needle = normalized(skill);
  const evidence = normalized(
    `${repo.language} ${repo.topics.join(" ")} ${repo.name} ${repo.description}`,
  );
  return Boolean(needle && evidence.includes(needle));
}

export function buildEvidenceMap(
  profile: PortfolioProfile,
  repositories: VerifiedRepository[],
  resumeText: string,
): EvidenceItem[] {
  const repoByUrl = new Map(repositories.map((repo) => [repo.url, repo]));
  const projectEvidence: EvidenceItem[] = profile.featuredProjects.map((project) => {
    const repo = repoByUrl.get(project.githubUrl);
    return {
      id: `project:${project.id}`,
      category: "project" as const,
      claim: project.title,
      sources: repo
        ? [{ type: "github" as const, label: repo.name, url: repo.url }]
        : [],
    };
  });

  const skillEvidence: EvidenceItem[] = Object.values(profile.skills)
    .flat()
    .map((skill) => {
      const sources: EvidenceSource[] = repositories
        .filter((repo) => repoSupportsSkill(repo, skill))
        .slice(0, 3)
        .map((repo) => ({ type: "github" as const, label: repo.name, url: repo.url }));
      const lines = resumeLinesFor(skill, resumeText);
      if (lines.length)
        sources.push({ type: "resume" as const, label: "Uploaded resume", lines });
      return {
        id: `skill:${normalized(skill)}`,
        category: "skill" as const,
        claim: skill,
        sources,
      };
    });

  const timelineEvidence = (
    category: "experience" | "education",
    items: PortfolioProfile["workExperience"],
  ): EvidenceItem[] => items.map((item, index) => {
    const lines = [
      ...resumeLinesFor(item.title, resumeText),
      ...resumeLinesFor(item.organization, resumeText),
    ];
    return {
      id: `${category}:${index}`,
      category,
      claim: item.organization ? `${item.title} — ${item.organization}` : item.title,
      sources: lines.length
        ? [{ type: "resume" as const, label: "Uploaded resume", lines: [...new Set(lines)].slice(0, 6) }]
        : [],
    };
  });

  return [
    ...projectEvidence,
    ...skillEvidence,
    ...timelineEvidence("experience", profile.workExperience),
    ...timelineEvidence("education", profile.education),
  ];
}

export function detectProfileGaps(
  profile: PortfolioProfile,
  evidence: EvidenceItem[],
): ProfileGap[] {
  const gaps: ProfileGap[] = [];
  if (!profile.featuredProjects.length) {
    gaps.push({
      id: "profile:no-projects",
      severity: "high",
      category: "profile",
      message: "No public project evidence is available.",
      action: "Add at least one public, documented GitHub project.",
    });
  }
  if (!profile.contactLinks.email) gaps.push({
    id: "profile:no-email", severity: "medium", category: "profile",
    message: "The portfolio has no contact email.", action: "Add a professional contact email before publishing.",
  });
  if (!profile.contactLinks.linkedin) gaps.push({
    id: "profile:no-linkedin", severity: "low", category: "profile",
    message: "No LinkedIn profile was detected.", action: "Add LinkedIn if it is part of your professional presence.",
  });
  profile.featuredProjects.forEach((project) => {
    if (/^A public GitHub project\./i.test(project.description) || project.description.trim().length < 28)
      gaps.push({
        id: `project:${project.id}:description`, severity: "high", category: "project", projectId: project.id,
        message: `${project.title} needs a specific, outcome-focused description.`,
        action: "Explain the problem, your contribution, and the result without inventing metrics.",
      });
    if (!project.techStack.length)
      gaps.push({
        id: `project:${project.id}:stack`, severity: "medium", category: "project", projectId: project.id,
        message: `${project.title} has no verified technology metadata.`,
        action: "Add GitHub repository topics or document the stack in the resume.",
      });
    if (!project.liveUrl)
      gaps.push({
        id: `project:${project.id}:demo`, severity: "low", category: "project", projectId: project.id,
        message: `${project.title} has no live demonstration link.`,
        action: "Add a demo URL when applicable, or keep the source link for backend-only work.",
      });
  });
  evidence
    .filter((item) => item.category === "skill" && item.sources.length === 0)
    .forEach((item) => gaps.push({
      id: `${item.id}:evidence`, severity: "medium", category: "evidence",
      message: `${item.claim} is not evidenced by the selected public repositories or parsed resume.`,
      action: "Document where you used this skill or remove it from the public profile.",
    }));
  return gaps;
}

export function profileScore(gaps: ProfileGap[]) {
  const penalty = gaps.reduce(
    (total, gap) => total + (gap.severity === "high" ? 12 : gap.severity === "medium" ? 6 : 2),
    0,
  );
  return Math.max(0, Math.min(100, 100 - penalty));
}

export function sourceSnapshot(
  username: string,
  repositories: VerifiedRepository[],
): SourceSnapshot {
  return {
    username,
    generatedAt: new Date().toISOString(),
    repositories: repositories.map((repo) => ({
      id: repo.id,
      title: repo.name,
      updatedAt: repo.updatedAt,
    })),
  };
}

export function compareSnapshots(previous: SourceSnapshot, next: SourceSnapshot) {
  const oldRepos = new Map(previous.repositories.map((repo) => [repo.id, repo]));
  const added = next.repositories.filter((repo) => !oldRepos.has(repo.id));
  const updated = next.repositories.filter((repo) => {
    const old = oldRepos.get(repo.id);
    return old && old.updatedAt !== repo.updatedAt;
  });
  return { added, updated };
}
