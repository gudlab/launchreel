/**
 * Main study orchestrator.
 * Crawls a site, optionally analyzes with AI, and generates a config.
 */
import { writeFileSync } from "fs";
import { resolve } from "path";
import { crawlSite, type CrawlOptions } from "./crawler.js";
import { createProvider, type LLMProvider } from "./ai-analyzer.js";
import {
  generateScenarios,
  generateDefaultScenarios,
} from "../plan/scenario-generator.js";
import { log } from "../utils/logger.js";

export interface StudyOptions {
  maxPages?: number;
  maxDepth?: number;
  include?: string;
  exclude?: string;
  noAi?: boolean;
  provider?: string;
  apiKey?: string;
  model?: string;
  outputConfig?: string;
  instruction?: string;
}

/**
 * Study a website and generate a launchreel.yaml config.
 */
export async function studySite(
  url: string,
  options: StudyOptions = {},
): Promise<string> {
  log.header("LaunchReel — Study");
  log.info(`Target: ${url}`);
  if (options.instruction) {
    log.info(`Instruction: ${options.instruction}`);
  }

  // Crawl the site
  const crawlOpts: Partial<CrawlOptions> = {
    maxPages: options.maxPages || 20,
    maxDepth: options.maxDepth || 3,
  };
  if (options.include) crawlOpts.include = new RegExp(options.include);
  if (options.exclude) crawlOpts.exclude = new RegExp(options.exclude);

  const studyResult = await crawlSite(url, crawlOpts);

  log.success(
    `Discovered ${studyResult.pages.length} pages, ${studyResult.allLinks.length} total links`,
  );

  // Save raw study data
  const studyDataPath = resolve(options.outputConfig || ".", "study.json");
  writeFileSync(studyDataPath, JSON.stringify(studyResult, null, 2));
  log.info(`Study data saved: ${studyDataPath}`);

  // Generate scenarios
  let yamlContent: string;

  if (!options.noAi) {
    try {
      const providerName = options.provider || detectAvailableProvider();
      log.step(`Analyzing with ${providerName}...`);
      const provider = createProvider(
        providerName,
        options.apiKey,
        options.model,
      );
      yamlContent = await generateScenarios(studyResult, provider, options.instruction);
    } catch (err) {
      log.warn(
        `AI analysis failed: ${(err as Error).message}. Using default template.`,
      );
      yamlContent = generateDefaultScenarios(studyResult);
    }
  } else {
    log.info("Skipping AI analysis (--no-ai)");
    yamlContent = generateDefaultScenarios(studyResult);
  }

  // Write config
  const configPath = resolve(
    options.outputConfig || ".",
    "launchreel.yaml",
  );
  writeFileSync(configPath, yamlContent);

  log.success(`Config generated: ${configPath}`);
  log.info("Review and edit the config, then run: launchreel record");

  return configPath;
}

/**
 * Auto-detect which LLM provider is available based on env vars.
 */
function detectAvailableProvider(): string {
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  if (process.env.OPENAI_API_KEY) return "openai";
  // Default to ollama (local, no API key needed)
  return "ollama";
}
