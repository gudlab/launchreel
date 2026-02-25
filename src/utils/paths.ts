/**
 * Output directory management.
 */
import { mkdirSync } from "fs";
import { join, resolve } from "path";

export interface OutputPaths {
  root: string;
  screenshots: string;
  recordings: string;
  frames: string;
  videos: string;
}

/**
 * Create and return all output directories.
 */
export function ensureOutputDirs(outputDir?: string): OutputPaths {
  const root = resolve(outputDir || "launchreel-output");
  const paths: OutputPaths = {
    root,
    screenshots: join(root, "screenshots"),
    recordings: join(root, "recordings"),
    frames: join(root, "frames"),
    videos: join(root, "videos"),
  };

  for (const dir of Object.values(paths)) {
    mkdirSync(dir, { recursive: true });
  }

  return paths;
}
