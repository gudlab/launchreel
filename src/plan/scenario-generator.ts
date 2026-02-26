/**
 * AI-powered scenario generation from site study results.
 */
import { stringify as toYaml } from "yaml";
import { writeFileSync } from "fs";
import { resolve } from "path";
import { log } from "../utils/logger.js";
import type { LLMProvider } from "../study/ai-analyzer.js";
import type { StudyResult, PageInfo } from "../study/crawler.js";

/**
 * Generate a launchreel.yaml config from study results using an LLM.
 * When an instruction is provided, generates task-driven scenarios;
 * otherwise generates generic launch-video scenarios.
 */
export async function generateScenarios(
  studyResult: StudyResult,
  provider: LLMProvider,
  instruction?: string,
): Promise<string> {
  log.step("Generating recording scenarios...");

  const pagesContext = studyResult.pages
    .map(
      (p) =>
        `Page: ${p.url}\n  Title: ${p.title}\n  Headings: ${p.headings.join(", ")}\n  Sections: ${p.sections.join(", ")}\n  Interactive: ${p.interactive.join(", ")}\n  Has forms: ${p.hasForms}\n  Scroll height: ~${p.estimatedScrollHeight}px`,
    )
    .join("\n\n");

  const prompt = instruction
    ? buildInstructionPrompt(studyResult, pagesContext, instruction)
    : buildLaunchVideoPrompt(studyResult, pagesContext);

  const rawResponse = await provider.analyze(prompt, pagesContext);

  // Save raw LLM response for debugging
  try {
    const rawPath = resolve("study-raw-response.txt");
    writeFileSync(rawPath, rawResponse);
    log.debug(`Raw LLM response saved: ${rawPath}`);
  } catch {
    // Non-critical, ignore
  }

  const cleaned = extractYaml(rawResponse);

  // Validate it's parseable YAML with required structure
  try {
    const { parse } = await import("yaml");
    const parsed = parse(cleaned);
    if (!parsed || !parsed.project || !parsed.scenarios) {
      throw new Error("Missing required 'project' or 'scenarios' keys");
    }
  } catch (err) {
    const preview = rawResponse.slice(0, 120).replace(/\n/g, " ").trim();
    log.warn(`AI response is not valid YAML config.`);
    log.warn(`Response starts with: "${preview}..."`);
    log.info(
      `Raw response saved to study-raw-response.txt for inspection.`,
    );
    log.info(
      `Tip: Try a different model (--model) or a larger model for better results.`,
    );
    log.info("Falling back to default template.");
    return generateDefaultScenarios(studyResult);
  }

  return cleaned;
}

/**
 * Extract YAML content from LLM response that may contain
 * preamble text, markdown fences, or trailing explanations.
 */
function extractYaml(raw: string): string {
  // 1. Try to extract from markdown fenced block
  const fenceMatch = raw.match(/```ya?ml\s*\n([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // 2. Try to find where the YAML actually starts (first "project:" line)
  const projectIndex = raw.search(/^project:/m);
  if (projectIndex > 0) {
    let yaml = raw.slice(projectIndex);
    // Trim any trailing non-YAML text after the last meaningful line
    const trailingText = yaml.search(/\n[A-Z][^\n:]{20,}/);
    if (trailingText > 0) {
      yaml = yaml.slice(0, trailingText);
    }
    return yaml.trim();
  }

  // 3. Strip any leading non-YAML lines (text that doesn't look like YAML)
  const lines = raw.split("\n");
  const yamlStart = lines.findIndex(
    (l) => /^\s*\w[\w-]*:/.test(l) && !l.includes("http"),
  );
  if (yamlStart > 0) {
    return lines.slice(yamlStart).join("\n").replace(/\n?```\s*$/, "").trim();
  }

  // 4. Fallback: strip markdown fences and return as-is
  return raw
    .replace(/^```ya?ml\n?/m, "")
    .replace(/\n?```$/m, "")
    .trim();
}

/**
 * Build prompt for generic Product Hunt launch video scenarios.
 */
function buildLaunchVideoPrompt(
  studyResult: StudyResult,
  pagesContext: string,
): string {
  return `You are helping create a Product Hunt launch video for a web application.

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
}

/**
 * Build prompt for instruction-driven task scenarios.
 * Includes the full action reference so the LLM can use
 * clicks, form fills, navigation, etc. to accomplish the task.
 */
function buildInstructionPrompt(
  studyResult: StudyResult,
  pagesContext: string,
  instruction: string,
): string {
  return `You are helping create a guided demo video for a web application by following specific task instructions.

The user wants to record a demo that performs the following task:
"${instruction}"

Given the site analysis below, generate a launchreel.yaml config that creates scenarios to accomplish this task step by step.

SITE: ${studyResult.baseUrl}

SITE ANALYSIS (crawled pages and their elements):
${pagesContext}

INSTRUCTIONS FOR SCENARIO GENERATION:
1. Break the user's task into logical scenarios (one per major step or page transition)
2. Each scenario should navigate to the appropriate page and perform the actions described
3. Use the crawled page data to determine which pages contain the relevant UI elements
4. For form interactions, use fill_form, fill_textarea, clear_and_type, or type actions with realistic placeholder data
5. For navigation between pages, use the navigate action or click on navigation links
6. For button clicks, prefer click with text matching (e.g. click: { text: "Save" }) over CSS selectors
7. Include wait actions (1500-2000ms) after navigation and form submissions for content to load
8. Take screenshots at key moments: before and after important actions
9. Use dismiss_cookies as the first action in the first scenario
10. Include scroll actions when content is below the fold
11. If the task mentions viewing or showing something, scroll through the relevant content slowly
12. Name each scenario after the task step it performs (e.g. "Sign up for account", "Update availability")

AVAILABLE ACTIONS (use these in the actions array):
- wait: <ms>                                           # Pause for milliseconds
- scroll: { to: <pixels>, duration: <ms> }             # Smooth scroll to Y position
- hover: { x: <px>, y: <px> }                          # Move mouse to coordinates
- click: { text: "<visible text>" }                    # Click element by visible text
- click: { selector: "<css selector>" }                # Click element by CSS selector
- type: { selector: "<css>", text: "<value>" }         # Type into an input field
- clear_and_type: { selector: "<css>", text: "<value>" } # Clear field then type
- fill_form: { text: "<value>" }                       # Fill first visible text input
- fill_textarea: { text: "<value>" }                   # Fill first visible textarea
- screenshot: { name: "<descriptive-name>" }           # Capture a named screenshot
- dismiss_cookies: true                                # Dismiss cookie banners
- press_key: "<key>"                                   # Press keyboard key (Enter, Tab, Escape, etc.)
- navigate: { url: "<path or full url>" }              # Go to a URL
- wait_for_url: { contains: "<pattern>" }              # Wait until URL contains string
- wait_for_selector: { selector: "<css>" }             # Wait for element to appear
- hover_cards: { selector: "<css>", delay: <ms> }      # Hover over multiple elements sequentially
- set_theme: "light" | "dark"                          # Switch light/dark theme
- evaluate: "<javascript code>"                        # Run JS in the page
- disable_animations: true                             # Disable all CSS animations
- finish_animations: true                              # Force animations to end state

OUTPUT: Return ONLY valid YAML content for a launchreel.yaml file. No explanations or markdown fences.
The YAML must follow this schema:

project:
  name: "<product name from site>"
  url: "${studyResult.baseUrl}"
  viewport: { width: 1440, height: 900, deviceScaleFactor: 2 }
  theme: "light"

scenarios:
  - id: "<short-id>"
    name: "<Human readable name describing this step>"
    type: "screenshot+video"
    page: "<starting path for this scenario>"
    actions:
      - dismiss_cookies: true
      - wait: 2000
      - screenshot: { name: "<nn-descriptive-name>" }
      ...

export:
  videos: { format: "mp4", fps: 24, crf: 18 }
  combined_video: { enabled: true, name: "demo-recording.mp4" }`;
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
