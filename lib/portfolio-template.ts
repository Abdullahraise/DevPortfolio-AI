import type { PortfolioProfile } from "../app/types";

export type PortfolioTheme = "bento" | "editorial" | "terminal" | "studio" | "mono";

function text(value: string) {
  return value
    .replaceAll("—", "-")
    .replaceAll("–", "-")
    .replace(/[&<>'"]/g, (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character,
    );
}

function url(value: string) {
  return /^https:\/\//i.test(value) ? text(value) : "";
}

function conciseBio(value: string) {
  const normalized = value.replaceAll("—", "-").replaceAll("–", "-").trim();
  const sentence = normalized.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() || normalized;
  const words = sentence.split(/\s+/);
  return text(words.length > 20 ? `${words.slice(0, 20).join(" ")}.` : sentence);
}

function externalLink(href: string, label: string, className = "") {
  return href
    ? `<a class="${className}" href="${href}" target="_blank" rel="noopener noreferrer">${label}<span aria-hidden="true">↗</span></a>`
    : "";
}

export function renderPortfolioHtml(profile: PortfolioProfile, theme: PortfolioTheme) {
  const projects = profile.featuredProjects.filter((project) => project.visible);
  const skillGroups = Object.entries(profile.skills).filter(([, items]) => items.length);
  const github = url(profile.contactLinks.github);
  const linkedin = url(profile.contactLinks.linkedin);
  const email = profile.contactLinks.email ? `mailto:${text(profile.contactLinks.email)}` : "";
  const avatar = url(profile.avatarUrl);
  const headlineClass = profile.headline.length > 72 ? "headline long" : profile.headline.length > 48 ? "headline medium" : "headline";
  const initials = text(profile.fullName.split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase());

  const portrait = avatar
    ? `<figure class="portrait"><img src="${avatar}" alt="Portrait of ${text(profile.fullName)}" width="520" height="520"></figure>`
    : `<div class="portrait portrait-fallback" aria-label="${text(profile.fullName)} initials"><span>${initials}</span></div>`;

  const navigation = `<header class="site-header"><a class="wordmark" href="#top">${text(profile.fullName)}</a><nav aria-label="Portfolio navigation">${projects.length ? '<a href="#work">Work</a>' : ""}${skillGroups.length ? '<a href="#skills">Skills</a>' : ""}${externalLink(github, "GitHub")}${externalLink(linkedin, "LinkedIn")}${email ? `<a class="contact-link" href="${email}">Contact</a>` : ""}</nav></header>`;

  const projectCards = projects.map((project) => {
    const source = url(project.githubUrl);
    const live = url(project.liveUrl);
    return `<article class="project">
      <div class="project-top"><h3>${text(project.title)}</h3>${project.stars > 0 ? `<span class="proof">${project.stars} GitHub star${project.stars === 1 ? "" : "s"}</span>` : ""}</div>
      <p>${text(project.description)}</p>
      ${project.techStack.length ? `<ul class="tags" aria-label="Technologies">${project.techStack.map((item) => `<li>${text(item)}</li>`).join("")}</ul>` : ""}
      ${source || live ? `<div class="project-actions">${externalLink(live, "View project")}${externalLink(source, "Source code")}</div>` : ""}
    </article>`;
  }).join("");

  const skills = skillGroups.length
    ? `<section class="skills-section" id="skills"><div class="section-heading"><h2>Skills</h2><p>Technologies evidenced across the résumé and public work.</p></div><div class="skill-groups">${skillGroups.map(([group, items]) => `<article><h3>${text(group)}</h3><p>${items.map(text).join("<span>/</span>")}</p></article>`).join("")}</div></section>`
    : "";

  const timeline = (heading: string, items: PortfolioProfile["workExperience"]) => {
    const usableItems = items.filter((item) => item.title.trim() && !/^(role|position|degree|unknown|n\/?a)$/i.test(item.title.trim()));
    return usableItems.length
      ? `<section class="timeline-section"><div class="section-heading"><h2>${heading}</h2></div><div class="timeline">${usableItems.map((item) => {
          const hasDetails = Boolean(item.organization || item.period || item.description);
          return `<article class="${hasDetails ? "" : "partial"}"><div><h3>${text(item.title)}</h3>${item.organization ? `<p class="organization">${text(item.organization)}</p>` : ""}</div>${item.period ? `<time>${text(item.period)}</time>` : ""}${item.description ? `<p class="timeline-copy">${text(item.description)}</p>` : ""}</article>`;
        }).join("")}</div></section>`
      : "";
  };

  const heroBio = conciseBio(profile.bio);
  const hero = `<section class="hero" id="top"><div class="hero-copy">${profile.location ? `<p class="location">${text(profile.location)}</p>` : ""}<h1 class="${headlineClass}">${text(profile.headline)}</h1>${heroBio ? `<p class="bio">${heroBio}</p>` : ""}<div class="hero-actions">${externalLink(github, "View GitHub", "primary-action")}${email ? `<a class="text-action" href="${email}">Get in touch<span aria-hidden="true">↗</span></a>` : ""}</div></div>${portrait}</section>`;
  const work = projects.length
    ? `<section class="work-section" id="work"><div class="section-heading"><h2>Selected work</h2><p>${projects.length} project${projects.length === 1 ? "" : "s"} chosen for relevance and evidence.</p></div><div class="projects">${projectCards}</div></section>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="${text(profile.headline)}">
  <meta name="color-scheme" content="${theme === "editorial" || theme === "mono" ? "light" : "dark"}">
  <title>${text(profile.fullName)} | Portfolio</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%2311161f'/%3E%3Cpath d='M25 20 13 32l12 12M39 20l12 12-12 12' fill='none' stroke='%2365d6aa' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E">
  <style>
    :root{--max:1160px;--pad:clamp(20px,4vw,56px);--radius:18px}
    *{box-sizing:border-box}
    html{scroll-behavior:smooth;background:var(--bg);overflow-x:clip}
    body{margin:0;background:var(--bg);color:var(--text);font:16px/1.65 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-rendering:optimizeLegibility;overflow-x:clip}
    img{display:block;max-width:100%}
    a{color:inherit;text-underline-offset:5px;text-decoration-thickness:1px}
    a:focus-visible{outline:3px solid var(--accent);outline-offset:4px;border-radius:3px}
    .shell{width:min(var(--max),calc(100% - (var(--pad) * 2)));margin-inline:auto}
    .site-header{min-height:78px;display:flex;align-items:center;justify-content:space-between;gap:28px;border-bottom:1px solid var(--line)}
    .wordmark{font-weight:800;letter-spacing:-.035em;text-decoration:none}
    nav{display:flex;align-items:center;justify-content:flex-end;gap:clamp(12px,2.4vw,28px);flex-wrap:wrap}
    nav a{min-height:44px;display:inline-flex;align-items:center;gap:5px;font-size:14px;font-weight:650;text-decoration:none}
    nav a:hover,.text-action:hover,.project-actions a:hover{text-decoration:underline}
    .hero{min-height:min(720px,calc(100dvh - 78px));padding-block:clamp(56px,8vw,92px);display:grid;grid-template-columns:minmax(0,1.35fr) minmax(260px,.65fr);align-items:center;gap:clamp(38px,8vw,104px)}
    .hero-copy{min-width:0}
    .location{margin:0 0 18px;color:var(--accent);font:700 13px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.06em}
    h1{max-width:850px;margin:0;font-size:clamp(2.65rem,6.4vw,5.6rem);line-height:.98;letter-spacing:-.065em;text-wrap:balance}
    h1.medium{font-size:clamp(2.55rem,5.7vw,4.8rem)}
    h1.long{max-width:17ch;font-size:clamp(2.4rem,4.8vw,4rem)}
    .bio{max-width:650px;margin:26px 0 0;color:var(--muted);font-size:clamp(1rem,1.5vw,1.18rem);line-height:1.7}
    .hero-actions{display:flex;align-items:center;gap:22px;margin-top:32px;flex-wrap:wrap}
    .hero-actions a,.project-actions a{min-height:44px;display:inline-flex;align-items:center;gap:8px;font-weight:750}
    .primary-action{padding:0 18px;background:var(--accent);color:var(--accent-ink);text-decoration:none;border:1px solid var(--accent)}
    .primary-action:hover{filter:brightness(1.06)}
    .text-action{text-decoration:none}
    .portrait{margin:0;position:relative;justify-self:end;width:min(100%,390px);aspect-ratio:4/5;overflow:hidden;background:var(--surface-strong)}
    .portrait img{width:100%;height:100%;object-fit:cover;filter:var(--portrait-filter)}
    .portrait-fallback{display:grid;place-items:center}
    .portrait-fallback span{font-size:clamp(4rem,12vw,8rem);font-weight:850;letter-spacing:-.1em;color:var(--accent)}
    .section-heading{display:grid;grid-template-columns:minmax(0,1fr) minmax(240px,420px);align-items:end;gap:32px;margin-bottom:30px}
    .section-heading h2{margin:0;font-size:clamp(1.8rem,4vw,3.4rem);line-height:1;letter-spacing:-.05em}
    .section-heading p{margin:0;color:var(--muted);max-width:48ch}
    .work-section,.skills-section,.timeline-section{padding-block:clamp(72px,10vw,120px);border-top:1px solid var(--line)}
    .timeline-section+.timeline-section{padding-top:0}
    .projects{display:grid;gap:18px}
    .project{min-width:0;padding:clamp(22px,3vw,34px);background:var(--surface);border:1px solid var(--line);transition:transform .22s ease,border-color .22s ease}
    .project:hover{transform:translateY(-3px);border-color:var(--accent)}
    .project-top{display:flex;align-items:start;justify-content:space-between;gap:20px}
    .project h3,.timeline h3{margin:0;font-size:clamp(1.25rem,2.2vw,1.8rem);line-height:1.15;letter-spacing:-.035em}
    .project>p{max-width:64ch;margin:18px 0;color:var(--muted)}
    .proof{flex:none;color:var(--muted);font:600 12px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace}
    .tags{list-style:none;display:flex;flex-wrap:wrap;gap:7px;padding:0;margin:0}
    .tags li{padding:5px 9px;border:1px solid var(--line);font:600 12px/1.35 ui-monospace,SFMono-Regular,Consolas,monospace}
    .project-actions{display:flex;gap:22px;flex-wrap:wrap;margin-top:22px}
    .project-actions a{font-size:14px;text-decoration:none}
    .skill-groups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px 48px}
    .skill-groups article{padding-top:20px;border-top:1px solid var(--line)}
    .skill-groups h3{margin:0 0 10px;font-size:16px}
    .skill-groups p{margin:0;color:var(--muted)}
    .skill-groups p span{margin-inline:9px;color:var(--line)}
    .timeline{display:grid}
    .timeline article{padding:26px 0;border-bottom:1px solid var(--line);display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 28px}
    .timeline article.partial{padding-block:18px}
    .organization,.timeline-copy{margin:6px 0 0;color:var(--muted)}
    .timeline time{font:600 13px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--accent)}
    .timeline-copy{grid-column:1/-1;max-width:68ch}
    .site-footer{min-height:120px;border-top:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:20px;color:var(--muted)}
    .site-footer a{min-height:44px;display:inline-flex;align-items:center}
    .empty{color:var(--muted)}

    body.bento{--bg:#0c1017;--surface:#121a25;--surface-strong:#182638;--text:#f2f5f8;--muted:#9ba8b8;--line:#293648;--accent:#69d3ad;--accent-ink:#07110d;--portrait-filter:saturate(.82) contrast(1.04)}
    .bento .projects{grid-template-columns:repeat(12,minmax(0,1fr))}
    .bento .project{grid-column:span 5;border-radius:var(--radius)}
    .bento .project:first-child{grid-column:span 7;grid-row:span 2;background:#17283a}
    .bento .project:nth-child(3n){background:#151d28}
    .bento .portrait{border-radius:calc(var(--radius) + 8px);transform:rotate(1.5deg);box-shadow:18px 18px 0 #17283a}
    .bento .primary-action{border-radius:9px}

    body.editorial{--bg:#f3f1ec;--surface:transparent;--surface-strong:#d8d6cf;--text:#191a1c;--muted:#5d6064;--line:#b9b9b5;--accent:#a13931;--accent-ink:#fff;--portrait-filter:grayscale(1) contrast(1.08);font-family:Arial,Helvetica,sans-serif}
    .editorial h1,.editorial .section-heading h2,.editorial .project h3{font-family:Georgia,"Times New Roman",serif;font-weight:500}
    .editorial .hero{grid-template-columns:minmax(0,.65fr) minmax(0,1.35fr)}
    .editorial .hero-copy{grid-column:2;grid-row:1}
    .editorial .portrait{grid-column:1;grid-row:1;justify-self:start;width:min(100%,350px);aspect-ratio:3/4}
    .editorial .projects{gap:0}
    .editorial .project{padding:34px 0;border-width:1px 0 0;background:transparent;display:grid;grid-template-columns:minmax(220px,.65fr) minmax(0,1.35fr);gap:26px 52px}
    .editorial .project:hover{transform:none;border-color:var(--text)}
    .editorial .project-top{display:block}
    .editorial .project>p{margin:0}
    .editorial .tags,.editorial .project-actions{grid-column:2}
    .editorial .primary-action{border-radius:0}

    body.terminal{--bg:#07110c;--surface:#0b1911;--surface-strong:#102318;--text:#c9f2d3;--muted:#79a486;--line:#244b30;--accent:#e0b85a;--accent-ink:#111006;--portrait-filter:grayscale(.25) sepia(.22);font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
    .terminal .wordmark:before{content:"~/";color:var(--accent)}
    .terminal h1{font-size:clamp(2.35rem,5.5vw,4.7rem);letter-spacing:-.045em}
    .terminal .portrait{aspect-ratio:1;border:1px solid var(--line);padding:12px}
    .terminal .portrait img{border:1px solid var(--line)}
    .terminal .project{border-width:0 0 0 3px;border-color:var(--accent)}
    .terminal .project:hover{transform:translateX(4px)}
    .terminal .tags li{border-radius:0}
    .terminal .primary-action{border-radius:0}

    body.studio{--bg:#111420;--surface:#1a2031;--surface-strong:#27344e;--text:#f6f4ef;--muted:#adb5c7;--line:#333c50;--accent:#e06549;--accent-ink:#160a07;--portrait-filter:saturate(.72) contrast(1.12)}
    .studio .hero{grid-template-columns:minmax(0,1fr) minmax(360px,.9fr);min-height:760px}
    .studio .portrait{width:100%;max-width:470px;aspect-ratio:3/4}
    .studio .portrait:after{content:"";position:absolute;inset:auto 0 0;height:9px;background:var(--accent)}
    .studio .projects{grid-template-columns:repeat(2,minmax(0,1fr));gap:22px}
    .studio .project{min-height:360px;display:flex;flex-direction:column;justify-content:space-between}
    .studio .project:first-child{grid-column:1/-1;min-height:430px;background:#252f45}
    .studio .project h3{font-size:clamp(1.6rem,4vw,3.2rem);max-width:14ch}
    .studio .primary-action{border-radius:999px;padding-inline:22px}

    body.mono{--bg:#f7f7f5;--surface:transparent;--surface-strong:#dededb;--text:#151515;--muted:#60605d;--line:#b8b8b3;--accent:#151515;--accent-ink:#fff;--portrait-filter:grayscale(1) contrast(1.12)}
    .mono .shell{width:min(1020px,calc(100% - (var(--pad) * 2)))}
    .mono .hero{grid-template-columns:minmax(0,1.5fr) 220px;min-height:600px}
    .mono .portrait{width:220px;aspect-ratio:1;border-radius:50%}
    .mono .projects{gap:0}
    .mono .project{padding:30px 0;border-width:1px 0 0;background:transparent;display:grid;grid-template-columns:minmax(220px,.75fr) minmax(0,1.25fr);gap:18px 46px}
    .mono .project:hover{transform:none;border-color:var(--text)}
    .mono .project>p{margin:0}
    .mono .tags,.mono .project-actions{grid-column:2}
    .mono .primary-action{border-radius:0}

    body h1.medium{max-width:19ch;font-size:clamp(2.25rem,4vw,3.5rem)}
    body h1.long{max-width:none;font-size:2rem;line-height:1.08;letter-spacing:-.04em}

    @media (prefers-reduced-motion:no-preference){
      .hero-copy,.portrait{animation:enter .55s ease both}
      .portrait{animation-delay:.08s}
      @keyframes enter{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
      .bento .portrait{animation-name:bento-enter}
      @keyframes bento-enter{from{opacity:0;transform:translateY(14px) rotate(1.5deg)}to{opacity:1;transform:rotate(1.5deg)}}
    }
    @media (max-width:767px){
      :root{--pad:20px}
      .site-header{align-items:flex-start;padding-block:14px}
      nav{gap:8px 14px}
      nav>a[href="#skills"]{display:none}
      .hero,.editorial .hero,.studio .hero,.mono .hero{min-height:auto;grid-template-columns:1fr;padding-block:52px;gap:36px}
      .editorial .hero-copy,.editorial .portrait{grid-column:auto;grid-row:auto}
      .hero-copy{order:1}.portrait{order:2;justify-self:start;width:min(82vw,340px)}
      h1{font-size:clamp(2.5rem,12vw,4.1rem);line-height:1.02}
      body h1.medium{font-size:clamp(2.25rem,10vw,3.35rem)}
      body h1.long{font-size:clamp(1.9rem,8.5vw,2.55rem);line-height:1.08}
      .section-heading{grid-template-columns:1fr;gap:12px}
      .bento .projects,.studio .projects{grid-template-columns:1fr}
      .bento .project,.bento .project:first-child,.studio .project:first-child{grid-column:auto;grid-row:auto}
      .studio .project,.studio .project:first-child{min-height:auto}
      .editorial .project,.mono .project{grid-template-columns:1fr;gap:14px}
      .editorial .tags,.editorial .project-actions,.mono .tags,.mono .project-actions{grid-column:auto}
      .skill-groups{grid-template-columns:1fr}
      .timeline article{grid-template-columns:1fr}.timeline-copy{grid-column:auto}
      .site-footer{align-items:flex-start;flex-direction:column;justify-content:center;padding-block:26px}
    }
    @media (max-width:480px){
      .wordmark{max-width:130px}
      nav>a[href="#work"],nav>a[target="_blank"]{display:none}
      .hero-actions{align-items:stretch;flex-direction:column;gap:8px}
      .hero-actions a{justify-content:center;width:100%}
      .project-top{display:block}.proof{display:block;margin-top:8px}
      .project{padding:22px}
      .editorial .project,.mono .project{padding:24px 0}
    }
    @media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}.project{transition:none}.project:hover{transform:none}}
  </style>
</head>
<body class="${theme}">
  <div class="shell">
    ${navigation}
    <main>${hero}${work}${skills}${timeline("Experience", profile.workExperience)}${timeline("Education", profile.education)}</main>
    <footer class="site-footer"><span>${text(profile.fullName)}</span>${email ? `<a href="${email}">${text(profile.contactLinks.email)}</a>` : ""}</footer>
  </div>
</body>
</html>`;
}
