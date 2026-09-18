const MAX_PDF_BYTES = 5 * 1024 * 1024;

const SKILLS: Record<string, string[]> = {
  Languages: [
    "JavaScript", "TypeScript", "Python", "Java", "C++", "C#", "Go", "Rust",
    "PHP", "Ruby", "Kotlin", "Swift", "SQL",
  ],
  Frameworks: [
    "React", "Next.js", "Angular", "Vue", "Express", "Node.js", "Spring Boot",
    "Django", "Flask", ".NET", "Tailwind CSS",
  ],
  "Cloud / DevOps": [
    "AWS", "Azure", "Google Cloud", "Docker", "Kubernetes", "Terraform",
    "GitHub Actions", "Jenkins",
  ],
  Tools: [
    "Git", "GitHub", "PostgreSQL", "MySQL", "MongoDB", "Redis", "Figma",
    "Postman",
  ],
};

export const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function skillMatches(
  text: string,
  languageCounts: Map<string, number>,
) {
  const result: Record<string, string[]> = {};
  for (const [category, values] of Object.entries(SKILLS)) {
    result[category] = values.filter((skill) => {
      const pattern = new RegExp(
        `(^|[^A-Za-z0-9])${escapeRegex(skill)}([^A-Za-z0-9]|$)`,
        "i",
      );
      return pattern.test(text) || languageCounts.has(skill.toLowerCase());
    });
  }
  for (const [language] of [...languageCounts.entries()].sort(
    (a, b) => b[1] - a[1],
  )) {
    if (
      !Object.values(result)
        .flat()
        .some((item) => item.toLowerCase() === language)
    ) {
      result.Languages.push(
        language.replace(/\b\w/g, (letter) => letter.toUpperCase()),
      );
    }
  }
  return result;
}

export function extractEmail(text: string) {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
}

export function extractLinkedIn(text: string) {
  const match = text.match(
    /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+\/?/i,
  )?.[0];
  return match ? (match.startsWith("http") ? match : `https://${match}`) : "";
}

export async function extractPdf(file: File, notices: string[]) {
  if (file.type !== "application/pdf")
    throw new Error("Please upload a PDF resume.");
  if (file.size > MAX_PDF_BYTES)
    throw new Error("Resume PDF must be 5 MB or smaller.");
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(
      new Uint8Array(await file.arrayBuffer()),
    );
    const result = await extractText(pdf, { mergePages: true });
    const text = result.text.trim();
    if (text.length < 40) {
      notices.push(
        "This PDF appears scanned or contains very little selectable text. GitHub data was used as the primary source.",
      );
      return "";
    }
    return text.slice(0, 30000);
  } catch {
    notices.push(
      "We could not read this resume safely. The portfolio was generated from GitHub data instead.",
    );
    return "";
  }
}
