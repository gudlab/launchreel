/**
 * Parse and validate launchreel.yaml config files.
 */
import { readFileSync, existsSync } from "fs";
import { parse as parseYaml } from "yaml";
import { LaunchReelConfigSchema, type LaunchReelConfig } from "./config-schema.js";
import { interpolateObject } from "../utils/env.js";
import { log } from "../utils/logger.js";

/**
 * Load, parse, and validate a launchreel.yaml config file.
 * Interpolates ${ENV_VAR} references in string values.
 */
export function loadConfig(configPath: string): LaunchReelConfig {
  if (!existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const raw = readFileSync(configPath, "utf8");
  let parsed: any;

  try {
    parsed = parseYaml(raw);
  } catch (err) {
    throw new Error(`Failed to parse YAML: ${(err as Error).message}`);
  }

  if (!parsed) {
    throw new Error("Config file is empty");
  }

  // Interpolate environment variables
  try {
    parsed = interpolateObject(parsed);
  } catch (err) {
    throw new Error(`Environment variable error: ${(err as Error).message}`);
  }

  // Validate with Zod
  const result = LaunchReelConfigSchema.safeParse(parsed);

  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  ${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new Error(`Invalid config:\n${errors}`);
  }

  log.debug(`Loaded config: ${result.data.project.name}`);
  log.debug(`  Scenarios: ${result.data.scenarios.length}`);

  return result.data;
}
