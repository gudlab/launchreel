# LaunchReel

Turn any website into launch videos and screenshots.

LaunchReel crawls your site, records browser sessions with [rrweb](https://github.com/rrweb-io/rrweb), and exports polished MP4 videos and retina screenshots — ready for Product Hunt, social media, or your landing page.

## Quick Start

```bash
npx launchreel study https://myapp.com   # Crawl site, generate config
# Edit launchreel.yaml to fine-tune scenarios...
npx launchreel record                     # Record screenshots + sessions
npx launchreel export                     # Export MP4 videos + combined reel
```

## How It Works

```
STUDY → PLAN → RECORD → EXPORT
```

1. **Study** — Crawls your site (navigation links, sitemap), extracts page structure. Optionally uses an LLM (Claude, OpenAI, or Ollama) to analyze features and generate an optimal recording plan.
2. **Plan** — Produces a `launchreel.yaml` config with recording scenarios. Human-readable, editable, version-controllable.
3. **Record** — Puppeteer navigates your site, [rrweb](https://github.com/rrweb-io/rrweb) records DOM sessions, screenshots are captured at key moments.
4. **Export** — rrweb events are replayed in headless Chrome, frames are captured, and ffmpeg encodes them into MP4 videos. Multiple videos are combined into a single launch reel.

## Install

```bash
npm install -g launchreel
# or use npx (no install needed)
npx launchreel --help
```

**System requirement:** [ffmpeg](https://ffmpeg.org/) must be installed for video export.

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg

# Windows
choco install ffmpeg
```

## Commands

### `launchreel study <url>`

Crawl a website and generate a recording config.

```bash
launchreel study https://myapp.com
launchreel study https://myapp.com --no-ai          # Skip AI analysis
launchreel study https://myapp.com --provider claude # Use Claude for analysis
launchreel study https://myapp.com --max-pages 10    # Limit crawl depth
```

**Options:**
| Flag | Description |
|------|-------------|
| `--max-pages <n>` | Maximum pages to crawl (default: 20) |
| `--depth <n>` | Maximum crawl depth (default: 3) |
| `--no-ai` | Skip LLM analysis, generate default scenarios |
| `--provider <name>` | LLM provider: `claude`, `openai`, `ollama` |
| `--api-key <key>` | API key (or set `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`) |
| `-o, --output <dir>` | Output directory |

### `launchreel record [config]`

Execute recording scenarios from a YAML config.

```bash
launchreel record                          # Use ./launchreel.yaml
launchreel record my-config.yaml           # Custom config
launchreel record --scenario homepage      # Record one scenario
launchreel record --headed                 # Watch in real browser
```

**Options:**
| Flag | Description |
|------|-------------|
| `-o, --output <dir>` | Output directory (default: `launchreel-output/`) |
| `--scenario <id>` | Record only a specific scenario |
| `--headed` | Show browser during recording |
| `--env-file <path>` | Path to `.env` file for credentials |

### `launchreel export [config]`

Convert rrweb recordings to MP4 videos.

```bash
launchreel export                          # Export all recordings
launchreel export --fps 30 --crf 15        # Higher quality
launchreel export --no-combine             # Skip combined reel
```

### `launchreel auth <url>`

Open a browser window for manual login. Exports cookies on Ctrl+C.

```bash
launchreel auth https://myapp.com/login
# Log in manually, then press Ctrl+C
# Cookies saved to cookies.json
```

Then add to your config:
```yaml
auth:
  type: "cookie"
  cookie_file: "cookies.json"
```

### `launchreel init [url]`

Create a starter `launchreel.yaml` in the current directory.

```bash
launchreel init https://myapp.com
```

## Config Reference

LaunchReel is driven by a YAML config file. Here's a full example:

```yaml
project:
  name: "My App Launch"
  url: "https://myapp.com"
  viewport:
    width: 1440
    height: 900
    deviceScaleFactor: 2
  theme: "light"              # light | dark | auto

# Authentication (optional)
auth:
  type: "credentials"         # credentials | cookie | token | none
  login_url: "/login"
  fields:
    email:
      selector: "#email"
      value: "${EMAIL}"       # References .env variable
    password:
      selector: "#password"
      value: "${PASSWORD}"
  submit:
    method: "enter_key"       # enter_key | click
  success_url_contains: "/dashboard"

# Recording scenarios
scenarios:
  - id: "homepage"
    name: "Homepage Tour"
    type: "screenshot+video"  # screenshot | video | screenshot+video
    page: "/"
    actions:
      - dismiss_cookies: true
      - finish_animations: true
      - wait: 500
      - screenshot: { name: "01-hero" }
      - scroll: { to: 600, duration: 1500 }
      - wait: 1000
      - screenshot: { name: "02-features" }
      - hover: { x: 720, y: 450 }
      - scroll: { to: 1400, duration: 2000 }
      - wait: 1500

  - id: "dashboard"
    name: "Dashboard Demo"
    type: "screenshot+video"
    page: "/dashboard"
    requires_auth: true
    actions:
      - dismiss_cookies: true
      - wait: 2000
      - screenshot: { name: "03-dashboard" }
      - click: { text: "Create New" }
      - wait: 2000
      - type: { selector: "#name", text: "My Project", delay: 40 }
      - click: { text: "Save" }
      - wait: 1500
      - screenshot: { name: "04-created" }

# Export settings
export:
  videos:
    fps: 24
    crf: 18                   # Lower = better quality
  combined_video:
    enabled: true
    name: "launch-reel.mp4"
    order: ["homepage", "dashboard"]
```

## Actions Reference

| Action | Description | Example |
|--------|-------------|---------|
| `wait` | Pause (ms) | `wait: 2000` |
| `scroll` | Smooth scroll to Y position | `scroll: { to: 600, duration: 1500 }` |
| `hover` | Move mouse to coordinates | `hover: { x: 720, y: 450 }` |
| `click` | Click by text or selector | `click: { text: "Sign In" }` |
| `type` | Type into an input | `type: { selector: "#email", text: "hi@me.com" }` |
| `clear_and_type` | Clear React input, then type | `clear_and_type: { selector: "#name", text: "New" }` |
| `screenshot` | Capture named screenshot | `screenshot: { name: "01-hero" }` |
| `dismiss_cookies` | Hide cookie banners | `dismiss_cookies: true` |
| `finish_animations` | Force all CSS animations to end state | `finish_animations: true` |
| `disable_animations` | Disable all animations/transitions | `disable_animations: true` |
| `set_theme` | Switch light/dark theme | `set_theme: "light"` |
| `press_key` | Press a keyboard key | `press_key: "Enter"` |
| `fill_form` | Fill first visible text input | `fill_form: "John Doe"` |
| `fill_textarea` | Fill first visible textarea | `fill_textarea: "Hello world"` |
| `wait_for_url` | Wait for URL to contain string | `wait_for_url: "/dashboard"` |
| `wait_for_selector` | Wait for element to appear | `wait_for_selector: ".loaded"` |
| `hover_cards` | Hover over a series of elements | `hover_cards: { selector: ".card", delay: 500 }` |
| `navigate` | Go to a URL | `navigate: "/pricing"` |
| `evaluate` | Run arbitrary JS in page | `evaluate: "document.title"` |

## Authentication

LaunchReel supports three auth strategies:

### Credentials (username/password)

```yaml
auth:
  type: "credentials"
  login_url: "/login"
  fields:
    email: { selector: "#email", value: "${EMAIL}" }
    password: { selector: "#password", value: "${PASSWORD}" }
  submit: { method: "enter_key" }
  success_url_contains: "/dashboard"
```

Values like `${EMAIL}` are interpolated from environment variables. Use a `.env` file:

```
EMAIL=me@example.com
PASSWORD=mysecretpassword
```

### Cookies (manual login)

```bash
launchreel auth https://myapp.com
# Log in manually in the browser window, then Ctrl+C
```

```yaml
auth:
  type: "cookie"
  cookie_file: "cookies.json"
```

### Token (localStorage/sessionStorage)

```yaml
auth:
  type: "token"
  storage:
    - key: "auth_token"
      value: "${AUTH_TOKEN}"
      type: "localStorage"
```

## Handling Animations

Many modern sites use CSS or JS animations that start with `opacity: 0`. In headless Puppeteer, screenshots can capture elements before animations complete.

LaunchReel provides two actions to handle this:

- **`finish_animations: true`** — Forces all running CSS animations to their end state. Use this when you want animations to complete naturally but instantly.
- **`disable_animations: true`** — Injects CSS that disables all animations and forces all elements visible. More aggressive but guaranteed to work.

```yaml
actions:
  - wait: 1000              # Let page load
  - finish_animations: true  # Complete all animations
  - screenshot: { name: "hero" }
```

## LLM Providers

The `study` command can use an LLM to analyze your site and generate optimized recording scenarios. Supported providers:

| Provider | Flag | Env Variable | Notes |
|----------|------|-------------|-------|
| Claude | `--provider claude` | `ANTHROPIC_API_KEY` | Default if key is set |
| OpenAI | `--provider openai` | `OPENAI_API_KEY` | GPT-4o by default |
| Ollama | `--provider ollama` | `OLLAMA_HOST` | Local, no API key needed |

Auto-detection: LaunchReel checks for API keys in order (Anthropic > OpenAI > Ollama) and uses the first available.

## Output

```
launchreel-output/
  screenshots/          # Named PNG screenshots (2x retina)
    01-hero.png
    02-features.png
  recordings/           # rrweb event JSON (for re-export)
    homepage.json
  videos/               # Per-scenario MP4 videos
    homepage.mp4
    dashboard.mp4
  launch-reel.mp4       # Combined video
  manifest.json         # Machine-readable asset index
```

## Tech Stack

- **[Puppeteer](https://pptr.dev/)** — Browser automation
- **[rrweb](https://www.rrweb.io/)** — DOM session recording & replay
- **[ffmpeg](https://ffmpeg.org/)** — Video encoding
- **[Cheerio](https://cheerio.js.org/)** — HTML parsing for site crawling
- **[Zod](https://zod.dev/)** — Config validation
- **[Commander.js](https://github.com/tj/commander.js)** — CLI framework

## License

MIT
