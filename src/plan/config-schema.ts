/**
 * Zod schema for launchreel.yaml config validation.
 */
import { z } from "zod";

// ── Viewport ──
const ViewportSchema = z.object({
  width: z.number().default(1440),
  height: z.number().default(900),
  deviceScaleFactor: z.number().default(2),
});

// ── Auth ──
const AuthFieldSchema = z.object({
  selector: z.string(),
  value: z.string(),
});

const AuthSubmitSchema = z.object({
  selector: z.string().optional(),
  method: z.enum(["click", "enter_key"]).optional(),
});

const StorageEntrySchema = z.object({
  key: z.string(),
  value: z.string(),
  type: z.enum(["localStorage", "sessionStorage", "cookie"]).default("localStorage"),
});

const AuthSchema = z.object({
  type: z.enum(["credentials", "cookie", "token", "none"]).default("none"),
  login_url: z.string().optional(),
  fields: z.record(AuthFieldSchema).optional(),
  submit: AuthSubmitSchema.optional(),
  success_url_contains: z.string().optional(),
  cookie_file: z.string().optional(),
  storage: z.array(StorageEntrySchema).optional(),
});

// ── Actions ──
// Actions are flexible key-value pairs, validated at runtime by action-executor
const ActionSchema = z.record(z.any());

// ── Scenario ──
const ScenarioSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  type: z.enum(["screenshot", "video", "screenshot+video"]).optional(),
  page: z.string().optional(),
  requires_auth: z.boolean().default(false),
  new_tab: z.boolean().default(false),
  actions: z.array(ActionSchema).default([]),
});

// ── Export settings ──
const VideoExportSchema = z.object({
  format: z.string().default("mp4"),
  fps: z.number().default(24),
  crf: z.number().default(18),
  codec: z.string().default("libx264"),
});

const CombinedVideoSchema = z.object({
  enabled: z.boolean().default(true),
  name: z.string().default("launch-reel.mp4"),
  order: z.array(z.string()).optional(),
});

const ScreenshotExportSchema = z.object({
  format: z.string().default("png"),
  directory: z.string().default("screenshots"),
});

const ExportSchema = z.object({
  screenshots: ScreenshotExportSchema.optional(),
  videos: VideoExportSchema.optional(),
  combined_video: CombinedVideoSchema.optional(),
});

// ── Project ──
const ProjectSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  viewport: ViewportSchema.optional(),
  fps: z.number().default(24),
  theme: z.enum(["light", "dark", "auto", "both"]).default("light"),
});

// ── Root config ──
export const LaunchReelConfigSchema = z.object({
  project: ProjectSchema,
  auth: AuthSchema.optional(),
  scenarios: z.array(ScenarioSchema),
  export: ExportSchema.optional(),
});

// ── TypeScript types ──
export type LaunchReelConfig = z.infer<typeof LaunchReelConfigSchema>;
export type AuthConfig = z.infer<typeof AuthSchema>;
export type ScenarioConfig = z.infer<typeof ScenarioSchema>;
export type ExportConfig = z.infer<typeof ExportSchema>;
