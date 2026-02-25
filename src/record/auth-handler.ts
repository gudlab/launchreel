/**
 * Generic authentication handler.
 * Supports credentials-based login, cookie injection, and token injection.
 */
import type { Page } from "puppeteer";
import { readFileSync, existsSync } from "fs";
import { wait } from "../utils/wait.js";
import { typeSlowly } from "../utils/input-helpers.js";
import { findButtonByText } from "../utils/element-finders.js";
import { interpolateEnv } from "../utils/env.js";
import { log } from "../utils/logger.js";
import type { AuthConfig } from "../plan/config-schema.js";

/**
 * Handle authentication based on the config strategy.
 */
export async function authenticate(
  page: Page,
  baseUrl: string,
  auth: AuthConfig,
): Promise<boolean> {
  switch (auth.type) {
    case "credentials":
      return authenticateWithCredentials(page, baseUrl, auth);
    case "cookie":
      return authenticateWithCookies(page, auth);
    case "token":
      return authenticateWithToken(page, auth);
    case "none":
      return true;
    default:
      log.warn(`Unknown auth type: ${auth.type}`);
      return false;
  }
}

async function authenticateWithCredentials(
  page: Page,
  baseUrl: string,
  auth: AuthConfig,
): Promise<boolean> {
  if (!auth.login_url || !auth.fields) {
    log.error("Credentials auth requires login_url and fields");
    return false;
  }

  const loginUrl = auth.login_url.startsWith("http")
    ? auth.login_url
    : `${baseUrl}${auth.login_url}`;

  log.step("Logging in...");
  await page.goto(loginUrl, { waitUntil: "networkidle2", timeout: 30000 });
  await wait(1500);

  // Fill each field
  for (const [_fieldName, field] of Object.entries(auth.fields)) {
    if (field.selector && field.value) {
      const value = interpolateEnv(field.value);
      await typeSlowly(page, field.selector, value, 40);
      await wait(300);
    }
  }
  await wait(500);

  // Submit the form
  if (auth.submit) {
    if (auth.submit.method === "enter_key") {
      await page.keyboard.press("Enter");
    } else if (auth.submit.selector) {
      const btn = await page.$(auth.submit.selector);
      if (btn) {
        await btn.click();
      } else {
        // Fallback: try finding a submit button by text
        const submitBtn = await findButtonByText(page, "Sign In");
        if (submitBtn) await submitBtn.click();
        else await page.keyboard.press("Enter");
      }
    }
  } else {
    await page.keyboard.press("Enter");
  }

  // Wait for navigation
  await wait(5000);

  // Check for success
  if (auth.success_url_contains) {
    if (page.url().includes(auth.success_url_contains)) {
      log.success(`Logged in: ${page.url()}`);
      return true;
    }

    // Retry: navigate directly as fallback
    log.warn("Login may not have redirected, trying direct navigation...");
    const successUrl = auth.success_url_contains.startsWith("http")
      ? auth.success_url_contains
      : `${baseUrl}${auth.success_url_contains}`;
    await page.goto(successUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    await wait(2000);

    if (page.url().includes(auth.success_url_contains)) {
      log.success(`Logged in (via direct nav): ${page.url()}`);
      return true;
    }

    log.error(`Login failed. Current URL: ${page.url()}`);
    return false;
  }

  log.success(`Logged in: ${page.url()}`);
  return true;
}

async function authenticateWithCookies(
  page: Page,
  auth: AuthConfig,
): Promise<boolean> {
  if (!auth.cookie_file) {
    log.error("Cookie auth requires cookie_file path");
    return false;
  }

  if (!existsSync(auth.cookie_file)) {
    log.error(`Cookie file not found: ${auth.cookie_file}`);
    log.info('Run "launchreel auth <url>" to generate a cookie file');
    return false;
  }

  try {
    const cookies = JSON.parse(readFileSync(auth.cookie_file, "utf8"));
    await page.setCookie(...cookies);
    log.success(`Injected ${cookies.length} cookies`);
    return true;
  } catch (err) {
    log.error(`Failed to load cookies: ${(err as Error).message}`);
    return false;
  }
}

async function authenticateWithToken(
  page: Page,
  auth: AuthConfig,
): Promise<boolean> {
  if (!auth.storage || auth.storage.length === 0) {
    log.error("Token auth requires storage entries");
    return false;
  }

  for (const entry of auth.storage) {
    const value = interpolateEnv(entry.value);
    const storageType = entry.type || "localStorage";

    await page.evaluate(
      ({ key, value, type }: { key: string; value: string; type: string }) => {
        if (type === "localStorage") {
          localStorage.setItem(key, value);
        } else if (type === "sessionStorage") {
          sessionStorage.setItem(key, value);
        }
      },
      { key: entry.key, value, type: storageType },
    );
    log.debug(`Set ${storageType}.${entry.key}`);
  }

  log.success("Token(s) injected");
  return true;
}
