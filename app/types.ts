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
};
