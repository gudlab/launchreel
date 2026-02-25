/**
 * Concatenate multiple MP4 videos into one reel.
 */
import { execSync } from "child_process";
import { writeFileSync, existsSync } from "fs";
import { join } from "path";
import { log } from "../utils/logger.js";

/**
 * Combine multiple MP4 videos into a single file using ffmpeg concat.
 */
export function combineVideos(
  videoPaths: string[],
  outputPath: string,
  videosDir: string,
): boolean {
  // Filter to only existing files
  const existing = videoPaths.filter((p) => existsSync(p));
  if (existing.length === 0) {
    log.warn("No videos to combine");
    return false;
  }

  if (existing.length === 1) {
    // Just copy the single file
    execSync(`cp "${existing[0]}" "${outputPath}"`, { stdio: "pipe" });
    log.success(`Combined (single): ${outputPath}`);
    return true;
  }

  // Create filelist for ffmpeg concat
  const filelistPath = join(videosDir, "filelist.txt");
  const filelistContent = existing
    .map((f) => `file '${f}'`)
    .join("\n");
  writeFileSync(filelistPath, filelistContent);

  const cmd = [
    "ffmpeg -y",
    "-f concat",
    "-safe 0",
    `-i "${filelistPath}"`,
    "-c:v libx264",
    "-preset medium",
    "-crf 18",
    "-pix_fmt yuv420p",
    "-movflags +faststart",
    `"${outputPath}"`,
  ].join(" ");

  try {
    execSync(cmd, { stdio: "pipe" });
    log.success(`Combined: ${outputPath}`);
    return true;
  } catch (err) {
    log.error(`Failed to combine videos: ${(err as Error).message}`);
    return false;
  }
}
