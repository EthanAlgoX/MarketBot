import DOMPurify from "dompurify";
import { marked } from "marked";
import { truncateText } from "./format";

/**
 * Rewrite local file paths in markdown image references to gateway-served URLs.
 *
 * Handles two patterns the agent produces:
 *  - Relative filenames: `![alt](chart.png)` -> `/api/files/chart.png`
 *  - Absolute workspace paths: `![alt](/Users/.../workspace/chart.png)` -> `/api/files/chart.png`
 *  - Already-valid URLs (http/https/data:) are left untouched.
 */
function rewriteImageSrc(src: string): string {
  if (!src) return src;
  // Already a URL or data-URI — leave untouched.
  if (/^https?:\/\//i.test(src) || /^data:/i.test(src) || src.startsWith("/api/files/")) {
    return src;
  }
  // Absolute filesystem path — serve via the files endpoint.
  // The gateway's /api/files/ handler resolves paths relative to the workspace root,
  // but for absolute paths we pass them as-is and let the server resolve safely.
  if (src.startsWith("/")) {
    return `/api/files${src}`;
  }
  // Relative path — treat as relative to workspace root.
  return `/api/files/${src}`;
}

// Custom marked renderer that rewrites image sources to gateway file URLs.
const renderer = new marked.Renderer();
renderer.image = function ({ href, title, text }: { href: string; title: string | null; text: string }) {
  const src = rewriteImageSrc(href);
  const alt = text ? ` alt="${text}"` : "";
  const titleAttr = title ? ` title="${title}"` : "";
  // Wrap in a link so clicking opens the full image in a new tab.
  return `<a href="${src}" target="_blank" rel="noreferrer noopener"><img src="${src}"${alt}${titleAttr} loading="lazy" class="chat-inline-image" /></a>`;
};

marked.setOptions({
  gfm: true,
  breaks: true,
  renderer,
});

const allowedTags = [
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "del",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "hr",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
];

const allowedAttrs = ["alt", "class", "href", "loading", "rel", "src", "target", "title", "start"];

let hooksInstalled = false;
const MARKDOWN_CHAR_LIMIT = 140_000;
const MARKDOWN_PARSE_LIMIT = 40_000;
const MARKDOWN_CACHE_LIMIT = 200;
const MARKDOWN_CACHE_MAX_CHARS = 50_000;
const markdownCache = new Map<string, string>();

function getCachedMarkdown(key: string): string | null {
  const cached = markdownCache.get(key);
  if (cached === undefined) return null;
  markdownCache.delete(key);
  markdownCache.set(key, cached);
  return cached;
}

function setCachedMarkdown(key: string, value: string) {
  markdownCache.set(key, value);
  if (markdownCache.size <= MARKDOWN_CACHE_LIMIT) return;
  const oldest = markdownCache.keys().next().value;
  if (oldest) markdownCache.delete(oldest);
}

function installHooks() {
  if (hooksInstalled) return;
  hooksInstalled = true;

  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (!(node instanceof HTMLAnchorElement)) return;
    const href = node.getAttribute("href");
    if (!href) return;
    node.setAttribute("rel", "noreferrer noopener");
    node.setAttribute("target", "_blank");
  });
}

export function toSanitizedMarkdownHtml(markdown: string): string {
  const input = markdown.trim();
  if (!input) return "";
  installHooks();
  if (input.length <= MARKDOWN_CACHE_MAX_CHARS) {
    const cached = getCachedMarkdown(input);
    if (cached !== null) return cached;
  }
  const truncated = truncateText(input, MARKDOWN_CHAR_LIMIT);
  const suffix = truncated.truncated
    ? `\n\n… truncated (${truncated.total} chars, showing first ${truncated.text.length}).`
    : "";
  if (truncated.text.length > MARKDOWN_PARSE_LIMIT) {
    const escaped = escapeHtml(`${truncated.text}${suffix}`);
    const html = `<pre class="code-block">${escaped}</pre>`;
    const sanitized = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: allowedTags,
      ALLOWED_ATTR: allowedAttrs,
    });
    if (input.length <= MARKDOWN_CACHE_MAX_CHARS) {
      setCachedMarkdown(input, sanitized);
    }
    return sanitized;
  }
  const rendered = marked.parse(`${truncated.text}${suffix}`) as string;
  const sanitized = DOMPurify.sanitize(rendered, {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: allowedAttrs,
  });
  if (input.length <= MARKDOWN_CACHE_MAX_CHARS) {
    setCachedMarkdown(input, sanitized);
  }
  return sanitized;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
