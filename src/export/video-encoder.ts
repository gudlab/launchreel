/**
 * ffmpeg video encoding from captured frames.
 */
import { execSync } from "child_process";
import { join } from "path";
import { log } from "../utils/logger.js";

export interface VideoEncoderOptions {
  fps: number;
  crf: number;
  width: number;
  height: number;
  preset?: string;
}

const DEFAULT_OPTIONS: VideoEncoderOptions = {
  fps: 24,
  crf: 18,
  width: 1440,
  height: 900,
  preset: "medium",
};

/**
 * Check if ffmpeg is installed and available.
 */
export function checkFfmpeg(): boolean {
  try {
    execSync("ffmpeg -version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Encode a directory of PNG frames into an MP4 video.
 */
export function encodeVideo(
  frameDir: string,
  outputPath: string,
  options: Partial<VideoEncoderOptions> = {},
): boolean {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const cmd = [
    "ffmpeg",
    "-y",
    `-framerate ${opts.fps}`,
    `-i "${join(frameDir, "frame-%06d.png")}"`,
    "-c:v libx264",
    `-preset ${opts.preset}`,
    `-crf ${opts.crf}`,
    "-pix_fmt yuv420p",
    "-movflags +faststart",
    `-vf "scale=${opts.width}:${opts.height}"`,
    `"${outputPath}"`,
  ].join(" ");

  try {
    execSync(cmd, { stdio: "pipe" });
    log.success(`Encoded: ${outputPath}`);
    return true;
  } catch (err) {
    log.error(`ffmpeg failed: ${(err as Error).message}`);
    return false;
  }
}
