/**
 * Main export orchestrator.
 * Converts rrweb recordings into videos and produces the combined reel.
 */
import { readFileSync, readdirSync, existsSync } from "fs";
import { join, basename } from "path";
import type { LaunchReelConfig } from "../plan/config-schema.js";
import type { ViewportConfig } from "../record/browser.js";
import { captureFrames } from "./frame-capturer.js";
import { encodeVideo, checkFfmpeg } from "./video-encoder.js";
import { combineVideos } from "./video-combiner.js";
import { generateManifest } from "./asset-manifest.js";
import { log } from "../utils/logger.js";
import type { OutputPaths } from "../utils/paths.js";

/**
 * Export all rrweb recordings to MP4 videos.
 */
export async function exportAll(
  config: LaunchReelConfig,
  paths: OutputPaths,
): Promise<void> {
  log.header("LaunchReel — Export");

  // Check ffmpeg
  if (!checkFfmpeg()) {
    log.error("ffmpeg is not installed. Install it:");
    log.info("  macOS: brew install ffmpeg");
    log.info("  Ubuntu: sudo apt install ffmpeg");
    log.info("  Windows: choco install ffmpeg");
    return;
  }

  const viewport: ViewportConfig = config.project.viewport || {
    width: 1440,
    height: 900,
    deviceScaleFactor: 2,
  };
  const fps = config.export?.videos?.fps || 24;
  const crf = config.export?.videos?.crf || 18;

  // Find all recordings
  if (!existsSync(paths.recordings)) {
    log.error("No recordings directory found. Run 'launchreel record' first.");
    return;
  }

  const recordingFiles = readdirSync(paths.recordings).filter((f) =>
    f.endsWith(".json"),
  );

  if (recordingFiles.length === 0) {
    log.error("No recordings found. Run 'launchreel record' first.");
    return;
  }

  log.info(`Found ${recordingFiles.length} recording(s)`);

  const videoPaths: string[] = [];

  // Process each recording
  for (const file of recordingFiles) {
    const sessionName = basename(file, ".json");
    const events = JSON.parse(
      readFileSync(join(paths.recordings, file), "utf8"),
    );

    if (events.length < 10) {
      log.warn(`Skipping ${sessionName} — too few events (${events.length})`);
      continue;
    }

    log.step(`Exporting: ${sessionName}`);

    // Capture frames from rrweb replay
    const { frameDir, totalFrames } = await captureFrames(
      sessionName,
      events,
      paths.frames,
      viewport,
      fps,
    );

    if (totalFrames === 0) {
      log.warn(`No frames captured for ${sessionName}`);
      continue;
    }

    // Encode to MP4
    const videoPath = join(paths.videos, `${sessionName}.mp4`);
    const success = encodeVideo(frameDir, videoPath, {
      fps,
      crf,
      width: viewport.width,
      height: viewport.height,
    });

    if (success) {
      videoPaths.push(videoPath);
    }
  }

  // Combine videos
  const combineConfig = config.export?.combined_video;
  if (combineConfig?.enabled !== false && videoPaths.length > 0) {
    const combinedName = combineConfig?.name || "launch-reel.mp4";
    const combinedPath = join(paths.videos, combinedName);

    // Order videos according to config
    let orderedPaths = videoPaths;
    if (combineConfig?.order) {
      orderedPaths = combineConfig.order
        .map((id: string) => join(paths.videos, `${id}.mp4`))
        .filter((p: string) => existsSync(p));
    }

    log.step("Combining into launch reel");
    combineVideos(orderedPaths, combinedPath, paths.videos);
  }

  // Generate manifest
  const combinedName =
    combineConfig?.enabled !== false
      ? combineConfig?.name || "launch-reel.mp4"
      : undefined;
  generateManifest(
    config.project.name,
    config.project.url,
    paths,
    combinedName,
  );

  log.header("Export Complete");
  log.info(`Screenshots: ${paths.screenshots}/`);
  log.info(`Videos: ${paths.videos}/`);
}
