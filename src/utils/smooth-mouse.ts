/**
 * Smooth mouse movement for Puppeteer.
 */
import type { Page } from "puppeteer";
import { wait } from "./wait.js";

/**
 * Smoothly move the mouse cursor to a position with configurable steps.
 */
export async function smoothMouseMove(
  page: Page,
  x: number,
  y: number,
  steps = 20,
): Promise<void> {
  await page.mouse.move(x, y, { steps });
  await wait(200);
}
