/**
 * Named screenshot capture.
 */
import type { Page } from "puppeteer";
import { join } from "path";
import { dismissCookies } from "./cookie-dismisser.js";
import { wait } from "../utils/wait.js";
import { log } from "../utils/logger.js";

/**
 * Take a named screenshot, dismissing cookie banners first.
 */
export async function captureScreenshot(
  page: Page,
  name: string,
  outputDir: string,
): Promise<string> {
  await dismissCookies(page);
  await wait(200);
  const filename = name.endsWith(".png") ? name : `${name}.png`;
  const path = join(outputDir, filename);
  await page.screenshot({ path });
  log.screenshot(filename);
  return path;
}
