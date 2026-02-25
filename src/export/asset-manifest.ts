/**
 * Generate a machine-readable manifest of all produced assets.
 */
import { writeFileSync, statSync, existsSync } from "fs";
import { join, relative, basename } from "path";
import { readdirSync } from "fs";
import { log } from "../utils/logger.js";
import type { OutputPaths } from "../utils/paths.js";

export interface AssetManifest {
  project: string;
  url: string;
  generated_at: string;
  tool: string;
  screenshots: Array<{
    name: string;
    path: string;
    size_bytes: number;
  }>;
  videos: Array<{
    name: string;
    path: string;
    size_bytes: number;
    scenario?: string;
  }>;
  combined_video?: {
    path: string;
    size_bytes: number;
  };
}

/**
 * Scan output directories and generate a manifest.
 */
export function generateManifest(
  projectName: string,
  projectUrl: string,
  paths: OutputPaths,
  combinedVideoName?: string,
): AssetManifest {
  const manifest: AssetManifest = {
    project: projectName,
    url: projectUrl,
    generated_at: new Date().toISOString(),
    tool: "launchreel@0.1.0",
    screenshots: [],
    videos: [],
  };

  // Scan screenshots
  if (existsSync(paths.screenshots)) {
    const files = readdirSync(paths.screenshots).filter((f) =>
      f.endsWith(".png"),
    );
    for (const file of files.sort()) {
      const fullPath = join(paths.screenshots, file);
      const stats = statSync(fullPath);
      manifest.screenshots.push({
        name: basename(file, ".png"),
        path: relative(paths.root, fullPath),
        size_bytes: stats.size,
      });
    }
  }

  // Scan videos
  if (existsSync(paths.videos)) {
    const files = readdirSync(paths.videos).filter((f) =>
      f.endsWith(".mp4"),
    );
    for (const file of files.sort()) {
      if (combinedVideoName && file === combinedVideoName) continue; // Skip combined
      const fullPath = join(paths.videos, file);
      const stats = statSync(fullPath);
      manifest.videos.push({
        name: basename(file, ".mp4"),
        path: relative(paths.root, fullPath),
        size_bytes: stats.size,
        scenario: basename(file, ".mp4"),
      });
    }
  }

  // Combined video
  if (combinedVideoName) {
    const combinedPath = join(paths.videos, combinedVideoName);
    if (existsSync(combinedPath)) {
      const stats = statSync(combinedPath);
      manifest.combined_video = {
        path: relative(paths.root, combinedPath),
        size_bytes: stats.size,
      };
    }
  }

  // Write manifest
  const manifestPath = join(paths.root, "manifest.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  log.success(`Manifest: ${manifestPath}`);

  return manifest;
}
