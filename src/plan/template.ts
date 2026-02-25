/**
 * Default YAML template for `launchreel init`.
 */

export function getDefaultTemplate(url?: string): string {
  const siteUrl = url || "https://example.com";

  return `# launchreel.yaml — Launch video & screenshot config
# Docs: https://github.com/launchreel/launchreel

project:
  name: "My App Launch"
  url: "${siteUrl}"
  viewport:
    width: 1440
    height: 900
    deviceScaleFactor: 2
  theme: "light"

# Authentication (uncomment and configure if needed)
# auth:
#   type: "credentials"
#   login_url: "/login"
#   fields:
#     email:
#       selector: "#email"
#       value: "\${EMAIL}"
#     password:
#       selector: "#password"
#       value: "\${PASSWORD}"
#   submit:
#     method: "enter_key"
#   success_url_contains: "/dashboard"

scenarios:
  # Homepage scroll-through
  - id: "homepage"
    name: "Homepage Tour"
    type: "screenshot+video"
    page: "/"
    actions:
      - dismiss_cookies: true
      - wait: 2000
      - screenshot: { name: "01-hero" }
      - scroll: { to: 600, duration: 1500 }
      - wait: 1000
      - screenshot: { name: "02-features" }
      - scroll: { to: 1200, duration: 1500 }
      - wait: 1000
      - screenshot: { name: "03-details" }
      - scroll: { to: 2000, duration: 2000 }
      - wait: 1500

  # Pricing page (if applicable)
  # - id: "pricing"
  #   name: "Pricing"
  #   type: "screenshot"
  #   page: "/pricing"
  #   actions:
  #     - dismiss_cookies: true
  #     - wait: 2000
  #     - screenshot: { name: "04-pricing" }
  #     - scroll: { to: 400, duration: 1500 }
  #     - wait: 1000

  # Dashboard / app demo (requires auth)
  # - id: "dashboard"
  #   name: "Dashboard Demo"
  #   type: "screenshot+video"
  #   page: "/dashboard"
  #   requires_auth: true
  #   actions:
  #     - wait: 2000
  #     - screenshot: { name: "05-dashboard" }
  #     - click: { text: "Create New" }
  #     - wait: 2000
  #     - screenshot: { name: "06-create" }

export:
  videos:
    format: "mp4"
    fps: 24
    crf: 18
  combined_video:
    enabled: true
    name: "launch-reel.mp4"
`;
}
