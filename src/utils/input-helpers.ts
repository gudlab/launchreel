/**
 * Input field interaction helpers for Puppeteer.
 * Handles React controlled inputs and realistic typing.
 */
import type { Page } from "puppeteer";
import { wait } from "./wait.js";

/**
 * Type into an input field with realistic delays and proper event dispatch.
 * Handles React Hook Form and controlled inputs.
 */
export async function typeSlowly(
  page: Page,
  selector: string,
  text: string,
  delay = 50,
): Promise<void> {
  await page.waitForSelector(selector, { timeout: 10000 });
  await page.focus(selector);
  // Select all + delete existing content
  await page.keyboard.down("Meta");
  await page.keyboard.press("a");
  await page.keyboard.up("Meta");
  await wait(100);
  await page.keyboard.press("Backspace");
  await wait(100);
  // Type new content
  await page.keyboard.type(text, { delay });
  // Trigger change event for React forms
  await page.evaluate((sel: string) => {
    const el = document.querySelector(sel) as HTMLInputElement;
    if (el) {
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, selector);
}

/**
 * Clear a React controlled input using the native value setter.
 * Normal el.value = "" doesn't work with React controlled components.
 */
export async function clearReactInput(
  page: Page,
  selector: string,
): Promise<void> {
  await page.evaluate((sel: string) => {
    const el = document.querySelector(sel) as
      | HTMLInputElement
      | HTMLTextAreaElement;
    if (!el) return;
    el.focus();
    const isTextArea = el.tagName === "TEXTAREA";
    const proto = isTextArea
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (nativeSetter) {
      nativeSetter.call(el, "");
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, selector);
  await wait(150);
}

/**
 * Fill the first visible text-like input on the page.
 */
export async function fillVisibleInput(
  page: Page,
  text: string,
  delay = 35,
): Promise<void> {
  const focused = await page.evaluate(() => {
    const inputs = Array.from(
      document.querySelectorAll(
        'input[type="text"], input[type="email"], input[type="tel"], input:not([type])',
      ),
    ).filter((el) => {
      const rect = (el as HTMLElement).getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    if (inputs.length > 0) {
      (inputs[0] as HTMLInputElement).focus();
      return true;
    }
    return false;
  });
  if (focused) {
    await page.keyboard.type(text, { delay });
  }
}

/**
 * Fill the first visible textarea on the page.
 */
export async function fillVisibleTextarea(
  page: Page,
  text: string,
  delay = 20,
): Promise<void> {
  const focused = await page.evaluate(() => {
    const textareas = Array.from(document.querySelectorAll("textarea")).filter(
      (el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      },
    );
    if (textareas.length > 0) {
      textareas[0].focus();
      return true;
    }
    // Fallback to text inputs
    const inputs = Array.from(
      document.querySelectorAll('input[type="text"], input:not([type])'),
    ).filter((el) => {
      const rect = (el as HTMLElement).getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    if (inputs.length > 0) {
      (inputs[0] as HTMLElement).focus();
      return true;
    }
    return false;
  });
  if (focused) {
    await page.keyboard.type(text, { delay });
  }
}
