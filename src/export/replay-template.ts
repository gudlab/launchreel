/**
 * Generate HTML page for rrweb replay in headless browser.
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { ViewportConfig } from "../record/browser.js";

let cachedRrwebJS: string | null = null;
let cachedRrwebCSS: string | null = null;

function loadRrwebAssets() {
  if (cachedRrwebJS && cachedRrwebCSS) return;

  // Build a list of candidate directories
  const candidates: string[] = [
    join(process.cwd(), "node_modules", "rrweb", "dist"),
  ];

  // Try relative to this file (works when built/distributed)
  try {
    const thisDir = dirname(fileURLToPath(import.meta.url));
    candidates.push(join(thisDir, "..", "..", "node_modules", "rrweb", "dist"));
    candidates.push(join(thisDir, "..", "node_modules", "rrweb", "dist"));
  } catch { /* ignore */ }

  for (const dir of candidates) {
    const jsPath = join(dir, "rrweb.umd.min.cjs");
    if (existsSync(jsPath)) {
      cachedRrwebJS = readFileSync(jsPath, "utf8");
      const cssPath = join(dir, "style.min.css");
      cachedRrwebCSS = existsSync(cssPath)
        ? readFileSync(cssPath, "utf8")
        : "";
      return;
    }
  }

  throw new Error(
    "Could not find rrweb UMD bundle. Searched:\n" +
      candidates.map((d) => `  ${d}`).join("\n") +
      "\nMake sure rrweb is installed: npm install rrweb",
  );
}

/**
 * Generate a self-contained HTML page that replays rrweb events.
 * The page exposes window.initReplay(events) and window.seekTo(timeOffset).
 */
export function createReplayHTML(viewport: ViewportConfig): string {
  loadRrwebAssets();

  const { width, height } = viewport;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${cachedRrwebCSS}
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: ${width}px; height: ${height}px; overflow: hidden; background: #fff; }
    .rr-player { width: ${width}px !important; height: ${height}px !important; }
    .rr-player__frame { width: ${width}px !important; height: ${height}px !important; }
    .replayer-wrapper { transform: none !important; width: ${width}px !important; height: ${height}px !important; }
    .replayer-mouse { display: none; }
    iframe { border: none; width: ${width}px; height: ${height}px; }
  </style>
</head>
<body>
  <div id="player"></div>
  <script>${cachedRrwebJS}</script>
  <script>
    window.initReplay = function(events) {
      const replayer = new rrweb.Replayer(events, {
        root: document.getElementById('player'),
        skipInactive: true,
        showWarning: false,
        speed: 1,
        mouseTail: false,
        UNSAFE_replayCanvas: true,
        insertStyleRules: [
          '.replayer-mouse { display: none !important; }',
          '.replayer-wrapper { transform: none !important; }',
        ],
      });
      window.__replayer = replayer;
      const meta = replayer.getMetaData();
      return { totalTime: meta.totalTime, startTime: meta.startTime };
    };
    window.seekTo = function(timeOffset) {
      window.__replayer.pause(timeOffset);
    };
  </script>
</body>
</html>`;
}
