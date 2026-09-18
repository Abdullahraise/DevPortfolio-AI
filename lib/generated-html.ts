import sanitizeHtml from "sanitize-html";

export const HTML_LIMIT = 180_000;
export const portfolioPolicy = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src https://avatars.githubusercontent.com; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

export function extractHtmlDocument(input: string): string {
  const start = input.search(/<!doctype\s+html|<html[\s>]/i);
  const closingTag = "</html>";
  const end = input.toLowerCase().lastIndexOf(closingTag);
  if (start < 0 || end < start)
    throw new Error("The generated page was incomplete. Please try again.");
  return input.slice(start, end + closingTag.length);
}

// Treat model output as untrusted. Preserve HTML/CSS design, not executable code.
export function cleanPortfolio(input: string): string {
  if (typeof input !== "string" || input.length > HTML_LIMIT || input.length < 100)
    throw new Error("The generated page was incomplete or too large. Please try again.");
  const raw = extractHtmlDocument(input);
  if (!/<html[\s>]/i.test(raw) || !/<\/html>/i.test(raw) || !/<\/body>/i.test(raw))
    throw new Error("The generated page was incomplete. Please try again.");
  const cleaned = sanitizeHtml(raw, {
    allowedTags: ["html", "head", "title", "body", "style", "main", "header", "footer", "nav", "section", "article", "aside", "div", "span", "h1", "h2", "h3", "h4", "p", "a", "ul", "ol", "li", "strong", "em", "b", "i", "small", "br", "hr", "code", "pre", "blockquote", "figure", "figcaption", "img", "details", "summary", "dl", "dt", "dd", "time"],
    allowedAttributes: { "*": ["id", "class", "style", "aria-label", "aria-labelledby", "role"], html: ["lang"], a: ["href", "target", "rel"], img: ["src", "alt", "width", "height", "loading"], time: ["datetime"] },
    allowedSchemes: ["https", "mailto"],
    allowProtocolRelative: false,
    allowVulnerableTags: true, // CSS is allowed, scripts are not; CSP blocks all CSS network loads.
    parseStyleAttributes: false,
    nonTextTags: ["script", "textarea", "option", "noscript", "iframe", "object", "template"],
    transformTags: {
      a: (_tag: string, attrs: Record<string, string>) => ({ tagName: "a", attribs: { ...attrs, target: "_blank", rel: "noopener noreferrer" } }),
      img: (_tag: string, attrs: Record<string, string>) => ({ tagName: "img", attribs: { ...attrs, src: /^https:\/\/avatars\.githubusercontent\.com\//.test(attrs.src || "") ? attrs.src : "", loading: "lazy" } }),
    },
  });
  if (!/<h1[\s>]/i.test(cleaned)) throw new Error("The generated page needs a main heading. Please try again.");
  return "<!doctype html>" + cleaned.replace(/<head[^>]*>/i, `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${portfolioPolicy}"><meta name="referrer" content="no-referrer">`);
}
