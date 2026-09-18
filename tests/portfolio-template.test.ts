import assert from "node:assert/strict";
import { test } from "node:test";
import { renderPortfolioHtml, type PortfolioTheme } from "../lib/portfolio-template.ts";
import type { PortfolioProfile } from "../app/types.ts";

const profile: PortfolioProfile = {
  fullName: "Abdullah R.",
  headline: "Full-stack developer building dependable web products",
  bio: "I turn practical business requirements into accessible applications with measurable outcomes and maintainable engineering.",
  avatarUrl: "https://avatars.githubusercontent.com/u/12345?v=4",
  location: "Chennai, India",
  contactLinks: {
    github: "https://github.com/raiseabdullah7",
    linkedin: "https://linkedin.com/in/abdullah",
    email: "abdullah@example.com",
  },
  skills: { Languages: ["Java", "TypeScript"], Frameworks: ["React", "Next.js"] },
  featuredProjects: [
    { id: "1", title: "OmniRoute", description: "A route planning application.", techStack: ["React", "Node.js"], githubUrl: "https://github.com/raiseabdullah7/omniroute", liveUrl: "", stars: 3, forks: 0, visible: true },
    { id: "2", title: "Hidden", description: "Must not render.", techStack: [], githubUrl: "", liveUrl: "", stars: 0, forks: 0, visible: false },
  ],
  workExperience: [],
  education: [{ title: "B.Tech CSBS", organization: "Panimalar Engineering College", period: "2023 - 2027", description: "" }],
};

const themes: PortfolioTheme[] = ["bento", "editorial", "terminal", "studio", "mono"];

test("renders five complete, self-contained portfolio themes", () => {
  const pages = themes.map((theme) => renderPortfolioHtml(profile, theme));
  pages.forEach((page, index) => {
    assert.match(page, /<!doctype html>/i);
    assert.match(page, new RegExp(`<body class="${themes[index]}">`));
    assert.match(page, /@media \(max-width:767px\)/);
    assert.match(page, /prefers-reduced-motion/);
    assert.match(page, /Portrait of Abdullah R\./);
    assert.doesNotMatch(page, /Hidden|Must not render|—/);
  });
  assert.equal(new Set(pages).size, 5);
});

test("uses a gap-free responsive Bento project grid", () => {
  const projects = Array.from({ length: 6 }, (_, index) => ({
    id: String(index + 1),
    title: `Project ${index + 1}`,
    description: "A concise project description.",
    techStack: ["TypeScript"],
    githubUrl: `https://github.com/raiseabdullah7/project-${index + 1}`,
    liveUrl: "",
    stars: index,
    forks: 0,
    visible: true,
  }));
  const page = renderPortfolioHtml({ ...profile, featuredProjects: projects }, "bento");

  assert.match(page, /\.bento \.project:nth-child\(4n\+1\),\.bento \.project:nth-child\(4n\+4\)\{grid-column:span 7\}/);
  assert.match(page, /@media \(min-width:768px\) and \(max-width:959px\)/);
  assert.doesNotMatch(page, /grid-row:span 2/);
});

test("escapes profile content and rejects unsafe external URLs", () => {
  const page = renderPortfolioHtml({
    ...profile,
    fullName: '<script>alert("x")</script>',
    contactLinks: { ...profile.contactLinks, github: "javascript:alert(1)" },
  }, "mono");
  assert.doesNotMatch(page, /<script>/);
  assert.doesNotMatch(page, /javascript:/);
  assert.match(page, /&lt;script&gt;/);
});

test("does not render placeholder education rows or blank timeline metadata", () => {
  const page = renderPortfolioHtml({
    ...profile,
    workExperience: [{ title: "Python Development Intern", organization: "", period: "", description: "" }],
    education: [{ title: "Role", organization: "", period: "", description: "" }],
  }, "terminal");
  assert.match(page, /Python Development Intern/);
  assert.doesNotMatch(page, /<h2>Education<\/h2>|<h3>Role<\/h3>|class="organization"><\/p>|<time><\/time>/);
  assert.match(page, /class="partial"/);
});
