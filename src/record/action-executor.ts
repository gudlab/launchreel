/**
 * Execute YAML action steps in a Puppeteer page.
 * This is the core engine that translates config actions into browser interactions.
 */
import type { Page } from "puppeteer";
import { wait } from "../utils/wait.js";
import { smoothScroll } from "../utils/smooth-scroll.js";
import { smoothMouseMove } from "../utils/smooth-mouse.js";
import {
  typeSlowly,
  clearReactInput,
  fillVisibleInput,
  fillVisibleTextarea,
} from "../utils/input-helpers.js";
import {
  findButtonByText,
  findElementByText,
} from "../utils/element-finders.js";
import { captureScreenshot } from "./screenshot-capture.js";
import { dismissCookies } from "./cookie-dismisser.js";
import { switchToTheme } from "./theme-handler.js";
import { log } from "../utils/logger.js";

export interface ActionContext {
  screenshotDir: string;
  baseUrl: string;
}

export type Action =
  | { wait: number }
  | { scroll: { to: number; duration?: number } }
  | { hover: { x: number; y: number; steps?: number } }
  | { click: { text?: string; selector?: string } }
  | { type: { selector: string; text: string; delay?: number } }
  | { clear_and_type: { selector: string; text: string; delay?: number } }
  | { screenshot: { name: string } }
  | { dismiss_cookies: true }
  | { set_theme: "light" | "dark" }
  | { press_key: string }
  | { fill_form: { text: string; delay?: number } }
  | { fill_textarea: { text: string; delay?: number } }
  | { wait_for_url: { contains: string; timeout?: number } }
  | { wait_for_selector: { selector: string; timeout?: number } }
  | { hover_cards: { selector: string; delay?: number } }
  | { navigate: { url: string } }
  | { evaluate: string }
  | { disable_animations: true }
  | { finish_animations: true };

/**
 * Parse a YAML action object into a typed action.
 * YAML actions use a simple key-value format:
 *   - wait: 2000
 *   - click: { text: "Sign In" }
 *   - screenshot: { name: "01-hero" }
 */
export function parseAction(raw: Record<string, any>): Action | null {
  const keys = Object.keys(raw);
  if (keys.length === 0) return null;
  const key = keys[0];
  const value = raw[key];

  switch (key) {
    case "wait":
      return { wait: value as number };
    case "scroll":
      return { scroll: value };
    case "hover":
      return { hover: value };
    case "click":
      return typeof value === "string"
        ? { click: { text: value } }
        : { click: value };
    case "type":
      return { type: value };
    case "clear_and_type":
      return { clear_and_type: value };
    case "screenshot":
      return typeof value === "string"
        ? { screenshot: { name: value } }
        : { screenshot: value };
    case "dismiss_cookies":
      return { dismiss_cookies: true };
    case "set_theme":
      return { set_theme: value as "light" | "dark" };
    case "press_key":
      return { press_key: value as string };
    case "fill_form":
      return typeof value === "string"
        ? { fill_form: { text: value } }
        : { fill_form: value };
    case "fill_textarea":
      return typeof value === "string"
        ? { fill_textarea: { text: value } }
        : { fill_textarea: value };
    case "wait_for_url":
      return typeof value === "string"
        ? { wait_for_url: { contains: value } }
        : { wait_for_url: value };
    case "wait_for_selector":
      return typeof value === "string"
        ? { wait_for_selector: { selector: value } }
        : { wait_for_selector: value };
    case "hover_cards":
      return { hover_cards: value };
    case "navigate":
      return typeof value === "string"
        ? { navigate: { url: value } }
        : { navigate: value };
    case "evaluate":
      return { evaluate: value as string };
    case "disable_animations":
      return { disable_animations: true };
    case "finish_animations":
      return { finish_animations: true };
    default:
      log.warn(`Unknown action type: ${key}`);
      return null;
  }
}

/**
 * Execute a single action on a Puppeteer page.
 */
export async function executeAction(
  page: Page,
  action: Action,
  ctx: ActionContext,
): Promise<void> {
  if ("wait" in action) {
    await wait(action.wait);
    return;
  }

  if ("scroll" in action) {
    await smoothScroll(page, action.scroll.to, action.scroll.duration);
    return;
  }

  if ("hover" in action) {
    await smoothMouseMove(
      page,
      action.hover.x,
      action.hover.y,
      action.hover.steps,
    );
    return;
  }

  if ("click" in action) {
    if (action.click.selector) {
      const el = await page.$(action.click.selector);
      if (el) {
        await el.click();
      } else {
        log.warn(`Selector not found: ${action.click.selector}`);
      }
    } else if (action.click.text) {
      const btn = await findButtonByText(page, action.click.text);
      if (btn) {
        await btn.click();
      } else {
        // Try any clickable element
        const el = await findElementByText(
          page,
          action.click.text,
          'a, button, [role="button"], [role="menuitem"]',
        );
        if (el) {
          await el.click();
        } else {
          log.warn(`Element not found with text: ${action.click.text}`);
        }
      }
    }
    await wait(300);
    return;
  }

  if ("type" in action) {
    await typeSlowly(
      page,
      action.type.selector,
      action.type.text,
      action.type.delay,
    );
    return;
  }

  if ("clear_and_type" in action) {
    await clearReactInput(page, action.clear_and_type.selector);
    await page.focus(action.clear_and_type.selector);
    await page.keyboard.type(action.clear_and_type.text, {
      delay: action.clear_and_type.delay || 35,
    });
    return;
  }

  if ("screenshot" in action) {
    await captureScreenshot(page, action.screenshot.name, ctx.screenshotDir);
    return;
  }

  if ("dismiss_cookies" in action) {
    await dismissCookies(page);
    return;
  }

  if ("set_theme" in action) {
    await switchToTheme(page, action.set_theme);
    return;
  }

  if ("press_key" in action) {
    await page.keyboard.press(action.press_key as any);
    await wait(200);
    return;
  }

  if ("fill_form" in action) {
    await fillVisibleInput(page, action.fill_form.text, action.fill_form.delay);
    return;
  }

  if ("fill_textarea" in action) {
    await fillVisibleTextarea(
      page,
      action.fill_textarea.text,
      action.fill_textarea.delay,
    );
    return;
  }

  if ("wait_for_url" in action) {
    await page.waitForFunction(
      (pattern: string) => window.location.href.includes(pattern),
      { timeout: action.wait_for_url.timeout || 20000 },
      action.wait_for_url.contains,
    );
    return;
  }

  if ("wait_for_selector" in action) {
    await page.waitForSelector(action.wait_for_selector.selector, {
      timeout: action.wait_for_selector.timeout || 10000,
    });
    return;
  }

  if ("hover_cards" in action) {
    const cards = await page.$$(action.hover_cards.selector);
    const delay = action.hover_cards.delay || 500;
    for (const card of cards) {
      const box = await card.boundingBox();
      if (box) {
        await smoothMouseMove(
          page,
          box.x + box.width / 2,
          box.y + box.height / 2,
        );
        await wait(delay);
      }
    }
    return;
  }

  if ("navigate" in action) {
    const url = action.navigate.url.startsWith("http")
      ? action.navigate.url
      : `${ctx.baseUrl}${action.navigate.url}`;
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await wait(1500);
    return;
  }

  if ("evaluate" in action) {
    await page.evaluate(action.evaluate);
    return;
  }

  if ("disable_animations" in action) {
    // Inject CSS that disables all animations/transitions and forces elements visible
    await page.addScriptTag({
      content: `
        var s = document.createElement('style');
        s.id = '__lr_no_animations';
        s.textContent = [
          '*, *::before, *::after {',
          '  animation-delay: 0s !important;',
          '  animation-duration: 0s !important;',
          '  animation-play-state: paused !important;',
          '  transition-delay: 0s !important;',
          '  transition-duration: 0s !important;',
          '  opacity: 1 !important;',
          '  transform: none !important;',
          '  visibility: visible !important;',
          '}',
        ].join('\\n');
        document.head.appendChild(s);
      `,
    });
    await wait(100);
    log.debug("Animations disabled");
    return;
  }

  if ("finish_animations" in action) {
    // Force all CSS animations to their end state
    await page.addScriptTag({
      content: `
        document.getAnimations().forEach(function(a) {
          a.finish();
        });
      `,
    });
    await wait(200);
    log.debug("Animations finished");
    return;
  }
}

/**
 * Execute a sequence of actions.
 */
export async function executeActions(
  page: Page,
  actions: Record<string, any>[],
  ctx: ActionContext,
): Promise<void> {
  for (let i = 0; i < actions.length; i++) {
    const raw = actions[i];
    const action = parseAction(raw);
    if (!action) continue;

    try {
      await executeAction(page, action, ctx);
    } catch (err) {
      const actionKey = Object.keys(raw)[0];
      log.warn(
        `Action ${i + 1} (${actionKey}) failed: ${(err as Error).message}`,
      );
    }
  }
}
