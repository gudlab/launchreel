/**
 * AI-powered scenario generation from site study results.
 */
import { stringify as toYaml } from "yaml";
import { log } from "../utils/logger.js";
import type { LLMProvider } from "../study/ai-analyzer.js";
import type { StudyResult, PageInfo } from "../study/crawler.js";

/**
 * Generate a launchreel.yaml config from study results using an LLM.
 */
export async function generateScenarios(
  studyResult: StudyResult,
  provider: LLMProvider,
): Promise<string> {
  log.step("Generating recording scenarios...");

  const pagesContext = studyResult.pages
    .map(
      (p) =>
        `Page: ${p.url}\n  Title: ${p.title}\n  Headings: ${p.headings.join(", ")}\n  Sections: ${p.sections.join(", ")}\n  Interactive: ${p.interactive.join(", ")}\n  Has forms: ${p.hasForms}\n  Scroll height: ~${p.estimatedScrollHeight}px`,
    )
    .join("\n\n");

  const prompt = `You are helping create a Product Hunt launch video for a web application.

Given the following analysis of the site at ${studyResult.baseUrl}, generate a launchreel.yaml config file that will produce compelling launch screenshots and demo videos.

SITE ANALYSIS:
${pagesContext}

REQUIREMENTS:
1. Create 2-5 scenarios that tell a compelling story: hook → features → proof → CTA
2. Each scenario should have a mix of screenshots, scrolling, hovering, and waiting
3. For pages that require scrolling, use smooth scroll actions with appropriate durations
4. Take screenshots at key visual moments (hero, features, pricing cards, etc.)
5. Include appropriate wait times for content to load (1500-2000ms after navigation)
6. Use dismiss_cookies as the first action on each page
7. Use realistic scroll distances based on the estimated scroll heights
8. Include hover actions over cards/features for visual interest in videos

OUTPUT: Return ONLY valid YAML content for a launchreel.yaml file. No explanations or markdown fences.
The YAML must follow this schema:

project:
  name: "<product name from site>"
  url: "${studyResult.baseUrl}"
  viewport: { width: 1440, height: 900, deviceScaleFactor: 2 }
  theme: "light"

scenarios:
  - id: "<short-id>"
    name: "<Human readable name>"
    type: "screenshot+video"
    page: "<path>"
    actions:
      - dismiss_cookies: true
      - wait: 2000
      - screenshot: { name: "<nn-descriptive-name>" }
      - scroll: { to: <pixels>, duration: <ms> }
      ...

export:
  videos: { format: "mp4", fps: 24, crf: 18 }
  combined_video: { enabled: true, name: "launch-reel.mp4" }`;

  const yamlContent = await provider.analyze(prompt, pagesContext);

  // Clean up any markdown fences the LLM might have added
  let cleaned = yamlContent
    .replace(/^```ya?ml\n?/m, "")
    .replace(/\n?```$/m, "")
    .trim();

  // Validate it's parseable YAML
  try {
    const { parse } = await import("yaml");
    parse(cleaned);
  } catch (err) {
    log.warn(`AI-generated YAML has issues: ${(err as Error).message}`);
    log.info("Falling back to default template");
    return generateDefaultScenarios(studyResult);
  }

  return cleaned;
}

/**
 * Generate a basic scenario config without AI.
 */
export function generateDefaultScenarios(studyResult: StudyResult): string {
  const scenarios = studyResult.pages.map((page, i) => {
    const id = page.url === "/"
      ? "homepage"
      : page.url.replace(/^\//, "").replace(/\//g, "-") || `page-${i}`;

    const actions: Record<string, any>[] = [
      { dismiss_cookies: true },
      { wait: 2000 },
      { screenshot: { name: `${String(i + 1).padStart(2, "0")}-${id}` } },
    ];

    // Add scrolling if page has content
    if (page.estimatedScrollHeight > 1000) {
      const scrollPoints = [
        Math.round(page.estimatedScrollHeight * 0.25),
        Math.round(page.estimatedScrollHeight * 0.5),
        Math.round(page.estimatedScrollHeight * 0.75),
      ];

      for (const point of scrollPoints) {
        actions.push({ scroll: { to: point, duration: 1500 } });
        actions.push({ wait: 1000 });
      }
    }

    return {
      id,
      name: page.title || id,
      type: "screenshot+video" as const,
      page: page.url,
      actions,
    };
  });

  const config = {
    project: {
      name: studyResult.siteName || "Website Launch",
      url: studyResult.baseUrl,
      viewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
      theme: "light",
    },
    scenarios,
    export: {
      videos: { format: "mp4", fps: 24, crf: 18 },
      combined_video: { enabled: true, name: "launch-reel.mp4" },
    },
  };

  return toYaml(config, { lineWidth: 120 });
}
