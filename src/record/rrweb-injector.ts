/**
 * rrweb session recording injection and event collection.
 */
import type { Page } from "puppeteer";
import { readFileSync } from "fs";
import { join } from "path";
import { log } from "../utils/logger.js";
import { createRequire } from "module";

let rrwebSource: string | null = null;

/**
 * Get the rrweb UMD source code (cached after first load).
 */
function getRrwebSource(): string {
  if (rrwebSource) return rrwebSource;

  // Try to find rrweb in node_modules
  const require = createRequire(import.meta.url);
  try {
    const rrwebPath = require.resolve("rrweb/dist/rrweb.umd.min.cjs");
    rrwebSource = readFileSync(rrwebPath, "utf8");
  } catch {
    // Fallback: try common paths
    const paths = [
      join(process.cwd(), "node_modules", "rrweb", "dist", "rrweb.umd.min.cjs"),
      join(import.meta.dirname || ".", "node_modules", "rrweb", "dist", "rrweb.umd.min.cjs"),
    ];
    for (const p of paths) {
      try {
        rrwebSource = readFileSync(p, "utf8");
        break;
      } catch {
        continue;
      }
    }
  }

  if (!rrwebSource) {
    throw new Error(
      "Could not find rrweb UMD bundle. Make sure rrweb is installed: npm install rrweb",
    );
  }

  return rrwebSource;
}

/**
 * Inject rrweb into a page and start recording DOM mutations.
 */
export async function startRecording(page: Page): Promise<boolean> {
  const src = getRrwebSource();
  await page.addScriptTag({ content: src });

  const started = await page.evaluate(() => {
    (window as any).__rrweb_events = [];
    const rrweb = (window as any).rrweb;
    if (!rrweb?.record) return false;

    rrweb.record({
      emit(event: any) {
        (window as any).__rrweb_events.push(event);
      },
      recordCanvas: false,
      inlineImages: true,
      collectFonts: true,
      inlineStylesheet: true,
    });
    return true;
  });

  if (!started) {
    log.error("Failed to start rrweb recording");
  } else {
    log.debug("rrweb recording started");
  }

  return started;
}

/**
 * Collect all recorded rrweb events from the page.
 */
export async function collectEvents(page: Page): Promise<any[]> {
  try {
    return await page.evaluate(() => (window as any).__rrweb_events || []);
  } catch {
    log.warn("Could not collect rrweb events (page may have navigated)");
    return [];
  }
}

/**
 * Check if rrweb is already injected and recording on this page.
 */
export async function isRecording(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(
      () => Array.isArray((window as any).__rrweb_events),
    );
  } catch {
    return false;
  }
}
