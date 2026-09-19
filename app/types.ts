export type ContactLinks = {
  github: string;
  linkedin: string;
  email: string;
};

export type Project = {
  id: string;
  title: string;
  description: string;
  techStack: string[];
  githubUrl: string;
  liveUrl: string;
  stars: number;
  forks: number;
  visible: boolean;
};

export type EvidenceSource = {
  type: "github" | "resume";
  label: string;
  url?: string;
  lines?: number[];
};

export type EvidenceItem = {
  id: string;
  category: "project" | "skill" | "experience" | "education";
  claim: string;
  sources: EvidenceSource[];
};

export type ProfileGap = {
  id: string;
  severity: "high" | "medium" | "low";
  category: "project" | "skill" | "profile" | "evidence";
  message: string;
  action: string;
  projectId?: string;
};

export type SourceSnapshot = {
  username: string;
  generatedAt: string;
  repositories: Array<{
    id: string;
    title: string;
    updatedAt: string;
  }>;
};

export type TimelineItem = {
  title: string;
  organization: string;
  period: string;
  description: string;
};

export type PortfolioProfile = {
  fullName: string;
  headline: string;
  bio: string;
  avatarUrl: string;
  location: string;
  contactLinks: ContactLinks;
  skills: Record<string, string[]>;
  featuredProjects: Project[];
  workExperience: TimelineItem[];
  education: TimelineItem[];
};

export type GenerateResponse = {
  profile: PortfolioProfile;
  notices: string[];
  usedAi: boolean;
  needsClarification: boolean;
  targetRole: string;
  evidence: EvidenceItem[];
  gaps: ProfileGap[];
  profileScore: number;
  sourceSnapshot: SourceSnapshot;
};
