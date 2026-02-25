/**
 * Cookie banner detection and dismissal.
 */
import type { Page } from "puppeteer";
import { wait } from "../utils/wait.js";

/**
 * Dismiss cookie banners using CSS injection and button clicking.
 * Handles most common cookie consent implementations.
 */
export async function dismissCookies(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Inject CSS to hide common cookie banner elements
    const style = document.createElement("style");
    style.textContent = `
      [class*="cookie"], [class*="Cookie"], [class*="consent"], [class*="Consent"],
      [id*="cookie"], [id*="Cookie"], [id*="consent"], [id*="Consent"],
      [class*="CookieBanner"], [class*="cookie-banner"], [class*="gdpr"],
      [aria-label*="cookie"], [aria-label*="Cookie"],
      [class*="cc-banner"], [class*="cc_banner"],
      #CybotCookiebotDialog, #onetrust-banner-sdk, .osano-cm-dialog {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `;
    document.head.appendChild(style);

    // Click dismiss/reject/essential-only buttons
    const buttons = Array.from(document.querySelectorAll("button"));
    for (const btn of buttons) {
      const text = btn.textContent?.trim().toLowerCase() || "";
      if (
        text.includes("essential only") ||
        text.includes("reject all") ||
        text.includes("reject") ||
        text.includes("decline") ||
        text.includes("deny") ||
        text.includes("necessary only")
      ) {
        btn.click();
        break;
      }
    }
  });
  await wait(300);
}

/**
 * Dismiss cookie banners on every new document (via evaluateOnNewDocument).
 * More reliable for SPAs where pages change without full navigation.
 */
export async function setupCookieDismissal(page: Page): Promise<void> {
  await page.evaluateOnNewDocument(() => {
    // Wait for DOM then hide cookie elements
    const observer = new MutationObserver(() => {
      const selectors = [
        '[class*="cookie"]',
        '[class*="Cookie"]',
        '[class*="consent"]',
        '[id*="cookie"]',
        '[id*="consent"]',
        '[class*="gdpr"]',
        "#CybotCookiebotDialog",
        "#onetrust-banner-sdk",
      ];
      for (const sel of selectors) {
        document.querySelectorAll(sel).forEach((el) => {
          (el as HTMLElement).style.display = "none";
        });
      }
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener("DOMContentLoaded", () => {
        observer.observe(document.body, { childList: true, subtree: true });
      });
    }
  });
}
