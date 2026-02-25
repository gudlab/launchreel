#!/usr/bin/env node

/**
 * LaunchReel — Turn any website into launch videos and screenshots.
 *
 * Usage:
 *   launchreel study <url>      Crawl and analyze a website
 *   launchreel record [config]  Execute recording scenarios
 *   launchreel export [config]  Convert recordings to videos
 *   launchreel screenshot       Capture screenshots only
 *   launchreel auth <url>       Manual login → export cookies
 *   launchreel init [url]       Create starter config
 */

import { Command } from "commander";
import chalk from "chalk";
import { resolve } from "path";
import { writeFileSync, existsSync } from "fs";
import { loadEnv, log, setLogLevel, ensureOutputDirs, normalizeUrl } from "./utils/index.js";
import { loadConfig, getDefaultTemplate } from "./plan/index.js";
import { recordAll } from "./record/index.js";
import { exportAll } from "./export/index.js";
import { studySite } from "./study/index.js";

const program = new Command();

program
  .name("launchreel")
  .description("Turn any website into launch videos and screenshots")
  .version("0.0.2");

// ── study ──
program
  .command("study <url>")
  .description("Crawl and analyze a website, generate launchreel.yaml")
  .option("--max-pages <n>", "Maximum pages to crawl", "20")
  .option("--depth <n>", "Maximum crawl depth", "3")
  .option("--include <pattern>", "Only crawl URLs matching pattern")
  .option("--exclude <pattern>", "Skip URLs matching pattern")
  .option("--no-ai", "Skip AI analysis (crawl only)")
  .option(
    "--provider <name>",
    "LLM provider: claude, openai, ollama",
  )
  .option("--api-key <key>", "API key for the LLM provider")
  .option("--model <name>", "Model name to use")
  .option("-o, --output <dir>", "Output directory", ".")
  .option("-v, --verbose", "Verbose logging")
  .action(async (rawUrl, opts) => {
    if (opts.verbose) setLogLevel("debug");
    loadEnv();
    const url = normalizeUrl(rawUrl);

    try {
      await studySite(url, {
        maxPages: parseInt(opts.maxPages),
        maxDepth: parseInt(opts.depth),
        include: opts.include,
        exclude: opts.exclude,
        noAi: opts.ai === false,
        provider: opts.provider,
        apiKey: opts.apiKey,
        model: opts.model,
        outputConfig: opts.output,
      });
    } catch (err) {
      log.error((err as Error).message);
      process.exit(1);
    }
  });

// ── record ──
program
  .command("record [config]")
  .description("Execute recording scenarios from YAML config")
  .option("-o, --output <dir>", "Output directory", "launchreel-output")
  .option("--scenario <id>", "Record only a specific scenario")
  .option("--headed", "Show browser during recording")
  .option("--env-file <path>", "Path to .env file")
  .option("-v, --verbose", "Verbose logging")
  .action(async (configFile, opts) => {
    if (opts.verbose) setLogLevel("debug");
    loadEnv(opts.envFile);

    const configPath = resolve(configFile || "launchreel.yaml");
    if (!existsSync(configPath)) {
      log.error(`Config not found: ${configPath}`);
      log.info('Run "launchreel study <url>" or "launchreel init" first');
      process.exit(1);
    }

    try {
      const config = loadConfig(configPath);
      const paths = ensureOutputDirs(opts.output);

      await recordAll(config, paths, {
        headed: opts.headed,
        scenarioId: opts.scenario,
      });

      log.info("\nRecording complete. Run 'launchreel export' to generate videos.");
    } catch (err) {
      log.error((err as Error).message);
      process.exit(1);
    }
  });

// ── export ──
program
  .command("export [config]")
  .description("Convert rrweb recordings to MP4 videos")
  .option("-o, --output <dir>", "Output directory", "launchreel-output")
  .option("--fps <n>", "Video frame rate", "24")
  .option("--crf <n>", "Video quality (lower = better)", "18")
  .option("--no-combine", "Skip combined video generation")
  .option("-v, --verbose", "Verbose logging")
  .action(async (configFile, opts) => {
    if (opts.verbose) setLogLevel("debug");

    const configPath = resolve(configFile || "launchreel.yaml");
    if (!existsSync(configPath)) {
      log.error(`Config not found: ${configPath}`);
      process.exit(1);
    }

    try {
      const config = loadConfig(configPath);

      // Override export settings from CLI
      if (opts.fps) {
        config.export = config.export || {};
        config.export.videos = config.export.videos || {} as any;
        (config.export.videos as any).fps = parseInt(opts.fps);
      }
      if (opts.crf) {
        config.export = config.export || {};
        config.export.videos = config.export.videos || {} as any;
        (config.export.videos as any).crf = parseInt(opts.crf);
      }
      if (opts.combine === false) {
        config.export = config.export || {};
        config.export.combined_video = { enabled: false, name: "" };
      }

      const paths = ensureOutputDirs(opts.output);
      await exportAll(config, paths);
    } catch (err) {
      log.error((err as Error).message);
      process.exit(1);
    }
  });

// ── screenshot ──
program
  .command("screenshot [config]")
  .description("Capture screenshots only (no video recording)")
  .option("-o, --output <dir>", "Output directory", "launchreel-output")
  .option("--headed", "Show browser during capture")
  .option("--env-file <path>", "Path to .env file")
  .option("-v, --verbose", "Verbose logging")
  .action(async (configFile, opts) => {
    if (opts.verbose) setLogLevel("debug");
    loadEnv(opts.envFile);

    const configPath = resolve(configFile || "launchreel.yaml");
    if (!existsSync(configPath)) {
      log.error(`Config not found: ${configPath}`);
      process.exit(1);
    }

    try {
      const config = loadConfig(configPath);
      // Force all scenarios to screenshot-only
      for (const scenario of config.scenarios) {
        scenario.type = "screenshot";
      }
      const paths = ensureOutputDirs(opts.output);
      await recordAll(config, paths, { headed: opts.headed });
    } catch (err) {
      log.error((err as Error).message);
      process.exit(1);
    }
  });

// ── auth ──
program
  .command("auth <url>")
  .description("Open browser for manual login, export cookies")
  .option("-o, --output <path>", "Output cookie file", "cookies.json")
  .action(async (rawUrl, opts) => {
    const url = normalizeUrl(rawUrl);
    log.header("LaunchReel — Manual Authentication");
    log.info(`Opening ${url} in a browser window...`);
    log.info("Log in manually, then press Ctrl+C to export cookies.\n");

    const { launchBrowser, createPage } = await import("./record/browser.js");
    const browser = await launchBrowser({ headed: true });
    const page = await createPage(browser);
    await page.goto(url, { waitUntil: "networkidle2" });

    // Wait for user to log in and press Ctrl+C
    const cleanup = async () => {
      log.step("Exporting cookies...");
      const cookies = await page.cookies();
      writeFileSync(opts.output, JSON.stringify(cookies, null, 2));
      log.success(`Cookies saved: ${opts.output}`);
      log.info(
        "Add to your config:\n  auth:\n    type: cookie\n    cookie_file: " +
          opts.output,
      );
      await browser.close();
      process.exit(0);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    // Keep alive
    await new Promise(() => {}); // Wait forever until Ctrl+C
  });

// ── init ──
program
  .command("init [url]")
  .description("Create a starter launchreel.yaml in current directory")
  .action(async (rawUrl) => {
    const url = rawUrl ? normalizeUrl(rawUrl) : undefined;
    const configPath = resolve("launchreel.yaml");
    if (existsSync(configPath)) {
      log.warn("launchreel.yaml already exists. Skipping.");
      return;
    }

    const template = getDefaultTemplate(url);
    writeFileSync(configPath, template);
    log.success(`Created: ${configPath}`);
    log.info("Edit the config, then run: launchreel record");
  });

// ── Parse and run ──
program.parse();

// Show help if no command
if (!process.argv.slice(2).length) {
  console.log(
    chalk.bold("\n  LaunchReel") +
      chalk.dim(" — Turn any website into launch videos\n"),
  );
  program.outputHelp();
}
