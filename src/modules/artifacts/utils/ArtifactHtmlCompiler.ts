import { createHighlighterCore } from "@shikijs/core";
import { createJavaScriptRegexEngine } from "@shikijs/engine-javascript";
import css from "@shikijs/langs/css";
import diff from "@shikijs/langs/diff";
import html from "@shikijs/langs/html";
import javascript from "@shikijs/langs/javascript";
import json from "@shikijs/langs/json";
import jsx from "@shikijs/langs/jsx";
import markdown from "@shikijs/langs/markdown";
import python from "@shikijs/langs/python";
import bash from "@shikijs/langs/shellscript";
import sql from "@shikijs/langs/sql";
import tsx from "@shikijs/langs/tsx";
import typescript from "@shikijs/langs/typescript";
import yaml from "@shikijs/langs/yaml";
import githubDark from "@shikijs/themes/github-dark";
import { generate, parse, walk } from "css-tree";
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import { ARTIFACT_MAX_SOURCE_BYTES } from "~/modules/artifacts/utils/ArtifactLimits";
import {
  ArtifactValidationException,
  type ArtifactViolation,
} from "~/modules/artifacts/utils/ArtifactValidationException";

export const ARTIFACT_RENDERER_VERSION = "static-html-v1";

const MAX_RENDERED_BYTES = 4_194_304;
const MAX_CODE_BLOCKS = 50;
const MAX_CODE_BLOCK_CHARACTERS = 10_000;
const MAX_HIGHLIGHTED_CHARACTERS = 20_000;

const BLOCKED_ELEMENTS = new Set([
  "animate",
  "animatemotion",
  "animatetransform",
  "applet",
  "audio",
  "base",
  "button",
  "canvas",
  "embed",
  "filter",
  "foreignobject",
  "form",
  "frame",
  "frameset",
  "iframe",
  "image",
  "input",
  "link",
  "math",
  "meta",
  "noscript",
  "object",
  "option",
  "portal",
  "script",
  "select",
  "set",
  "source",
  "template",
  "textarea",
  "track",
  "video",
]);

const BLOCKED_ATTRIBUTES = new Set([
  "action",
  "autofocus",
  "contenteditable",
  "download",
  "formaction",
  "ping",
  "poster",
  "srcdoc",
  "srcset",
]);

const ALLOWED_AT_RULES = new Set([
  "-webkit-keyframes",
  "container",
  "keyframes",
  "layer",
  "media",
  "supports",
]);

const BLOCKED_CSS_PROPERTIES = new Set(["-moz-binding", "behavior"]);
const BLOCKED_CSS_FUNCTIONS = new Set([
  "-webkit-image-set",
  "expression",
  "image-set",
  "url",
]);

const CODE_LANGUAGE_ALIASES: Record<string, string> = {
  bash: "shellscript",
  css: "css",
  diff: "diff",
  html: "html",
  javascript: "javascript",
  js: "javascript",
  json: "json",
  jsx: "jsx",
  markdown: "markdown",
  md: "markdown",
  python: "python",
  py: "python",
  sh: "shellscript",
  shell: "shellscript",
  shellscript: "shellscript",
  sql: "sql",
  ts: "typescript",
  tsx: "tsx",
  typescript: "typescript",
  yaml: "yaml",
  yml: "yaml",
};

const BASE_STYLES = `
:root {
  color-scheme: dark;
  --artifact-bg: #0c1018;
  --artifact-surface: #131a23;
  --artifact-panel: #1c2330;
  --artifact-border: #282f3c;
  --artifact-text: #b0bec9;
  --artifact-muted: #8494a7;
  --artifact-bright: #f8fafc;
  --artifact-accent: #50dfaa;
  --artifact-link: #58a6ff;
  --artifact-warning: #ffb627;
  font-family: "IBM Plex Sans", system-ui, sans-serif;
  background: var(--artifact-bg);
  color: var(--artifact-text);
}
* { box-sizing: border-box; }
html { min-height: 100%; background: var(--artifact-bg); }
body { min-height: 100vh; margin: 0; background: var(--artifact-bg); color: var(--artifact-text); }
img, svg { max-width: 100%; }
img { height: auto; }
svg { overflow: visible; }
a { color: var(--artifact-link); text-underline-offset: 0.18em; }
pre, code { font-family: "JetBrains Mono", ui-monospace, monospace; }
pre { max-width: 100%; overflow: auto; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
`;

const ARTIFACT_CSP = [
  "default-src 'none'",
  "base-uri 'none'",
  "script-src 'none'",
  "style-src 'unsafe-inline'",
  "img-src data:",
  "font-src 'none'",
  "connect-src 'none'",
  "media-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "worker-src 'none'",
  "manifest-src 'none'",
  "form-action 'none'",
].join("; ");

const purifierWindow = new JSDOM("").window;
const purifier = createDOMPurify(
  purifierWindow as unknown as Parameters<typeof createDOMPurify>[0],
);
const artifactHighlighter = createHighlighterCore({
  themes: [githubDark],
  langs: [
    bash,
    css,
    diff,
    html,
    javascript,
    json,
    jsx,
    markdown,
    python,
    sql,
    tsx,
    typescript,
    yaml,
  ],
  engine: createJavaScriptRegexEngine(),
});

export interface CompiledArtifactHtml {
  html: string;
  rendererVersion: string;
}

export async function compileArtifactHtml(
  sourceHtml: string,
  title: string,
): Promise<CompiledArtifactHtml> {
  if (Buffer.byteLength(sourceHtml, "utf8") > ARTIFACT_MAX_SOURCE_BYTES) {
    throw new ArtifactValidationException([
      {
        code: "source_too_large",
        message: "Artifact HTML must be at most 1 MiB.",
      },
    ]);
  }

  const dom = new JSDOM(sourceHtml, { contentType: "text/html" });
  const { document } = dom.window;
  const language = getDocumentLanguage(document);
  const violations: ArtifactViolation[] = [];
  const styles = Array.from(document.querySelectorAll("style"));
  const compiledStyles = styles.map((style, index) => {
    const compiled = compileCss(style.textContent ?? "", "stylesheet", index);
    style.remove();
    return compiled;
  });

  inspectMarkup(document, violations);
  inspectInlineStyles(document, violations);
  if (violations.length > 0) throwValidation(violations);

  await highlightCodeBlocks(document, violations);
  inspectInlineStyles(document, violations);
  if (violations.length > 0) throwValidation(violations);

  const sanitizedBody = purifier.sanitize(document.body.innerHTML, {
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    FORBID_ATTR: [...BLOCKED_ATTRIBUTES],
    FORBID_TAGS: [...BLOCKED_ELEMENTS, "style"],
    RETURN_TRUSTED_TYPE: false,
    USE_PROFILES: { html: true, svg: true, svgFilters: false },
  });
  const userStyles = compiledStyles.filter(Boolean).join("\n");
  const html = buildDocument(title, sanitizedBody, userStyles, language);
  if (Buffer.byteLength(html, "utf8") > MAX_RENDERED_BYTES) {
    throw new ArtifactValidationException([
      {
        code: "rendered_too_large",
        message: "Compiled artifact HTML must be at most 4 MiB.",
      },
    ]);
  }
  return { html, rendererVersion: ARTIFACT_RENDERER_VERSION };
}

function inspectMarkup(
  document: Document,
  violations: ArtifactViolation[],
): void {
  for (const element of document.querySelectorAll("*")) {
    const tagName = element.localName.toLowerCase();
    if (BLOCKED_ELEMENTS.has(tagName)) {
      addViolation(
        violations,
        "blocked_element",
        `<${tagName}> is not allowed in artifacts.`,
      );
    }
    if (tagName.includes("-")) {
      addViolation(
        violations,
        "custom_element",
        `Custom element <${tagName}> is not allowed.`,
      );
    }
    for (const attribute of Array.from(element.attributes)) {
      inspectAttribute(element, attribute, violations);
    }
  }
}

function inspectAttribute(
  element: Element,
  attribute: Attr,
  violations: ArtifactViolation[],
): void {
  const name = attribute.name.toLowerCase();
  const value = attribute.value.trim();
  if (name.startsWith("on")) {
    addViolation(
      violations,
      "event_handler",
      `Event attribute ${attribute.name} is not allowed.`,
    );
    return;
  }
  if (BLOCKED_ATTRIBUTES.has(name)) {
    addViolation(
      violations,
      "blocked_attribute",
      `Attribute ${attribute.name} is not allowed.`,
    );
    return;
  }
  if (name === "target") {
    element.removeAttribute(attribute.name);
    return;
  }
  if (name === "href") {
    if (element.localName.toLowerCase() === "a" && isAllowedLink(value)) {
      element.setAttribute("rel", "noreferrer noopener");
      return;
    }
    if (element.namespaceURI?.includes("svg") && isLocalReference(value)) {
      return;
    }
    addViolation(
      violations,
      "unsafe_url",
      `URL in ${attribute.name} must be HTTPS or a local fragment link.`,
    );
    return;
  }
  if (name === "xlink:href") {
    if (isLocalReference(value)) return;
    addViolation(
      violations,
      "unsafe_svg_reference",
      "SVG references must point to an element in the same document.",
    );
    return;
  }
  if (name === "src") {
    if (element.localName.toLowerCase() === "img" && isDataImage(value)) {
      return;
    }
    addViolation(
      violations,
      "external_asset",
      "Images must be embedded as PNG, JPEG, WebP, or GIF data URLs.",
    );
    return;
  }
  if (/url\s*\(/i.test(value) && !isLocalCssReference(value)) {
    addViolation(
      violations,
      "external_svg_asset",
      `Attribute ${attribute.name} may only use local SVG references.`,
    );
  }
}

function inspectInlineStyles(
  document: Document,
  violations: ArtifactViolation[],
): void {
  let index = 0;
  for (const element of document.querySelectorAll<HTMLElement>("[style]")) {
    try {
      const compiled = compileCss(
        element.getAttribute("style") ?? "",
        "declarationList",
        index,
      );
      element.setAttribute("style", compiled);
    } catch (error) {
      if (error instanceof ArtifactValidationException) {
        violations.push(...error.violations);
      } else {
        throw error;
      }
    }
    index += 1;
  }
}

async function highlightCodeBlocks(
  document: Document,
  violations: ArtifactViolation[],
): Promise<void> {
  const codeBlocks = Array.from(
    document.querySelectorAll("pre > code[class*='language-']"),
  );
  if (codeBlocks.length > MAX_CODE_BLOCKS) {
    addViolation(
      violations,
      "too_many_code_blocks",
      `Artifacts may contain at most ${MAX_CODE_BLOCKS} highlighted code blocks.`,
    );
    return;
  }
  let highlightedCharacters = 0;
  for (const codeElement of codeBlocks) {
    const code = codeElement.textContent ?? "";
    highlightedCharacters += code.length;
    if (code.length > MAX_CODE_BLOCK_CHARACTERS) {
      addViolation(
        violations,
        "code_block_too_large",
        `Highlighted code blocks may contain at most ${MAX_CODE_BLOCK_CHARACTERS} characters.`,
      );
    }
  }
  if (highlightedCharacters > MAX_HIGHLIGHTED_CHARACTERS) {
    addViolation(
      violations,
      "highlighted_code_too_large",
      `Artifacts may contain at most ${MAX_HIGHLIGHTED_CHARACTERS} highlighted code characters in total.`,
    );
  }
  if (violations.length > 0) return;
  for (const codeElement of codeBlocks) {
    const code = codeElement.textContent ?? "";
    const language = getCodeLanguage(codeElement.className);
    const highlighter = await artifactHighlighter;
    const highlighted = await highlighter.codeToHtml(code, {
      lang: language,
      theme: "github-dark",
    });
    const template = document.createElement("template");
    template.innerHTML = highlighted;
    const replacement = template.content.firstElementChild;
    const pre = codeElement.parentElement;
    if (replacement && pre) pre.replaceWith(replacement);
  }
}

function getDocumentLanguage(document: Document): string {
  const sourceLanguage = document.documentElement.lang.trim();
  if (!sourceLanguage || sourceLanguage.length > 64) return "en";
  try {
    return Intl.getCanonicalLocales(sourceLanguage)[0] ?? "en";
  } catch {
    return "en";
  }
}

function getCodeLanguage(className: string): string {
  const requested = className
    .match(/(?:^|\s)language-([a-z0-9_+-]{1,40})(?:\s|$)/i)?.[1]
    ?.toLowerCase();
  if (!requested) return "text";
  return CODE_LANGUAGE_ALIASES[requested] ?? "text";
}

function compileCss(
  css: string,
  context: "stylesheet" | "declarationList",
  index: number,
): string {
  const violations: ArtifactViolation[] = [];
  const parseErrors: string[] = [];
  let ast: ReturnType<typeof parse>;
  try {
    ast = parse(css, {
      context,
      positions: false,
      onParseError(error) {
        parseErrors.push(error.message);
      },
    });
  } catch {
    throw new ArtifactValidationException([
      {
        code: "invalid_css",
        message: `CSS block ${index + 1} could not be parsed.`,
      },
    ]);
  }
  if (parseErrors.length > 0) {
    addViolation(
      violations,
      "invalid_css",
      `CSS block ${index + 1} contains invalid syntax.`,
    );
  }
  const allowedRawValues = new WeakSet<object>();
  walk(ast, (node) => {
    if (node.type === "Atrule") {
      const name = node.name.toLowerCase();
      if (!ALLOWED_AT_RULES.has(name)) {
        addViolation(
          violations,
          "blocked_css_rule",
          `CSS @${node.name} rules are not allowed.`,
        );
      }
    }
    if (node.type === "Declaration") {
      const property = node.property.toLowerCase();
      if (BLOCKED_CSS_PROPERTIES.has(property)) {
        addViolation(
          violations,
          "blocked_css_property",
          `CSS property ${node.property} is not allowed.`,
        );
      }
      if (node.value.type === "Raw") {
        if (
          property.startsWith("--") &&
          isSafeCustomProperty(node.value.value)
        ) {
          allowedRawValues.add(node.value);
        } else {
          addViolation(
            violations,
            "unsafe_css_value",
            `CSS property ${node.property} contains an unsupported value.`,
          );
        }
      }
    }
    if (node.type === "Function") {
      const name = node.name.toLowerCase();
      if (BLOCKED_CSS_FUNCTIONS.has(name)) {
        addViolation(
          violations,
          "blocked_css_function",
          `CSS function ${node.name}() is not allowed.`,
        );
      }
    }
    if (node.type === "Url") {
      addViolation(
        violations,
        "external_css_asset",
        "CSS URLs are not allowed. Embed raster images in HTML instead.",
      );
    }
    if (node.type === "Raw" && !allowedRawValues.has(node)) {
      addViolation(
        violations,
        "unsafe_css_value",
        "CSS contains a value that cannot be validated safely.",
      );
    }
  });
  if (violations.length > 0) throwValidation(violations);
  return generate(ast);
}

function isSafeCustomProperty(value: string): boolean {
  return !/(?:url\s*\(|image-set\s*\(|expression\s*\(|@import|[<>\\])/i.test(
    value,
  );
}

function isAllowedLink(value: string): boolean {
  if (isLocalReference(value)) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isLocalReference(value: string): boolean {
  return /^#[A-Za-z][A-Za-z0-9_.:-]*$/.test(value);
}

function isLocalCssReference(value: string): boolean {
  return /^url\(#[A-Za-z][A-Za-z0-9_.:-]*\)$/i.test(value.replace(/\s/g, ""));
}

function isDataImage(value: string): boolean {
  return /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i.test(
    value,
  );
}

function buildDocument(
  title: string,
  sanitizedBody: string,
  userStyles: string,
  language: string,
): string {
  const styles = escapeStyleEndTag(`${BASE_STYLES}\n${userStyles}`);
  return `<!doctype html>
<html lang="${language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="${ARTIFACT_CSP}">
<title>${escapeHtml(title)}</title>
<style>${styles}</style>
</head>
<body>${sanitizedBody}</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeStyleEndTag(value: string): string {
  return value.replace(/<\/style/gi, "<\\/style");
}

function addViolation(
  violations: ArtifactViolation[],
  code: string,
  message: string,
): void {
  if (
    violations.some(
      (violation) => violation.code === code && violation.message === message,
    )
  ) {
    return;
  }
  if (violations.length < 20) violations.push({ code, message });
}

function throwValidation(violations: ArtifactViolation[]): never {
  throw new ArtifactValidationException(violations.slice(0, 20));
}
