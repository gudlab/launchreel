/**
 * Puppeteer browser setup and management.
 */
import puppeteer, { type Browser, type Page } from "puppeteer";

export interface ViewportConfig {
  width: number;
  height: number;
  deviceScaleFactor: number;
}

export const DEFAULT_VIEWPORT: ViewportConfig = {
  width: 1440,
  height: 900,
  deviceScaleFactor: 2,
};

export interface BrowserOptions {
  headed?: boolean;
  viewport?: ViewportConfig;
}

/**
 * Launch a Puppeteer browser with standard recording settings.
 */
export async function launchBrowser(
  options: BrowserOptions = {},
): Promise<Browser> {
  return puppeteer.launch({
    headless: !options.headed,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--force-color-profile=srgb",
    ],
  });
}

/**
 * Create a new page with viewport and media feature settings.
 */
export async function createPage(
  browser: Browser,
  viewport?: ViewportConfig,
  theme: "light" | "dark" = "light",
): Promise<Page> {
  const page = await browser.newPage();
  const vp = viewport || DEFAULT_VIEWPORT;
  await page.setViewport(vp);
  await page.emulateMediaFeatures([
    { name: "prefers-color-scheme", value: theme },
  ]);
  return page;
}
