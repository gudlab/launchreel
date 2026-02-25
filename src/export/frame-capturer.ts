/**
 * Capture frames from rrweb replay for video encoding.
 */
import puppeteer from "puppeteer";
import { join } from "path";
import { writeFileSync, existsSync, rmSync, mkdirSync } from "fs";
import { createReplayHTML } from "./replay-template.js";
import { wait } from "../utils/wait.js";
import { log } from "../utils/logger.js";
import type { ViewportConfig } from "../record/browser.js";

export interface FrameCaptureResult {
  frameDir: string;
  totalFrames: number;
  totalTimeMs: number;
}

/**
 * Replay rrweb events in a headless browser and capture frames as PNGs.
 */
export async function captureFrames(
  sessionName: string,
  events: any[],
  framesDir: string,
  viewport: ViewportConfig,
  fps: number = 24,
): Promise<FrameCaptureResult> {
  const sessionFrameDir = join(framesDir, sessionName);

  // Clean and create frame directory
  if (existsSync(sessionFrameDir)) {
    rmSync(sessionFrameDir, { recursive: true });
  }
  mkdirSync(sessionFrameDir, { recursive: true });

  // Write replay HTML
  const replayHTMLPath = join(framesDir, `replay-${sessionName}.html`);
  writeFileSync(replayHTMLPath, createReplayHTML(viewport));

  // Launch a separate browser for replay
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--force-color-profile=srgb",
    ],
  });

  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.goto(`file://${replayHTMLPath}`, {
    waitUntil: "networkidle0",
    timeout: 30000,
  });

  // Initialize replay
  const metadata = await page.evaluate(
    (evts: any[]) => (window as any).initReplay(evts),
    events,
  );

  const totalTime = metadata.totalTime;
  const frameInterval = 1000 / fps;
  const totalFrames = Math.ceil(totalTime / frameInterval);

  log.info(
    `Duration: ${(totalTime / 1000).toFixed(1)}s, Frames: ${totalFrames} @ ${fps}fps`,
  );

  // Capture frames
  let frameNum = 0;
  for (let t = 0; t <= totalTime; t += frameInterval) {
    await page.evaluate(
      (time: number) => (window as any).seekTo(time),
      t,
    );
    await wait(30);

    const paddedNum = String(frameNum).padStart(6, "0");
    await page.screenshot({
      path: join(sessionFrameDir, `frame-${paddedNum}.png`),
    });

    if (frameNum % 100 === 0) {
      const pct = ((t / totalTime) * 100).toFixed(0);
      log.info(`Progress: ${pct}%`);
    }
    frameNum++;
  }

  await browser.close();

  return {
    frameDir: sessionFrameDir,
    totalFrames: frameNum,
    totalTimeMs: totalTime,
  };
}
