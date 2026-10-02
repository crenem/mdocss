const TICK = String.fromCharCode(96);

function escapeInline(text) {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/([\x60*_[\]])/g, "\\$1");
}

function serializeInline(node) {
  if (node.nodeType === Node.TEXT_NODE) return escapeInline(node.nodeValue || "");
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const el = node;
  const tag = el.tagName.toLowerCase();
  const inner = [...el.childNodes].map(serializeInline).join("");

  if (tag === "strong" || tag === "b") return "**" + inner + "**";
  if (tag === "em" || tag === "i") return "*" + inner + "*";
  if (tag === "u") return "<u>" + inner + "</u>";
  if (tag === "code") return TICK + (el.textContent || "").replace(/\x60/g, "\\" + TICK) + TICK;
  if (tag === "br") return "  \n";

  if (tag === "a") {
    const href = el.getAttribute("data-mdocss-source-href") || el.getAttribute("href") || "";
    return "[" + inner + "](" + href.replace(/\)/g, "\\)") + ")";
  }

  if (tag === "img") {
    const src = el.getAttribute("data-mdocss-source-src") || el.getAttribute("src") || "";
    const alt = el.getAttribute("alt") || "";
    return "![" + escapeInline(alt) + "](" + src.replace(/\)/g, "\\)") + ")";
  }

  return inner;
}

function semanticOuterHtml(el) {
  const clone = el.cloneNode(true);

  for (const node of clone.querySelectorAll("[data-mdocss-source-src]")) {
    node.setAttribute("src", node.getAttribute("data-mdocss-source-src"));
    node.removeAttribute("data-mdocss-source-src");
    node.removeAttribute("data-mdocss-blocked-resource");
    node.removeAttribute("data-mdocss-missing-resource");
  }

  for (const node of clone.querySelectorAll("[data-mdocss-source-href]")) {
    node.setAttribute("href", node.getAttribute("data-mdocss-source-href"));
    node.removeAttribute("data-mdocss-source-href");
    node.removeAttribute("data-mdocss-external-link");
    node.removeAttribute("rel");
  }

  clone.removeAttribute("contenteditable");
  clone.removeAttribute("spellcheck");
  return clone.outerHTML;
}

function isMdocssSemantic(el) {
  return [...el.classList].some(name => name.startsWith("mdocss-"));
}

function serializeList(el, ordered, depth = 0) {
  const lines = [];
  let index = 1;

  for (const li of [...el.children].filter(child => child.tagName?.toLowerCase() === "li")) {
    const marker = ordered ? String(index++) + ". " : "- ";
    const pieces = [];
    const nested = [];

    for (const child of [...li.childNodes]) {
      if (
        child.nodeType === Node.ELEMENT_NODE &&
        ["ul", "ol"].includes(child.tagName.toLowerCase())
      ) {
        nested.push(child);
      } else {
        pieces.push(serializeInline(child));
      }
    }

    lines.push("  ".repeat(depth) + marker + pieces.join("").trim());
    for (const list of nested) {
      lines.push(serializeList(list, list.tagName.toLowerCase() === "ol", depth + 1));
    }
  }

  return lines.join("\n");
}

function serializeBlock(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.nodeValue || "").trim();
    return text ? escapeInline(text) + "\n\n" : "";
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const el = node;
  const tag = el.tagName.toLowerCase();

  if (isMdocssSemantic(el) || tag === "figure" || tag === "table") {
    return semanticOuterHtml(el) + "\n\n";
  }

  if (/^h[1-6]$/.test(tag)) {
    return "#".repeat(Number(tag[1])) + " " +
      [...el.childNodes].map(serializeInline).join("").trim() + "\n\n";
  }

  if (tag === "p") {
    return [...el.childNodes].map(serializeInline).join("").trimEnd() + "\n\n";
  }

  if (tag === "blockquote") {
    const body = [...el.childNodes].map(serializeBlock).join("").trim();
    return body.split("\n").map(line => line ? "> " + line : ">").join("\n") + "\n\n";
  }

  if (tag === "ul" || tag === "ol") {
    return serializeList(el, tag === "ol") + "\n\n";
  }

  if (tag === "pre") {
    const code = el.textContent || "";
    const fence = TICK.repeat(code.includes(TICK.repeat(3)) ? 4 : 3);
    return fence + "\n" + code.replace(/\n$/, "") + "\n" + fence + "\n\n";
  }

  if (tag === "hr") return "---\n\n";
  if (tag === "img") return serializeInline(el) + "\n\n";

  if (tag === "div" || tag === "section" || tag === "article") {
    if (el.attributes.length) return semanticOuterHtml(el) + "\n\n";
    return [...el.childNodes].map(serializeBlock).join("");
  }

  return [...el.childNodes].map(child =>
    child.nodeType === Node.ELEMENT_NODE ? serializeBlock(child) : serializeInline(child)
  ).join("");
}

export function articleToMarkdown(article) {
  if (!article) return "";
  return [...article.childNodes]
    .map(serializeBlock)
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd() + "\n";
}

export function setBlockType(doc, tag) {
  doc.execCommand("formatBlock", false, tag);
}

export function execInlineCommand(doc, command, value = null) {
  doc.execCommand(command, false, value);
}

export function insertHtml(doc, html) {
  doc.execCommand("insertHTML", false, html);
}

export function insertText(doc, text) {
  doc.execCommand("insertText", false, text);
}

export function createLink(doc, href) {
  if (!href) return;
  doc.execCommand("createLink", false, href);
}

export function unlink(doc) {
  doc.execCommand("unlink", false);
}

export function selectionState(doc) {
  const selection = doc.getSelection();
  if (!selection?.rangeCount) return null;
  let node = selection.anchorNode;
  if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement;

  while (node && node !== doc.body) {
    const tag = node.tagName?.toLowerCase();
    if (tag && /^(p|h[1-6]|blockquote|pre|li)$/.test(tag)) {
      return { blockTag: tag };
    }
    node = node.parentElement;
  }

  return { blockTag: "p" };
}

export function imageFigureHtml({ src, alt = "", caption = "", blobUrl = null }) {
  const escape = value => String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const renderedSrc = blobUrl || src;
  const figcaption = caption
    ? '<figcaption class="mdocss-caption">' + escape(caption) + "</figcaption>"
    : "";

  return [
    '<figure class="mdocss-figure">',
    '<img src="' + escape(renderedSrc) + '" data-mdocss-source-src="' + escape(src) + '" alt="' + escape(alt) + '">',
    figcaption,
    "</figure>",
    "<p><br></p>"
  ].join("");
}
