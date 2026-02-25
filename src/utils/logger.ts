/**
 * Structured logging with verbosity levels.
 */
import chalk from "chalk";

export type LogLevel = "debug" | "info" | "warn" | "error";

let currentLevel: LogLevel = "info";

const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export function setLogLevel(level: LogLevel) {
  currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return levels[level] >= levels[currentLevel];
}

export const log = {
  debug(msg: string, ...args: unknown[]) {
    if (shouldLog("debug")) console.log(chalk.gray(`  [debug] ${msg}`), ...args);
  },
  info(msg: string, ...args: unknown[]) {
    if (shouldLog("info")) console.log(`  ${msg}`, ...args);
  },
  success(msg: string, ...args: unknown[]) {
    if (shouldLog("info")) console.log(chalk.green(`  ✓ ${msg}`), ...args);
  },
  warn(msg: string, ...args: unknown[]) {
    if (shouldLog("warn")) console.log(chalk.yellow(`  ⚠ ${msg}`), ...args);
  },
  error(msg: string, ...args: unknown[]) {
    if (shouldLog("error")) console.error(chalk.red(`  ✗ ${msg}`), ...args);
  },
  step(msg: string) {
    if (shouldLog("info")) console.log(chalk.cyan(`\n  → ${msg}`));
  },
  header(msg: string) {
    if (shouldLog("info")) {
      console.log(chalk.bold(`\n${msg}`));
      console.log(chalk.gray("─".repeat(msg.length)));
    }
  },
  screenshot(name: string) {
    if (shouldLog("info")) console.log(chalk.dim(`    📸 ${name}`));
  },
};
