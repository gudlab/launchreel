/**
 * Environment variable loading and interpolation.
 */
import { config as loadDotenv } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";

/**
 * Load environment variables from .env file.
 */
export function loadEnv(envPath?: string): void {
  const path = envPath || resolve(process.cwd(), ".env");
  if (existsSync(path)) {
    loadDotenv({ path });
  }
}

/**
 * Interpolate ${VAR_NAME} references in a string with environment variable values.
 */
export function interpolateEnv(value: string): string {
  return value.replace(/\$\{(\w+)\}/g, (_, varName) => {
    const envValue = process.env[varName];
    if (envValue === undefined) {
      throw new Error(
        `Environment variable ${varName} is not set. Add it to .env or set it in your shell.`,
      );
    }
    return envValue;
  });
}

/**
 * Deep-interpolate all string values in an object.
 */
export function interpolateObject<T>(obj: T): T {
  if (typeof obj === "string") {
    return interpolateEnv(obj) as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => interpolateObject(item)) as T;
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = interpolateObject(value);
    }
    return result as T;
  }
  return obj;
}
