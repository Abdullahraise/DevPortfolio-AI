import assert from "node:assert/strict";
import { test } from "node:test";
import {
  escapeRegex,
  extractEmail,
  extractLinkedIn,
  extractPdf,
  skillMatches,
} from "../app/api/generate/extraction.ts";
import {
  classifyGeminiFailure,
  cleanTimeline,
  headlineForTarget,
  POST,
} from "../app/api/generate/route.ts";

function buildTestPdf() {
  const content =
    "BT /F1 12 Tf 72 720 Td (Arun Kumar C++ C# .NET arun@example.com linkedin.com/in/arun-kumar) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf);
}

test("escapes regex metacharacters and detects punctuation-heavy skills", () => {
  assert.equal(escapeRegex("C++"), "C\\+\\+");
  assert.equal(escapeRegex(".NET"), "\\.NET");
  const skills = skillMatches(
    "Built APIs with C++, C#, and .NET. Used GitHub Actions.",
    new Map(),
  );
  assert.deepEqual(skills.Languages, ["C++", "C#"]);
  assert.ok(skills.Frameworks.includes(".NET"));
  assert.ok(skills["Cloud / DevOps"].includes("GitHub Actions"));
});

test("extracts contact details safely", () => {
  const text = "arun@example.com linkedin.com/in/arun-kumar";
  assert.equal(extractEmail(text), "arun@example.com");
  assert.equal(
    extractLinkedIn(text),
    "https://linkedin.com/in/arun-kumar",
  );
});

test("extracts selectable text from a PDF resume", async () => {
  const bytes = buildTestPdf();
  const file = new File([bytes], "resume.pdf", { type: "application/pdf" });
  const notices: string[] = [];
  const text = await extractPdf(file, notices);
  assert.match(text, /Arun Kumar/);
  assert.match(text, /C\+\+/);
  assert.deepEqual(notices, []);
});

test("rejects non-PDF files before parsing", async () => {
  const file = new File(["not a pdf"], "resume.txt", { type: "text/plain" });
  await assert.rejects(() => extractPdf(file, []), /upload a PDF resume/i);
});

test("requires a Gemini API key through the complete API route", async () => {
  const previous = process.env.DEVPORTFOLIO_DISABLE_EXTERNAL_FETCH;
  process.env.DEVPORTFOLIO_DISABLE_EXTERNAL_FETCH = "true";
  try {
    const form = new FormData();
    form.set("github", "arun-kumar");
    form.set(
      "resume",
      new File([buildTestPdf()], "resume.pdf", { type: "application/pdf" }),
    );
    const response = await POST(
      new Request("http://localhost/api/generate", {
        method: "POST",
        body: form,
      }),
    );
    const result = (await response.json()) as {
      usedAi: boolean;
      profile: { skills: Record<string, string[]> };
      notices: string[];
    };
    assert.equal(response.status, 503);
    assert.match((result as { error?: string }).error ?? "", /Gemini API key/i);
  } finally {
    if (previous === undefined)
      delete process.env.DEVPORTFOLIO_DISABLE_EXTERNAL_FETCH;
    else process.env.DEVPORTFOLIO_DISABLE_EXTERNAL_FETCH = previous;
  }
});

test("classifies Gemini failures without exposing provider details", () => {
  assert.equal(classifyGeminiFailure(new Error("429 RESOURCE_EXHAUSTED quota exceeded")).category, "quota");
  assert.equal(classifyGeminiFailure(new Error("API_KEY_INVALID")).category, "authentication");
  assert.equal(classifyGeminiFailure(new Error("model not found")).category, "model");
  assert.equal(classifyGeminiFailure(new Error("network failure")).category, "temporary");
});

test("uses a concise target role as the generated headline", () => {
  assert.equal(
    headlineForTarget(
      "Forward Deployed Engineer",
      "Python & Html Developer",
      "Software Developer",
    ),
    "Forward Deployed Engineer",
  );
  assert.equal(
    headlineForTarget(
      "We are looking for an engineer who will own customer deployments and integrations across our platform.",
      "Integration Engineer",
      "Software Developer",
    ),
    "Integration Engineer",
  );
});

test("removes placeholder timeline rows while preserving real partial entries", () => {
  assert.deepEqual(
    cleanTimeline([
      { title: "Role", organization: "", period: "", description: "" },
      { title: "Python Development Intern", organization: "CodSoft", period: "Jun 2025 - Jul 2025", description: "Built Python utilities." },
      { title: "Event Director", organization: "Tech Club", period: "2025", description: "" },
      { title: "Event Director", organization: "Tech Club", period: "2025", description: "duplicate" },
      { title: "", organization: "Panimalar Engineering College", period: "2024 - 2028", description: "" },
    ]),
    [
      { title: "Python Development Intern", organization: "CodSoft", period: "Jun 2025 - Jul 2025", description: "Built Python utilities." },
      { title: "Event Director", organization: "Tech Club", period: "2025", description: "" },
    ],
  );
});
