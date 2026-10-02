export const MANAGED_BEGIN = "/* DocumentOne managed overrides: begin */";
export const MANAGED_END = "/* DocumentOne managed overrides: end */";

function cssString(value) {
  return JSON.stringify(String(value || ""));
}

function pageNumberRule(position) {
  if (position === "top-right") {
    return "\n  @top-right { content: counter(page); font-family: inherit; font-size: 10pt; }";
  }
  if (position === "bottom-center") {
    return "\n  @bottom-center { content: counter(page); font-family: inherit; font-size: 10pt; }";
  }
  if (position === "bottom-center-total") {
    return '\n  @bottom-center { content: "Page " counter(page) " of " counter(pages); font-family: inherit; font-size: 10pt; }';
  }
  return "";
}

function headerRule(text, position) {
  if (!String(text || "").trim()) return "";
  const box = position === "top-center" ? "@top-center" : "@top-left";
  return "\n  " + box + " { content: " + cssString(text.trim()) + "; font-family: inherit; font-size: 10pt; }";
}

export function buildManagedCss(state) {
  const keepHeadings = state.keepHeadings
    ? [
        "",
        ".mdocss-document h1,",
        ".mdocss-document h2,",
        ".mdocss-document h3,",
        ".mdocss-document h4,",
        ".mdocss-document h5,",
        ".mdocss-document h6 { break-after: avoid; }"
      ].join("\n")
    : "";

  return [
    MANAGED_BEGIN,
    "@page {",
    "  size: " + state.pageSize + ";",
    "  margin: " + state.pageMargin + "in;" +
      pageNumberRule(state.pageNumber) +
      headerRule(state.headerText, state.headerPosition),
    "}",
    "",
    ".mdocss-document {",
    "  font-family: " + state.fontFamily + ";",
    "  font-size: " + state.fontSize + "pt;",
    "  line-height: " + state.lineHeight + ";",
    "  color: " + state.textColor + ";",
    "  background: " + state.pageColor + ";",
    "}",
    "",
    ".mdocss-document p,",
    ".mdocss-document li {",
    "  orphans: " + state.orphans + ";",
    "  widows: " + state.widows + ";",
    "}",
    "",
    ".mdocss-document p {",
    "  text-align: " + state.paragraphAlign + ";",
    "  text-indent: " + state.paragraphIndent + "in;",
    "  margin-top: " + state.paragraphBefore + "pt;",
    "  margin-bottom: " + state.paragraphAfter + "pt;",
    "}",
    "",
    ".mdocss-figure,",
    ".mdocss-table,",
    ".mdocss-reference,",
    ".mdocss-document tr { break-inside: avoid; }",
    "",
    ".mdocss-document thead { display: table-header-group; }",
    keepHeadings,
    MANAGED_END
  ].join("\n");
}

export function stripManagedCss(css) {
  const oldBegins = [
    MANAGED_BEGIN,
    "/* MDOCSS Studio managed overrides: begin */"
  ];
  const oldEnds = [
    MANAGED_END,
    "/* MDOCSS Studio managed overrides: end */"
  ];

  let result = String(css || "");
  for (let i = 0; i < oldBegins.length; i++) {
    const start = result.indexOf(oldBegins[i]);
    const end = result.indexOf(oldEnds[i]);
    if (start >= 0 && end >= start) {
      result = result.slice(0, start) + result.slice(end + oldEnds[i].length);
    }
  }
  return result.trimEnd();
}

export function applyManagedCss(css, state) {
  const base = stripManagedCss(css);
  return base + (base ? "\n\n" : "") + buildManagedCss(state) + "\n";
}

export function defaultDesignerState() {
  return {
    fontFamily: '"Times New Roman", Times, serif',
    fontSize: 12,
    lineHeight: 1.5,
    textColor: "#111111",
    pageColor: "#ffffff",
    pageSize: "letter",
    pageMargin: 1,
    pageNumber: "top-right",
    headerText: "",
    headerPosition: "top-left",
    paragraphAlign: "left",
    paragraphIndent: 0,
    paragraphBefore: 0,
    paragraphAfter: 0,
    widows: 2,
    orphans: 2,
    keepHeadings: true
  };
}

function rgbToHex(value, fallback) {
  const match = /rgba?\((\d+)\D+(\d+)\D+(\d+)/i.exec(value || "");
  if (!match) return fallback;
  return "#" + [match[1], match[2], match[3]]
    .map(part => Number(part).toString(16).padStart(2, "0"))
    .join("");
}

function selectIfPresent(select, value) {
  if ([...select.options].some(option => option.value === value)) {
    select.value = value;
  }
}

export function readDesignerState(controls) {
  return {
    fontFamily: controls.fontFamily.value,
    fontSize: Number(controls.fontSize.value) || 12,
    lineHeight: Number(controls.lineHeight.value) || 1.5,
    textColor: controls.textColor.value,
    pageColor: controls.pageColor.value,
    pageSize: controls.pageSize.value,
    pageMargin: Number(controls.pageMargin.value) || 1,
    pageNumber: controls.pageNumber.value,
    headerText: controls.headerText.value,
    headerPosition: controls.headerPosition.value,
    paragraphAlign: controls.paragraphAlign.value,
    paragraphIndent: Number(controls.paragraphIndent.value) || 0,
    paragraphBefore: Number(controls.paragraphBefore.value) || 0,
    paragraphAfter: Number(controls.paragraphAfter.value) || 0,
    widows: Math.max(1, Math.round(Number(controls.widows.value) || 2)),
    orphans: Math.max(1, Math.round(Number(controls.orphans.value) || 2)),
    keepHeadings: controls.keepHeadings.checked
  };
}

export function syncDesignerControls(controls, frame, css) {
  const node = frame.contentDocument?.querySelector(".mdocss-document");
  const computed = node ? frame.contentWindow?.getComputedStyle(node) : null;

  if (computed) {
    selectIfPresent(controls.fontFamily, computed.fontFamily);
    const px = Number.parseFloat(computed.fontSize);
    if (Number.isFinite(px)) {
      controls.fontSize.value = String(Math.round(px * 0.75 * 10) / 10);
    }

    const linePx = Number.parseFloat(computed.lineHeight);
    if (Number.isFinite(px) && px > 0 && Number.isFinite(linePx)) {
      controls.lineHeight.value = String(Math.round((linePx / px) * 100) / 100);
    }

    controls.textColor.value = rgbToHex(computed.color, "#111111");
    controls.pageColor.value = rgbToHex(computed.backgroundColor, "#ffffff");
  }

  const size = /@page[\s\S]*?\bsize\s*:\s*(letter|a4|auto)\b/i.exec(css)?.[1];
  if (size) controls.pageSize.value = size.toLowerCase() === "a4" ? "A4" : size.toLowerCase();

  const margin = /@page[\s\S]*?\bmargin\s*:\s*([0-9.]+)in\b/i.exec(css)?.[1];
  if (margin) controls.pageMargin.value = margin;

  if (/@top-right[\s\S]*?counter\(page\)/i.test(css)) {
    controls.pageNumber.value = "top-right";
  } else if (/@bottom-center[\s\S]*?counter\(pages\)/i.test(css)) {
    controls.pageNumber.value = "bottom-center-total";
  } else if (/@bottom-center[\s\S]*?counter\(page\)/i.test(css)) {
    controls.pageNumber.value = "bottom-center";
  } else {
    controls.pageNumber.value = "none";
  }

  const headerLeft = /@top-left\s*\{\s*content:\s*"([^"]*)"/i.exec(css)?.[1];
  const headerCenter = /@top-center\s*\{\s*content:\s*"([^"]*)"/i.exec(css)?.[1];
  controls.headerText.value = headerCenter ?? headerLeft ?? "";
  controls.headerPosition.value = headerCenter != null ? "top-center" : "top-left";

  const align = /text-align\s*:\s*(left|center|right|justify)/i.exec(css)?.[1];
  if (align) controls.paragraphAlign.value = align;

  const indent = /text-indent\s*:\s*([0-9.]+)in/i.exec(css)?.[1];
  if (indent) controls.paragraphIndent.value = indent;

  const before = /margin-top\s*:\s*([0-9.]+)pt/i.exec(css)?.[1];
  if (before) controls.paragraphBefore.value = before;

  const after = /margin-bottom\s*:\s*([0-9.]+)pt/i.exec(css)?.[1];
  if (after) controls.paragraphAfter.value = after;

  const widows = /widows\s*:\s*(\d+)/i.exec(css)?.[1];
  if (widows) controls.widows.value = widows;

  const orphans = /orphans\s*:\s*(\d+)/i.exec(css)?.[1];
  if (orphans) controls.orphans.value = orphans;

  controls.keepHeadings.checked = /break-after\s*:\s*avoid/i.test(css);
}
