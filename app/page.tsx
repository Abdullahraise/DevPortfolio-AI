"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft, ArrowUpRight, Check, Code2, Copy, Download, ExternalLink,
  FileText, Globe2, KeyRound, Monitor, PanelLeft, RefreshCw, Send,
  Smartphone, Sparkles, Tablet, UploadCloud, WandSparkles, X,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast, Toaster } from "sonner";
import type { GenerateResponse, PortfolioProfile } from "./types";
import { renderPortfolioHtml } from "../lib/portfolio-template";

type ThemeName = "bento" | "editorial" | "terminal" | "studio" | "mono";
type DeviceName = "desktop" | "tablet" | "mobile";

const loadingSteps = [
  "Analyzing GitHub repositories",
  "Extracting facts from your résumé",
  "Writing your professional profile",
];
const themeOptions: { value: ThemeName; name: string; note: string }[] = [
  { value: "bento", name: "Bento", note: "Product-led, asymmetric grid" },
  { value: "editorial", name: "Editorial", note: "Reading-first case studies" },
  { value: "terminal", name: "Terminal", note: "Technical, restrained retro" },
  { value: "studio", name: "Studio", note: "Bold project presentation" },
  { value: "mono", name: "Mono", note: "Stark, type-led minimalism" },
];
const devices: { value: DeviceName; label: string; Icon: typeof Monitor }[] = [
  { value: "desktop", label: "Desktop", Icon: Monitor },
  { value: "tablet", label: "Tablet", Icon: Tablet },
  { value: "mobile", label: "Mobile", Icon: Smartphone },
];

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok || data.error)
    throw new Error(data.error || "The request could not be completed.");
  return data;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character,
  );
}

function safeUrl(value: string) {
  return /^https:\/\//i.test(value) ? escapeHtml(value) : "";
}

function portfolioHtml(profile: PortfolioProfile, theme: ThemeName) {
  return renderPortfolioHtml(profile, theme);
  /* Legacy renderer retained temporarily below for source compatibility. */
  const projects = profile.featuredProjects.filter((project) => project.visible);
  const skills = Object.entries(profile.skills).filter(([, items]) => items.length);
  const links = [
    profile.contactLinks.github && ["GitHub", safeUrl(profile.contactLinks.github)],
    profile.contactLinks.linkedin && ["LinkedIn", safeUrl(profile.contactLinks.linkedin)],
    profile.contactLinks.email && ["Email", `mailto:${escapeHtml(profile.contactLinks.email)}`],
  ].filter((item): item is string[] => Boolean(item && item[1]));
  const projectMarkup = projects.map((project) => `<article class="project"><div class="project-head"><h3>${escapeHtml(project.title)}</h3><span>${project.stars ? `${project.stars} stars` : "Selected project"}</span></div><p>${escapeHtml(project.description)}</p><div class="tags">${project.techStack.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div><div class="actions">${safeUrl(project.githubUrl) ? `<a href="${safeUrl(project.githubUrl)}">Source</a>` : ""}${safeUrl(project.liveUrl) ? `<a href="${safeUrl(project.liveUrl)}">Live demo</a>` : ""}</div></article>`).join("");
  const timeline = (title: string, items: PortfolioProfile["workExperience"]) => items.length ? `<section class="timeline"><h2>${title}</h2>${items.map((item) => `<article><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.organization)}</p></div><time>${escapeHtml(item.period)}</time>${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}</article>`).join("")}</section>` : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(profile.fullName)} | Portfolio</title><meta name="description" content="${escapeHtml(profile.headline)}"><style>
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font:16px/1.65 ui-sans-serif,system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--text)}a{color:inherit;min-height:44px;display:inline-flex;align-items:center;text-underline-offset:4px}.page{width:min(1120px,calc(100% - 36px));margin:auto}nav{min-height:72px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:20px}.name{font-weight:800;letter-spacing:-.03em}.links{display:flex;gap:18px;flex-wrap:wrap}.hero{padding:72px 0 56px;display:grid;gap:20px}.hero h1{font-size:clamp(2.4rem,7vw,5rem);line-height:1;letter-spacing:-.06em;margin:0;max-width:920px}.hero p{font-size:clamp(1rem,2vw,1.2rem);color:var(--muted);max-width:720px;margin:0}.location{font-size:14px;color:var(--accent);font-weight:700}.work{padding:24px 0 72px}.work>h2,.skills>h2,.timeline>h2{font-size:14px;text-transform:uppercase;letter-spacing:.12em;margin:0 0 20px;color:var(--muted)}.projects{display:grid;gap:16px}.project{border:1px solid var(--line);padding:24px;background:var(--surface)}.project-head{display:flex;justify-content:space-between;gap:20px;align-items:start}.project h3,.timeline h3{font-size:1.25rem;letter-spacing:-.03em;margin:0}.project-head>span{font-size:13px;color:var(--muted)}.project p,.timeline p{color:var(--muted);margin:12px 0}.tags{display:flex;flex-wrap:wrap;gap:7px}.tags span{border:1px solid var(--line);padding:5px 9px;font:12px ui-monospace,monospace}.actions{display:flex;gap:18px;margin-top:14px;font-weight:700}.skills{padding:0 0 72px}.skill-grid{display:grid;gap:12px}.skill-group{border-top:1px solid var(--line);padding:18px 0;display:grid;gap:10px}.skill-group h3{margin:0;font-size:1rem}.skill-group p{margin:0;color:var(--muted)}.timeline{padding:0 0 72px}.timeline article{border-top:1px solid var(--line);padding:20px 0;display:grid;gap:8px}.timeline article>div p{margin:2px 0}.timeline time{color:var(--accent);font:13px ui-monospace,monospace}footer{border-top:1px solid var(--line);padding:28px 0 48px;color:var(--muted)}
body.bento{--bg:#0b0f17;--surface:#111824;--text:#f5f7fb;--muted:#9aa6b8;--line:#29364a;--accent:#63d6aa}.bento .projects{grid-template-columns:repeat(2,1fr)}.bento .project:first-child{grid-column:1/-1;padding:34px}.bento .skill-grid{grid-template-columns:repeat(2,1fr)}
body.editorial{--bg:#f4f0e8;--surface:transparent;--text:#181713;--muted:#656158;--line:#bbb4a6;--accent:#8b3028}.editorial .hero h1,.editorial .project h3{font-family:Georgia,serif}.editorial .projects{gap:0}.editorial .project{border-width:1px 0 0;padding:30px 0}.editorial .hero{grid-template-columns:2fr 1fr;align-items:end}.editorial .hero p{font-family:Georgia,serif}
body.terminal{--bg:#07110c;--surface:#0b1911;--text:#c9f6d5;--muted:#76a986;--line:#244e31;--accent:#e3b74f;font-family:ui-monospace,monospace}.terminal .hero h1{font-size:clamp(2.2rem,6vw,4.4rem);letter-spacing:-.04em}.terminal .project{border-left:4px solid var(--accent)}
body.studio{--bg:#111323;--surface:#191d34;--text:#f7f7fb;--muted:#aeb5d2;--line:#363d63;--accent:#5f86dd}.studio .hero{min-height:520px;align-content:end}.studio .project{padding:32px}.studio .projects{grid-template-columns:repeat(2,1fr)}.studio .project:nth-child(3n+1){grid-column:1/-1}.studio .project h3{font-size:clamp(1.4rem,3vw,2.2rem)}
body.mono{--bg:#fff;--surface:#fff;--text:#111;--muted:#5f5f5f;--line:#bdbdbd;--accent:#111}.mono .page{width:min(980px,calc(100% - 36px))}.mono .hero{grid-template-columns:1fr 2fr;align-items:start}.mono .hero h1{font-size:clamp(2.3rem,6vw,4.2rem)}.mono .project{border-width:1px 0 0;padding:24px 0}.mono .projects{gap:0}
@media(min-width:768px){.skill-group{grid-template-columns:220px 1fr}.timeline article{grid-template-columns:1fr auto}.timeline article>p{grid-column:1/-1}}
@media(max-width:767px){nav{align-items:flex-start;padding:14px 0}.links{gap:10px}.hero{padding:52px 0 42px}.bento .projects,.bento .skill-grid,.studio .projects,.editorial .hero,.mono .hero{grid-template-columns:1fr}.bento .project:first-child,.studio .project:nth-child(3n+1){grid-column:auto}.project{padding:20px}.project-head{display:block}.project-head>span{display:block;margin-top:6px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{transition:none!important;animation:none!important}}a:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
</style></head><body class="${theme}"><div class="page"><nav><span class="name">${escapeHtml(profile.fullName)}</span><div class="links">${links.map(([label,url]) => `<a href="${url}">${label}</a>`).join("")}</div></nav><main><section class="hero"><div><span class="location">${escapeHtml(profile.location || "Developer portfolio")}</span><h1>${escapeHtml(profile.headline)}</h1></div><p>${escapeHtml(profile.bio)}</p></section><section class="work"><h2>Selected work</h2><div class="projects">${projectMarkup || "<p>No public projects selected.</p>"}</div></section>${skills.length ? `<section class="skills"><h2>Capabilities</h2><div class="skill-grid">${skills.map(([group,items]) => `<div class="skill-group"><h3>${escapeHtml(group)}</h3><p>${items.map(escapeHtml).join(" / ")}</p></div>`).join("")}</div></section>` : ""}${timeline("Experience",profile.workExperience)}${timeline("Education",profile.education)}</main><footer>Portfolio of ${escapeHtml(profile.fullName)}.</footer></div></body></html>`;
}

export default function Home() {
  const [github, setGithub] = useState("");
  const [resume, setResume] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [profile, setProfile] = useState<PortfolioProfile | null>(null);
  const [theme, setTheme] = useState<ThemeName>("bento");
  const [device, setDevice] = useState<DeviceName>("desktop");
  const [panelOpen, setPanelOpen] = useState(true);
  const [publishOpen, setPublishOpen] = useState(false);
  const [repository, setRepository] = useState("");
  const [publishToken, setPublishToken] = useState("");
  const [publishConsent, setPublishConsent] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!loading) return;
    const timer = window.setInterval(
      () => setLoadingStep((step) => Math.min(step + 1, loadingSteps.length - 1)),
      1700,
    );
    return () => window.clearInterval(timer);
  }, [loading]);

  const validateFile = (file: File) => {
    if (file.type !== "application/pdf") {
      setError("Please choose a PDF résumé.");
      return false;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Résumé PDF must be 5 MB or smaller.");
      return false;
    }
    setError("");
    setResume(file);
    return true;
  };

  const generate = async () => {
    if (!github.trim()) return setError("Enter your GitHub username or profile URL.");
    if (!resume) return setError("Upload your résumé as a PDF.");
    setLoading(true);
    setLoadingStep(0);
    setError("");
    try {
      const form = new FormData();
      form.append("github", github);
      form.append("resume", resume);
      const response = await fetch("/api/generate", { method: "POST", body: form });
      const data = await readJson<GenerateResponse>(response);
      setResult(data);
      setProfile(data.profile);
      if (data.notices.length)
        toast.message("Portfolio generated", { description: data.notices[0] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Portfolio generation failed.");
    } finally {
      setLoading(false);
    }
  };

  const chooseTheme = (value: string) => {
    setTheme(value as ThemeName);
    setPublishedUrl("");
  };

  const updateProfile = (key: "headline" | "bio", value: string) => {
    setProfile((current) => current ? { ...current, [key]: value } : current);
    setPublishedUrl("");
  };
  const updateContact = (key: "linkedin" | "email", value: string) => {
    setProfile((current) => current
      ? { ...current, contactLinks: { ...current.contactLinks, [key]: value } }
      : current);
    setPublishedUrl("");
  };
  const toggleProject = (id: string, visible: boolean) => {
    setProfile((current) => current ? {
      ...current,
      featuredProjects: current.featuredProjects.map((project) =>
        project.id === id ? { ...project, visible } : project),
    } : current);
    setPublishedUrl("");
  };

  const source = useMemo(
    () => profile ? portfolioHtml(profile, theme) : "",
    [profile, theme],
  );

  const download = () => {
    if (!profile || !source) return;
    const url = URL.createObjectURL(new Blob([source], { type: "text/html" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${profile.fullName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "portfolio"}.html`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Portfolio source downloaded");
  };

  const share = async () => {
    if (!publishedUrl) return setPublishOpen(true);
    const shareData = {
      title: `${profile?.fullName || "Developer"} - Portfolio`,
      text: `View ${profile?.fullName || "this developer"}'s portfolio.`,
      url: publishedUrl,
    };
    if (navigator.share) await navigator.share(shareData);
    else {
      await navigator.clipboard.writeText(publishedUrl);
      toast.success("Published link copied");
    }
  };
  const copyEmbed = async () => {
    if (!publishedUrl) return setPublishOpen(true);
    await navigator.clipboard.writeText(
      `<iframe src="${publishedUrl}" title="${profile?.fullName || "Developer"} portfolio" width="100%" height="720" loading="lazy" style="border:0"></iframe>`,
    );
    toast.success("Embed code copied");
  };

  const publish = async () => {
    if (!source || publishing) return;
    setPublishing(true);
    try {
      const response = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: publishToken, repository, html: source, consent: publishConsent,
        }),
      });
      const data = await readJson<{ deploymentUrl: string; message: string }>(response);
      setPublishedUrl(data.deploymentUrl);
      setPublishToken("");
      setPublishOpen(false);
      toast.success("Portfolio sent to GitHub Pages", { description: data.message });
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Publishing failed.");
    } finally {
      setPublishing(false);
    }
  };

  if (!profile) return (
    <main className="landing-shell">
      <Toaster theme="dark" position="top-center" />
      <nav className="topbar">
        <a className="brand" href="#">
          <span className="brand-icon"><Code2 size={18} /></span>
          <span>DevPortfolio <b>AI</b></span>
        </a>
        <span className="build-label">GitHub + résumé</span>
      </nav>
      <section className="landing-grid">
        <div className="landing-copy">
          <motion.span initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="eyebrow">
            <Sparkles size={14} /> Built from evidence, designed by AI
          </motion.span>
          <motion.h1 initial={reduceMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            Your work deserves more than a template.
          </motion.h1>
          <motion.p initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.16 }}>
            Turn verified GitHub projects and résumé details into a bespoke portfolio you can refine, publish, and own.
          </motion.p>
        </div>
        <motion.div initial={reduceMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="generator-card">
          <div className="generator-head"><h2>Start with your work</h2></div>
          <label className="field-label" htmlFor="github">GitHub profile</label>
          <div className="input-wrap">
            <Code2 size={18} />
            <input id="github" value={github} onChange={(event) => setGithub(event.target.value)} placeholder="username or github.com/username" autoComplete="off" />
          </div>
          <label className="field-label">Résumé PDF</label>
          <button
            type="button"
            className={`dropzone ${dragging ? "dragging" : ""} ${resume ? "has-file" : ""}`}
            onClick={() => fileInput.current?.click()}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const file = event.dataTransfer.files[0];
              if (file) validateFile(file);
            }}
          >
            <input ref={fileInput} type="file" accept="application/pdf,.pdf" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) validateFile(file);
            }} hidden />
            <span className="upload-icon">{resume ? <FileText size={22} /> : <UploadCloud size={22} />}</span>
            <span>
              <strong>{resume ? resume.name : "Drop your résumé here"}</strong>
              <small>{resume ? `${(resume.size / 1024 / 1024).toFixed(2)} MB, click to replace` : "or click to browse, PDF up to 5 MB"}</small>
            </span>
            {resume && <Check className="file-check" size={18} />}
          </button>
          {error && <div className="form-error" role="alert"><X size={15} />{error}</div>}
          <button className="generate-button" onClick={generate} disabled={loading}>
            {loading ? <><RefreshCw className="spin" size={18} /> Building your portfolio</> : <><WandSparkles size={18} /> Generate website <ArrowUpRight size={17} /></>}
          </button>
          <p className="privacy-note">Your PDF is processed for this request and is not stored.</p>
        </motion.div>
      </section>
      <AnimatePresence>{loading && (
        <motion.div className="loading-overlay" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="loading-card" initial={reduceMotion ? false : { scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }}>
            <div className="loading-symbol"><Code2 size={24} /></div>
            <span className="loading-count">0{loadingStep + 1} / 03</span>
            <h2>{loadingSteps[loadingStep]}<span className="dots">...</span></h2>
            <div className="loading-progress"><span style={{ width: `${((loadingStep + 1) / 3) * 100}%` }} /></div>
            <div className="loading-skeletons"><Skeleton className="h-3 w-3/4" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-2/3" /></div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
      <footer className="landing-footer"><span>DevPortfolio AI</span><span>Generate, refine, publish</span></footer>
    </main>
  );

  return (
    <main className="workspace-shell">
      <Toaster theme="dark" position="top-center" />
      <header className="workspace-topbar">
        <div className="workspace-left">
          <button className="icon-button" aria-label="Back to generator" onClick={() => { setProfile(null); setResult(null); }}><ArrowLeft size={18} /></button>
          <a className="brand" href="#"><span className="brand-icon"><Code2 size={18} /></span><span>DevPortfolio <b>AI</b></span></a>
          <span className="saved-state"><Check size={13} /> {publishedUrl ? "Published" : "Draft"}</span>
        </div>
        <div className="workspace-actions">
          <button onClick={() => publishedUrl ? window.open(publishedUrl, "_blank", "noopener,noreferrer") : setPublishOpen(true)}><Globe2 size={16} /> {publishedUrl ? "View live" : "Publish"}</button>
          <button onClick={share} title={publishedUrl ? "Share published portfolio" : "Publish first"}><Send size={16} /> Share</button>
          <button onClick={copyEmbed} title={publishedUrl ? "Copy portfolio embed" : "Publish first"}><Copy size={16} /> Embed</button>
          <button className="download-button" onClick={download}><Download size={16} /> Download</button>
        </div>
      </header>
      {result?.notices.length ? <div className="notice-strip"><Sparkles size={14} /><span>{result.notices[0]}</span></div> : null}
      <div className={`workspace-body ${panelOpen ? "" : "panel-closed"}`}>
        <aside className="customizer-panel">
          <div className="panel-heading">
            <div><span>Customizer</span><small>Changes update instantly</small></div>
            <button className="icon-button" onClick={() => setPanelOpen(false)} aria-label="Close customizer"><PanelLeft size={17} /></button>
          </div>
          <div className="panel-section">
            <label>Starting direction</label>
            <Tabs value={theme} onValueChange={chooseTheme}>
              <TabsList className="theme-tabs">{themeOptions.map((option) => <TabsTrigger key={option.value} value={option.value}>{option.name}</TabsTrigger>)}</TabsList>
            </Tabs>
            <p className="theme-note">{themeOptions.find((option) => option.value === theme)?.note}</p>
          </div>
          <div className="panel-section"><label htmlFor="headline">Headline</label><textarea id="headline" value={profile.headline} onChange={(event) => updateProfile("headline", event.target.value)} maxLength={72} /><small>{profile.headline.length}/72</small></div>
          <div className="panel-section"><label htmlFor="bio">Bio</label><textarea id="bio" className="bio-input" value={profile.bio} onChange={(event) => updateProfile("bio", event.target.value)} maxLength={500} /><small>{profile.bio.length}/500</small></div>
          <div className="panel-section">
            <label>Featured projects</label>
            <div className="project-toggles">{profile.featuredProjects.map((project) => <div key={project.id}><span><strong>{project.title}</strong><small>{project.techStack.slice(0, 2).join(", ") || "GitHub project"}</small></span><Switch checked={project.visible} onCheckedChange={(checked) => toggleProject(project.id, checked)} aria-label={`Show ${project.title}`} /></div>)}</div>
          </div>
          <div className="panel-section"><label htmlFor="linkedin">LinkedIn URL</label><input id="linkedin" value={profile.contactLinks.linkedin} onChange={(event) => updateContact("linkedin", event.target.value)} placeholder="https://linkedin.com/in/..." /></div>
          <div className="panel-section"><label htmlFor="email">Contact email</label><input id="email" value={profile.contactLinks.email} onChange={(event) => updateContact("email", event.target.value)} placeholder="you@example.com" /></div>
          <div className="panel-section profile-sync-note"><p>Gemini shaped the content. These controls update the tested website immediately without another API call.</p></div>
        </aside>
        <section className="preview-workspace">
          <div className="preview-toolbar">
            <div className="device-switcher">{devices.map(({ value, label, Icon }) => <button key={value} onClick={() => setDevice(value)} className={device === value ? "active" : ""} aria-label={label}><Icon size={16} /><span>{label}</span></button>)}</div>
            <div className="preview-status"><span /> Live preview</div>
          </div>
          {!panelOpen && <button className="open-panel" onClick={() => setPanelOpen(true)}><PanelLeft size={16} /> Customize</button>}
          <div className="preview-stage">
            <motion.div layout={!reduceMotion} className={`device-frame device-${device}`}>
              <div className="browser-chrome"><span /><span /><span /><div>{publishedUrl || `${profile.fullName.toLowerCase().replace(/\s+/g, "")}.dev`}</div>{publishedUrl && <a href={publishedUrl} target="_blank" rel="noreferrer" aria-label="Open published portfolio"><ExternalLink size={13} /></a>}</div>
              <div className="preview-scroll">
                <iframe title={`${profile.fullName} portfolio preview`} srcDoc={source} sandbox="" />
              </div>
            </motion.div>
          </div>
        </section>
      </div>
      <Dialog open={publishOpen} onOpenChange={(open) => { if (!publishing) setPublishOpen(open); }}>
        <DialogContent className="publish-dialog">
          <DialogHeader>
            <DialogTitle>Publish to your GitHub Pages</DialogTitle>
            <DialogDescription>Create a new public repository first. DevPortfolio AI will add only <code>index.html</code> and enable Pages.</DialogDescription>
          </DialogHeader>
          <div className="publish-warning"><KeyRound size={18} /><p>Use either a classic PAT with the <strong>repo</strong> scope or a fine-grained token with <strong>Contents: Read and write</strong> and <strong>Pages: Read and write</strong>. The token is used for this request only and is never stored.</p></div>
          <label htmlFor="repository">Repository</label>
          <input id="repository" value={repository} onChange={(event) => setRepository(event.target.value)} placeholder="username/portfolio" autoComplete="off" />
          <label htmlFor="publish-token">GitHub personal access token</label>
          <input id="publish-token" type="password" value={publishToken} onChange={(event) => setPublishToken(event.target.value)} placeholder="ghp_... or github_pat_..." autoComplete="off" />
          <label className="consent-row"><input type="checkbox" checked={publishConsent} onChange={(event) => setPublishConsent(event.target.checked)} /><span>I understand this repository and portfolio will be public.</span></label>
          <p className="token-aftercare">Revoke the temporary token after publishing. GitHub may take a few minutes to make the page live.</p>
          <DialogFooter>
            <button className="secondary-dialog-button" onClick={() => setPublishOpen(false)} disabled={publishing}>Cancel</button>
            <button className="primary-dialog-button" onClick={publish} disabled={publishing || !publishConsent}>{publishing ? <><RefreshCw className="spin" size={15} /> Publishing</> : <><Globe2 size={15} /> Publish portfolio</>}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
