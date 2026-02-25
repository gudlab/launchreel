/**
 * Website crawler — discovers pages from navigation, sitemap, and internal links.
 */
import * as cheerio from "cheerio";
import { log } from "../utils/logger.js";

export interface PageInfo {
  url: string;
  title: string;
  metaDescription: string;
  headings: string[];
  sections: string[];
  interactive: string[];
  hasForms: boolean;
  estimatedScrollHeight: number;
  navLinks: string[];
}

export interface StudyResult {
  baseUrl: string;
  siteName: string;
  pages: PageInfo[];
  allLinks: string[];
}

export interface CrawlOptions {
  maxPages: number;
  maxDepth: number;
  include?: RegExp;
  exclude?: RegExp;
}

const DEFAULT_OPTIONS: CrawlOptions = {
  maxPages: 20,
  maxDepth: 3,
};

/**
 * Crawl a website starting from the given URL.
 */
export async function crawlSite(
  baseUrl: string,
  options: Partial<CrawlOptions> = {},
): Promise<StudyResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const base = baseUrl.replace(/\/$/, "");

  log.step(`Crawling ${base}...`);

  // Discover links
  const discoveredLinks = new Set<string>();
  const visitedLinks = new Set<string>();
  const pages: PageInfo[] = [];

  // Start with the homepage
  discoveredLinks.add("/");

  // Try fetching sitemap
  const sitemapLinks = await fetchSitemap(base);
  for (const link of sitemapLinks) {
    discoveredLinks.add(link);
  }

  // Crawl pages BFS-style
  const queue: Array<{ url: string; depth: number }> = [
    ...Array.from(discoveredLinks).map((url) => ({ url, depth: 0 })),
  ];

  while (queue.length > 0 && pages.length < opts.maxPages) {
    const item = queue.shift();
    if (!item) break;

    const { url, depth } = item;
    if (visitedLinks.has(url) || depth > opts.maxDepth) continue;

    // Apply include/exclude filters
    if (opts.include && !opts.include.test(url)) continue;
    if (opts.exclude && opts.exclude.test(url)) continue;

    visitedLinks.add(url);

    try {
      const pageInfo = await fetchAndAnalyzePage(base, url);
      if (pageInfo) {
        pages.push(pageInfo);
        log.info(`Analyzed: ${url} (${pageInfo.headings.length} headings)`);

        // Add discovered nav links to queue
        for (const link of pageInfo.navLinks) {
          if (!visitedLinks.has(link) && !discoveredLinks.has(link)) {
            discoveredLinks.add(link);
            queue.push({ url: link, depth: depth + 1 });
          }
        }
      }
    } catch (err) {
      log.debug(`Failed to fetch ${url}: ${(err as Error).message}`);
    }
  }

  // Extract site name from homepage
  const homepage = pages.find((p) => p.url === "/");
  const siteName = homepage?.title?.split(/[|\-–—]/)[0]?.trim() || "";

  return {
    baseUrl: base,
    siteName,
    pages,
    allLinks: Array.from(discoveredLinks),
  };
}

/**
 * Fetch and analyze a single page.
 */
async function fetchAndAnalyzePage(
  baseUrl: string,
  path: string,
): Promise<PageInfo | null> {
  const fullUrl = path.startsWith("http") ? path : `${baseUrl}${path}`;

  const response = await fetch(fullUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) LaunchReel/1.0",
      Accept: "text/html",
    },
    redirect: "follow",
  });

  if (!response.ok) return null;

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return null;

  const html = await response.text();
  const $ = cheerio.load(html);

  // Extract title
  const title = $("title").text().trim();

  // Meta description
  const metaDescription =
    $('meta[name="description"]').attr("content") || "";

  // Headings (h1-h3)
  const headings: string[] = [];
  $("h1, h2, h3").each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length < 200) headings.push(text);
  });

  // Identify sections by landmark elements, IDs, or semantic tags
  const sections: string[] = [];
  $("section, [id], main, article, aside, footer").each((_, el) => {
    const id = $(el).attr("id");
    const className = $(el).attr("class") || "";
    const tag = el.type === "tag" ? el.name : "";
    if (id) sections.push(id);
    else if (tag === "section" || tag === "article") {
      const firstHeading = $(el).find("h1, h2, h3").first().text().trim();
      if (firstHeading) sections.push(firstHeading.slice(0, 50));
    }
  });

  // Interactive elements
  const interactive: string[] = [];
  $("button, [role='button'], select, [role='slider']").each((_, el) => {
    const text = $(el).text().trim();
    const tag = el.type === "tag" ? el.name : "";
    if (text && text.length < 100) {
      interactive.push(`${tag}: ${text}`);
    }
  });

  // Forms
  const hasForms = $("form").length > 0;

  // Estimate scroll height from content
  const bodyText = $("body").text();
  const estimatedScrollHeight = Math.max(
    900,
    Math.round(bodyText.length / 3),
  );

  // Internal links for further crawling
  const navLinks: string[] = [];
  $("nav a[href], header a[href], footer a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      const normalized = normalizeLink(href, baseUrl);
      if (normalized) navLinks.push(normalized);
    }
  });

  // Also get main content links
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      const normalized = normalizeLink(href, baseUrl);
      if (normalized && !navLinks.includes(normalized)) {
        navLinks.push(normalized);
      }
    }
  });

  return {
    url: path,
    title,
    metaDescription,
    headings: headings.slice(0, 20),
    sections: [...new Set(sections)].slice(0, 15),
    interactive: interactive.slice(0, 20),
    hasForms,
    estimatedScrollHeight,
    navLinks: [...new Set(navLinks)].slice(0, 30),
  };
}

/**
 * Normalize a link to a relative path, filtering out external links.
 */
function normalizeLink(href: string, baseUrl: string): string | null {
  // Skip anchors, mailto, tel, javascript
  if (
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("javascript:")
  ) {
    return null;
  }

  // Absolute URL — check if same origin
  if (href.startsWith("http")) {
    try {
      const url = new URL(href);
      const baseHostname = new URL(baseUrl).hostname;
      if (url.hostname !== baseHostname) return null;
      return url.pathname;
    } catch {
      return null;
    }
  }

  // Relative URL
  if (href.startsWith("/")) {
    return href.split("?")[0].split("#")[0];
  }

  return null;
}

/**
 * Try to fetch and parse sitemap.xml.
 */
async function fetchSitemap(baseUrl: string): Promise<string[]> {
  const links: string[] = [];

  try {
    const response = await fetch(`${baseUrl}/sitemap.xml`, {
      headers: { Accept: "text/xml, application/xml" },
    });

    if (!response.ok) return links;

    const xml = await response.text();
    const $ = cheerio.load(xml, { xmlMode: true });

    $("url loc").each((_, el) => {
      const loc = $(el).text().trim();
      if (loc) {
        const normalized = normalizeLink(loc, baseUrl);
        if (normalized) links.push(normalized);
      }
    });

    log.info(`Sitemap: found ${links.length} URLs`);
  } catch {
    log.debug("No sitemap.xml found");
  }

  return links;
}
