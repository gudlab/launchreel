/**
 * Text-based element finding helpers for Puppeteer.
 */
import type { Page, ElementHandle } from "puppeteer";

/**
 * Find a <button> by its visible text content.
 */
export async function findButtonByText(
  page: Page,
  text: string,
): Promise<ElementHandle<Element> | null> {
  const buttons = await page.$$("button");
  for (const btn of buttons) {
    const btnText = await btn.evaluate((el) => el.textContent?.trim() || "");
    if (btnText.includes(text)) return btn;
  }
  return null;
}

/**
 * Find any element matching a selector that contains the given text.
 */
export async function findElementByText(
  page: Page,
  text: string,
  selector: string,
): Promise<ElementHandle<Element> | null> {
  const elements = await page.$$(selector);
  for (const el of elements) {
    const elText = await el.evaluate((e) => e.textContent?.trim() || "");
    if (elText.includes(text)) return el;
  }
  return null;
}

/**
 * Find visible elements matching a selector (non-zero bounding box).
 */
export async function findVisibleElements(
  page: Page,
  selector: string,
): Promise<ElementHandle<Element>[]> {
  const elements = await page.$$(selector);
  const visible: ElementHandle<Element>[] = [];
  for (const el of elements) {
    const isVisible = await el.evaluate((e) => {
      const rect = (e as HTMLElement).getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    if (isVisible) visible.push(el);
  }
  return visible;
}
