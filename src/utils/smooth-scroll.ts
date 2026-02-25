/**
 * Smooth eased scrolling within a Puppeteer page.
 */
import type { Page } from "puppeteer";
import { wait } from "./wait.js";

/**
 * Smoothly scroll the page to a target Y position using easeInOutCubic easing.
 */
export async function smoothScroll(
  page: Page,
  to: number,
  duration = 1000,
): Promise<void> {
  // Use addScriptTag to avoid tsx __name transform leaking into page.evaluate
  await page.addScriptTag({
    content: `
      window.__smoothScrollTo = ${to};
      window.__smoothScrollDuration = ${duration};
      window.__smoothScrollDone = new Promise(function(resolve) {
        var start = window.scrollY;
        var change = window.__smoothScrollTo - start;
        var dur = window.__smoothScrollDuration;
        var startTime = performance.now();
        function _step(ct) {
          var elapsed = ct - startTime;
          var progress = Math.min(elapsed / dur, 1);
          var ease = progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
          window.scrollTo(0, start + change * ease);
          if (progress < 1) { requestAnimationFrame(_step); }
          else { resolve(); }
        }
        requestAnimationFrame(_step);
      });
    `,
  });
  await page.evaluate(() => (window as any).__smoothScrollDone);
  await wait(300);
}
