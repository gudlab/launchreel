/**
 * Light/dark theme detection and switching.
 */
import type { Page } from "puppeteer";
import { wait } from "../utils/wait.js";
import { log } from "../utils/logger.js";

/**
 * Force light theme via DOM manipulation (works for most sites).
 */
export async function forceLightTheme(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.setItem("theme", "light");
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");
    document.documentElement.style.colorScheme = "light";
  });
}

/**
 * Force dark theme via DOM manipulation.
 */
export async function forceDarkTheme(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.setItem("theme", "dark");
    document.documentElement.classList.remove("light");
    document.documentElement.classList.add("dark");
    document.documentElement.style.colorScheme = "dark";
  });
}

/**
 * Try to switch theme via a UI toggle button (common in modern apps).
 * Falls back to direct DOM manipulation.
 */
export async function switchToTheme(
  page: Page,
  theme: "light" | "dark",
): Promise<void> {
  // Try finding a theme toggle button with sr-only "Toggle theme" text
  const clicked = await page.evaluate((targetTheme: string) => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const themeBtn = buttons.find((btn) => {
      const srText = btn.querySelector(".sr-only");
      return srText?.textContent?.includes("Toggle theme");
    });
    if (themeBtn) {
      themeBtn.click();
      return true;
    }
    return false;
  }, theme);

  if (clicked) {
    await wait(500);
    // Look for the theme option in a dropdown
    await page.evaluate((targetTheme: string) => {
      const items = Array.from(
        document.querySelectorAll(
          '[role="menuitem"], [role="menuitemradio"], [role="option"]',
        ),
      );
      const themeItem = items.find(
        (el) => el.textContent?.trim().toLowerCase() === targetTheme,
      );
      if (themeItem) (themeItem as HTMLElement).click();
    }, theme);
    await wait(500);
    log.info(`Switched to ${theme} theme via toggle`);
  } else {
    // Fallback to direct manipulation
    if (theme === "light") {
      await forceLightTheme(page);
    } else {
      await forceDarkTheme(page);
    }
    log.info(`Forced ${theme} theme via DOM`);
  }
}
