/**
 * Main recording orchestrator.
 * Executes all scenarios from a config file.
 */
import { writeFileSync } from "fs";
import { join } from "path";
import type { LaunchReelConfig, ScenarioConfig } from "../plan/config-schema.js";
import {
  launchBrowser,
  createPage,
  type ViewportConfig,
} from "./browser.js";
import { startRecording, collectEvents } from "./rrweb-injector.js";
import { authenticate } from "./auth-handler.js";
import { dismissCookies } from "./cookie-dismisser.js";
import { switchToTheme } from "./theme-handler.js";
import { executeActions } from "./action-executor.js";
import { wait } from "../utils/wait.js";
import { log } from "../utils/logger.js";
import type { OutputPaths } from "../utils/paths.js";
import type { Page, Browser } from "puppeteer";

export interface RecordingResult {
  scenarioId: string;
  scenarioName: string;
  events: any[];
  eventCount: number;
  screenshots: string[];
  success: boolean;
  error?: string;
}

/**
 * Record all scenarios defined in the config.
 */
export async function recordAll(
  config: LaunchReelConfig,
  paths: OutputPaths,
  options: { headed?: boolean; scenarioId?: string } = {},
): Promise<RecordingResult[]> {
  const baseUrl = config.project.url.replace(/\/$/, "");
  const viewport: ViewportConfig = config.project.viewport || {
    width: 1440,
    height: 900,
    deviceScaleFactor: 2,
  };
  const theme = config.project.theme || "light";

  log.header("LaunchReel — Recording");
  log.info(`URL: ${baseUrl}`);
  log.info(`Viewport: ${viewport.width}x${viewport.height} @${viewport.deviceScaleFactor}x`);
  log.info(`Theme: ${theme}`);

  const browser = await launchBrowser({ headed: options.headed, viewport });
  const page = await createPage(browser, viewport, theme as "light" | "dark");

  const results: RecordingResult[] = [];

  try {
    // Authenticate if needed
    if (config.auth && config.auth.type !== "none") {
      const authSuccess = await authenticate(page, baseUrl, config.auth);
      if (!authSuccess) {
        log.error("Authentication failed. Continuing with public pages only.");
      }
    }

    // Filter scenarios
    let scenarios = config.scenarios;
    if (options.scenarioId) {
      scenarios = scenarios.filter((s) => s.id === options.scenarioId);
      if (scenarios.length === 0) {
        log.error(`Scenario "${options.scenarioId}" not found`);
        await browser.close();
        return results;
      }
    }

    // Record each scenario
    for (const scenario of scenarios) {
      const result = await recordScenario(
        browser,
        page,
        scenario,
        baseUrl,
        viewport,
        theme,
        paths,
        config.auth,
      );
      results.push(result);

      // Save recording immediately
      if (result.events.length > 0) {
        const recordingPath = join(
          paths.recordings,
          `${scenario.id}.json`,
        );
        writeFileSync(recordingPath, JSON.stringify(result.events));
        const sizeMB = (
          Buffer.byteLength(JSON.stringify(result.events)) /
          1024 /
          1024
        ).toFixed(1);
        log.info(`Saved ${scenario.id}.json — ${result.eventCount} events (${sizeMB} MB)`);
      }
    }
  } finally {
    await browser.close();
  }

  // Summary
  log.header("Recording Summary");
  for (const r of results) {
    const status = r.success ? "✓" : "✗";
    log.info(
      `${status} ${r.scenarioName}: ${r.eventCount} events, ${r.screenshots.length} screenshots`,
    );
  }

  return results;
}

async function recordScenario(
  browser: Browser,
  page: Page,
  scenario: ScenarioConfig,
  baseUrl: string,
  viewport: ViewportConfig,
  theme: string,
  paths: OutputPaths,
  auth?: LaunchReelConfig["auth"],
): Promise<RecordingResult> {
  log.step(`Recording: ${scenario.name || scenario.id}`);

  const result: RecordingResult = {
    scenarioId: scenario.id,
    scenarioName: scenario.name || scenario.id,
    events: [],
    eventCount: 0,
    screenshots: [],
    success: false,
  };

  try {
    // Check if this scenario needs a new tab
    const useNewTab = scenario.new_tab === true;
    let scenarioPage: Page;

    if (useNewTab) {
      scenarioPage = await createPage(
        browser,
        viewport,
        theme as "light" | "dark",
      );
    } else {
      scenarioPage = page;
    }

    // Navigate to the scenario page
    if (scenario.page) {
      const pageUrl = scenario.page.startsWith("http")
        ? scenario.page
        : `${baseUrl}${scenario.page}`;
      await scenarioPage.goto(pageUrl, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      await wait(2000);
    }

    // Set theme
    if (theme === "light" || theme === "dark") {
      await switchToTheme(scenarioPage, theme as "light" | "dark");
    }
    await dismissCookies(scenarioPage);

    // Start rrweb recording if video is needed
    const needsVideo =
      scenario.type === "video" || scenario.type === "screenshot+video" || !scenario.type;
    if (needsVideo) {
      await startRecording(scenarioPage);
    }

    await wait(500);

    // Execute actions
    if (scenario.actions && scenario.actions.length > 0) {
      await executeActions(scenarioPage, scenario.actions, {
        screenshotDir: paths.screenshots,
        baseUrl,
      });
    }

    // Collect events
    if (needsVideo) {
      result.events = await collectEvents(scenarioPage);
      result.eventCount = result.events.length;
    }

    // Close tab if we opened a new one
    if (useNewTab) {
      await scenarioPage.close();
    }

    result.success = true;
    log.success(
      `${scenario.name || scenario.id}: ${result.eventCount} events captured`,
    );
  } catch (err) {
    result.error = (err as Error).message;
    log.error(
      `${scenario.name || scenario.id}: ${(err as Error).message}`,
    );
  }

  return result;
}
