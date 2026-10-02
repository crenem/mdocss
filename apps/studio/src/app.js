import {
  activeCssPath,
  activeStyle,
  addAsset,
  addStyle,
  createNewPackage,
  deleteActiveStyle,
  duplicateActiveStyle,
  generatePackageBlob,
  openPackage,
  readActiveCss,
  renameActiveStyle,
  writeEditors
} from "./package-model.js";
import { StudioRenderer } from "./renderer.js";
import {
  applyManagedCss,
  buildManagedCss,
  defaultDesignerState,
  readDesignerState,
  stripManagedCss,
  syncDesignerControls
} from "./style-designer.js";
import {
  articleToMarkdown,
  createLink,
  execInlineCommand,
  imageFigureHtml,
  insertHtml,
  insertText,
  selectionState,
  setBlockType,
  unlink
} from "./wysiwyg.js";

const $ = selector => document.querySelector(selector);

const els = {
  newButton: $("#new-button"),
  fileInput: $("#file-input"),
  saveButton: $("#save-button"),
  printButton: $("#print-button"),
  readModeButton: $("#read-mode-button"),
  editModeButton: $("#edit-mode-button"),
  writingToolbar: $("#writing-toolbar"),
  blockStyle: $("#block-style"),
  boldButton: $("#bold-button"),
  italicButton: $("#italic-button"),
  underlineButton: $("#underline-button"),
  bulletButton: $("#bullet-button"),
  numberButton: $("#number-button"),
  linkButton: $("#link-button"),
  unlinkButton: $("#unlink-button"),
  imageInput: $("#image-input"),
  undoButton: $("#undo-button"),
  redoButton: $("#redo-button"),
  dirty: $("#dirty-indicator"),
  styleSelect: $("#style-select"),
  newStyleButton: $("#new-style-button"),
  duplicateStyleButton: $("#duplicate-style-button"),
  renameStyleButton: $("#rename-style-button"),
  deleteStyleButton: $("#delete-style-button"),
  dropZone: $("#drop-zone"),
  emptyState: $("#empty-state"),
  frame: $("#document-frame"),
  status: $("#status"),
  documentInfo: $("#document-info"),
  designTab: $("#design-tab"),
  sourceTab: $("#source-tab"),
  designPanel: $("#design-panel"),
  sourcePanel: $("#source-panel"),
  markdownTab: $("#markdown-tab"),
  cssTab: $("#css-tab"),
  markdownEditor: $("#markdown-editor"),
  cssEditor: $("#css-editor"),
  sourceLabel: $("#source-label"),
  designerControls: $("#designer-controls"),
  pageControls: $("#page-controls"),
  paragraphControls: $("#paragraph-controls"),
  resetDesigner: $("#reset-designer"),
  fontFamily: $("#font-family"),
  fontSize: $("#font-size"),
  lineHeight: $("#line-height"),
  textColor: $("#text-color"),
  pageColor: $("#page-color"),
  pageSize: $("#page-size"),
  pageMargin: $("#page-margin"),
  pageNumber: $("#page-number"),
  headerText: $("#header-text"),
  headerPosition: $("#header-position"),
  paragraphAlign: $("#paragraph-align"),
  paragraphIndent: $("#paragraph-indent"),
  paragraphBefore: $("#paragraph-before"),
  paragraphAfter: $("#paragraph-after"),
  widows: $("#widows"),
  orphans: $("#orphans"),
  keepHeadings: $("#keep-headings")
};

const designerControls = {
  fontFamily: els.fontFamily,
  fontSize: els.fontSize,
  lineHeight: els.lineHeight,
  textColor: els.textColor,
  pageColor: els.pageColor,
  pageSize: els.pageSize,
  pageMargin: els.pageMargin,
  pageNumber: els.pageNumber,
  headerText: els.headerText,
  headerPosition: els.headerPosition,
  paragraphAlign: els.paragraphAlign,
  paragraphIndent: els.paragraphIndent,
  paragraphBefore: els.paragraphBefore,
  paragraphAfter: els.paragraphAfter,
  widows: els.widows,
  orphans: els.orphans,
  keepHeadings: els.keepHeadings
};

const writingControls = [
  els.blockStyle,
  els.boldButton,
  els.italicButton,
  els.underlineButton,
  els.bulletButton,
  els.numberButton,
  els.linkButton,
  els.unlinkButton,
  els.imageInput,
  els.undoButton,
  els.redoButton
];

const renderer = new StudioRenderer(els.frame);
let current = null;
let mode = "edit";
let renderTimer = null;
let cssTimer = null;
let savedRange = null;

function setStatus(message) {
  els.status.textContent = message;
}

function setInfo(message = "") {
  els.documentInfo.textContent = message;
}

function setDirty(value) {
  if (!current) return;
  current.dirty = Boolean(value);
  els.dirty.hidden = !current.dirty;
}

function isWritableEditMode() {
  return Boolean(current && !current.readOnly && mode === "edit");
}

function setDesignerEnabled(enabled) {
  els.designerControls.disabled = !enabled;
  els.pageControls.disabled = !enabled;
  els.paragraphControls.disabled = !enabled;
  els.resetDesigner.disabled = !enabled;
}

function setEditingState() {
  const loaded = Boolean(current);
  const writable = isWritableEditMode();
  const hasCss = loaded && Boolean(activeCssPath(current));

  for (const control of writingControls) control.disabled = !writable;

  els.markdownEditor.disabled = !loaded;
  els.markdownEditor.readOnly = !writable;
  els.cssEditor.disabled = !loaded;
  els.cssEditor.readOnly = !writable || !hasCss;

  els.saveButton.disabled = !loaded || current?.readOnly;
  els.printButton.disabled = !loaded;
  els.readModeButton.disabled = !loaded;
  els.editModeButton.disabled = !loaded || current?.readOnly;

  els.styleSelect.disabled = !writable || !current?.styles.length;
  els.newStyleButton.disabled = !writable || !current?.manifest;
  els.duplicateStyleButton.disabled = !writable || !hasCss;
  els.renameStyleButton.disabled = !writable || !hasCss;
  els.deleteStyleButton.disabled = !writable || current?.styles.length <= 1;

  setDesignerEnabled(Boolean(writable && hasCss));
  renderer.setEditable(writable);
}

function setMode(nextMode) {
  if (!current) return;
  mode = current.readOnly ? "read" : (nextMode === "read" ? "read" : "edit");
  document.body.classList.toggle("reading-mode", mode === "read");
  els.readModeButton.classList.toggle("is-active", mode === "read");
  els.editModeButton.classList.toggle("is-active", mode === "edit");
  renderer.setEditable(isWritableEditMode());
  setEditingState();
  setStatus(mode === "read" ? "Reading mode." : "Editing mode.");
}

function setInspectorTab(tab) {
  const design = tab === "design";
  els.designPanel.hidden = !design;
  els.sourcePanel.hidden = design;
  els.designTab.classList.toggle("is-active", design);
  els.sourceTab.classList.toggle("is-active", !design);
  els.designTab.setAttribute("aria-selected", String(design));
  els.sourceTab.setAttribute("aria-selected", String(!design));
}

function setSourceTab(tab) {
  const markdown = tab === "markdown";
  els.markdownEditor.hidden = !markdown;
  els.cssEditor.hidden = markdown;
  els.markdownTab.classList.toggle("is-active", markdown);
  els.cssTab.classList.toggle("is-active", !markdown);
  els.sourceLabel.textContent = markdown
    ? "root.md"
    : (activeCssPath(current) || "No active stylesheet");
}

function populateStyles() {
  els.styleSelect.innerHTML = "";

  if (!current?.styles.length) {
    els.styleSelect.add(new Option("No bundled styles", ""));
    setEditingState();
    return;
  }

  for (const style of current.styles) {
    els.styleSelect.add(new Option(style.label, style.id));
  }

  if (current.activeStyleId) els.styleSelect.value = current.activeStyleId;
  setEditingState();
}

async function loadActiveCss() {
  els.cssEditor.value = current ? await readActiveCss(current) : "";
  setSourceTab(els.cssTab.classList.contains("is-active") ? "css" : "markdown");
  setEditingState();
}

function article() {
  return els.frame.contentDocument?.querySelector(".mdocss-document") || null;
}

function rememberSelection() {
  if (!isWritableEditMode()) return;
  const doc = els.frame.contentDocument;
  const selection = doc?.getSelection();
  if (selection?.rangeCount && article()?.contains(selection.anchorNode)) {
    savedRange = selection.getRangeAt(0).cloneRange();
    const state = selectionState(doc);
    if (state?.blockTag && [...els.blockStyle.options].some(option => option.value === state.blockTag)) {
      els.blockStyle.value = state.blockTag;
    } else if (state?.blockTag === "li") {
      els.blockStyle.value = "p";
    }
  }
}

function restoreSelection() {
  const doc = els.frame.contentDocument;
  const root = article();
  if (!doc || !root) return false;

  root.focus();
  const selection = doc.getSelection();
  selection.removeAllRanges();

  if (savedRange && root.contains(savedRange.commonAncestorContainer)) {
    selection.addRange(savedRange);
    return true;
  }

  const range = doc.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  selection.addRange(range);
  savedRange = range.cloneRange();
  return true;
}

function syncMarkdownFromPaper() {
  if (!current || !isWritableEditMode()) return;
  const root = article();
  if (!root) return;

  const markdown = articleToMarkdown(root);
  els.markdownEditor.value = markdown;
  writeEditors(current, markdown, els.cssEditor.value);
  setDirty(true);
}

function bindPaperEvents() {
  const doc = els.frame.contentDocument;
  const root = article();
  if (!doc || !root) return;

  doc.execCommand("defaultParagraphSeparator", false, "p");

  doc.addEventListener("input", event => {
    if (root.contains(event.target) || event.target === root) {
      syncMarkdownFromPaper();
      rememberSelection();
    }
  }, true);

  root.dataset.documentoneEditorBound = "true";

  root.addEventListener("keyup", rememberSelection);
  root.addEventListener("mouseup", rememberSelection);
  doc.addEventListener("selectionchange", rememberSelection);

  root.addEventListener("paste", event => {
    if (!isWritableEditMode()) return;
    event.preventDefault();
    const text = event.clipboardData?.getData("text/plain") || "";
    insertText(doc, text);
    syncMarkdownFromPaper();
  });
}

async function render({ syncDesigner = false } = {}) {
  if (!current) return;

  try {
    renderer.setEditable(isWritableEditMode());
    const result = await renderer.render(
      els.markdownEditor.value,
      els.cssEditor.value
    );

    els.emptyState.hidden = true;
    els.frame.hidden = false;
    savedRange = null;
    bindPaperEvents();

    if (syncDesigner && !current.readOnly && activeCssPath(current)) {
      syncDesignerControls(designerControls, els.frame, result.css);
    }

    setStatus(current.readOnly
      ? "Recovery mode: canonical content is read-only."
      : (mode === "read" ? "Reading mode." : "Document ready."));
  } catch (error) {
    setStatus("Render error: " + error.message);
    console.error(error);
  }
}

function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => render().catch(console.error), 180);
}

async function applyCssLive({ syncDesigner = false } = {}) {
  if (!current) return;
  const path = activeCssPath(current);
  if (!path) return;

  current.zip.file(path, els.cssEditor.value);
  const css = await renderer.loadCss(path, new Set());
  const styleNode = els.frame.contentDocument?.querySelector("#mdocss-style");
  if (styleNode) styleNode.textContent = css;

  if (syncDesigner) {
    syncDesignerControls(designerControls, els.frame, css);
  }
}

function scheduleCssApply() {
  clearTimeout(cssTimer);
  cssTimer = setTimeout(() => {
    applyCssLive().catch(error => {
      setStatus("CSS error: " + error.message);
      console.error(error);
    });
  }, 100);
}

async function loadFile(file) {
  setStatus("Opening " + file.name + "…");

  try {
    current = await openPackage(file);
    renderer.setDocument(current);

    els.markdownEditor.value = current.markdown;
    await loadActiveCss();
    populateStyles();
    setDirty(false);

    const title = current.manifest?.title || current.fileName;
    setInfo(
      title + " · " + current.styles.length + " style" +
      (current.styles.length === 1 ? "" : "s")
    );

    mode = current.readOnly ? "read" : current.preferredMode;
    setMode(mode);
    setInspectorTab("design");
    setSourceTab("markdown");
    await render({ syncDesigner: true });

    if (current.readOnly) {
      setStatus(
        "Unsupported MDOCSS version " +
        (current.compatibility.version || "unknown") +
        "; canonical-content recovery mode."
      );
    }
  } catch (error) {
    renderer.revokeAssets();
    current = null;
    els.frame.hidden = true;
    els.emptyState.hidden = false;
    els.markdownEditor.value = "";
    els.cssEditor.value = "";
    els.styleSelect.innerHTML = "<option>No document loaded</option>";
    setDesignerEnabled(false);
    setEditingState();
    setInfo("");
    setStatus("Could not open document: " + error.message);
    console.error(error);
  }
}

async function switchStyle(styleId) {
  if (!current || !isWritableEditMode()) return;

  syncMarkdownFromPaper();
  writeEditors(current, els.markdownEditor.value, els.cssEditor.value);
  current.activeStyleId = styleId || null;
  await loadActiveCss();
  populateStyles();
  await applyCssLive({ syncDesigner: true });
  setDirty(true);

  const style = activeStyle(current);
  setStatus(style ? "Style: " + style.label : "No active stylesheet.");
}

function applyDesigner() {
  if (!current || !isWritableEditMode() || !activeCssPath(current)) return;

  els.cssEditor.value = applyManagedCss(
    els.cssEditor.value,
    readDesignerState(designerControls)
  );

  current.zip.file(activeCssPath(current), els.cssEditor.value);
  setDirty(true);
  scheduleCssApply();
}

function runPaperCommand(command, value = null) {
  if (!isWritableEditMode()) return;
  const doc = els.frame.contentDocument;
  if (!doc) return;

  restoreSelection();
  execInlineCommand(doc, command, value);
  rememberSelection();
  syncMarkdownFromPaper();
}

async function newDocument() {
  const state = defaultDesignerState();
  const file = await createNewPackage(buildManagedCss(state) + "\n");
  await loadFile(file);
  setDirty(true);
  setStatus("New DocumentOne document created locally.");
}

async function saveCopy() {
  if (!current || current.readOnly) return;
  if (mode === "edit") syncMarkdownFromPaper();

  setStatus("Building MDOCSS package…");
  const blob = await generatePackageBlob(
    current,
    els.markdownEditor.value,
    els.cssEditor.value
  );

  const name = current.fileName.toLowerCase().endsWith(".mdocss")
    ? current.fileName
    : current.fileName + ".mdocss";

  const url = URL.createObjectURL(blob);

  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.style.display = "none";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();

    setDirty(false);
    setStatus("Saved copy: " + name);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

async function createStyleFromScratch() {
  const label = window.prompt("Name the new document style:", "New Style");
  if (!label?.trim()) return;
  const id = await addStyle(
    current,
    label.trim(),
    buildManagedCss(defaultDesignerState()) + "\n"
  );
  current.activeStyleId = id;
  await loadActiveCss();
  populateStyles();
  await applyCssLive({ syncDesigner: true });
  setDirty(true);
}

async function duplicateStyle() {
  const source = activeStyle(current);
  if (!source) return;
  const label = window.prompt("Name the duplicated style:", source.label + " Copy");
  if (!label?.trim()) return;
  const id = await duplicateActiveStyle(current, label.trim());
  current.activeStyleId = id;
  await loadActiveCss();
  populateStyles();
  await applyCssLive({ syncDesigner: true });
  setDirty(true);
}

async function renameStyle() {
  const source = activeStyle(current);
  if (!source) return;
  const label = window.prompt("Rename document style:", source.label);
  if (!label?.trim()) return;
  if (renameActiveStyle(current, label.trim())) {
    populateStyles();
    setDirty(true);
  }
}

async function deleteStyle() {
  const source = activeStyle(current);
  if (!source || current.styles.length <= 1) return;
  if (!window.confirm('Delete the style "' + source.label + '"?')) return;
  if (deleteActiveStyle(current)) {
    await loadActiveCss();
    populateStyles();
    await applyCssLive({ syncDesigner: true });
    setDirty(true);
  }
}

async function insertImageFile(file) {
  if (!file || !isWritableEditMode()) return;

  const alt = window.prompt("Alternative text for the image:", "") ?? "";
  const caption = window.prompt("Caption (optional):", "") ?? "";
  const path = await addAsset(current, file);
  const blobUrl = await renderer.blobUrlFor(path);

  const doc = els.frame.contentDocument;
  restoreSelection();
  insertHtml(doc, imageFigureHtml({ src: path, alt, caption, blobUrl }));
  rememberSelection();
  syncMarkdownFromPaper();
  setStatus("Inserted " + path + ".");
}

els.newButton.addEventListener("click", () => {
  newDocument().catch(error => {
    setStatus("Could not create document: " + error.message);
    console.error(error);
  });
});

els.fileInput.addEventListener("change", () => {
  const [file] = els.fileInput.files || [];
  if (file) loadFile(file);
});

els.saveButton.addEventListener("click", () => {
  saveCopy().catch(error => {
    setStatus("Could not save document: " + error.message);
    console.error(error);
  });
});

els.printButton.addEventListener("click", () => {
  if (!current) return;
  if (mode === "edit") syncMarkdownFromPaper();
  renderer.print();
});

els.readModeButton.addEventListener("click", () => setMode("read"));
els.editModeButton.addEventListener("click", () => setMode("edit"));

els.designTab.addEventListener("click", () => setInspectorTab("design"));
els.sourceTab.addEventListener("click", () => setInspectorTab("source"));
els.markdownTab.addEventListener("click", () => setSourceTab("markdown"));
els.cssTab.addEventListener("click", () => setSourceTab("css"));

els.blockStyle.addEventListener("change", () => {
  if (!isWritableEditMode()) return;
  const doc = els.frame.contentDocument;
  restoreSelection();
  setBlockType(doc, els.blockStyle.value);
  rememberSelection();
  syncMarkdownFromPaper();
});

els.boldButton.addEventListener("click", () => runPaperCommand("bold"));
els.italicButton.addEventListener("click", () => runPaperCommand("italic"));
els.underlineButton.addEventListener("click", () => runPaperCommand("underline"));
els.bulletButton.addEventListener("click", () => runPaperCommand("insertUnorderedList"));
els.numberButton.addEventListener("click", () => runPaperCommand("insertOrderedList"));
els.undoButton.addEventListener("click", () => runPaperCommand("undo"));
els.redoButton.addEventListener("click", () => runPaperCommand("redo"));

els.linkButton.addEventListener("click", () => {
  if (!isWritableEditMode()) return;
  const href = window.prompt("Link URL:", "https://");
  if (!href) return;
  const doc = els.frame.contentDocument;
  restoreSelection();
  createLink(doc, href);
  rememberSelection();
  syncMarkdownFromPaper();
});

els.unlinkButton.addEventListener("click", () => {
  if (!isWritableEditMode()) return;
  const doc = els.frame.contentDocument;
  restoreSelection();
  unlink(doc);
  rememberSelection();
  syncMarkdownFromPaper();
});

els.imageInput.addEventListener("change", () => {
  const [file] = els.imageInput.files || [];
  if (file) {
    insertImageFile(file).catch(error => {
      setStatus("Could not insert image: " + error.message);
      console.error(error);
    });
  }
  els.imageInput.value = "";
});

els.markdownEditor.addEventListener("input", () => {
  if (!isWritableEditMode()) return;
  setDirty(true);
  current.markdown = els.markdownEditor.value;
  current.zip.file("root.md", current.markdown);
  scheduleRender();
});

els.cssEditor.addEventListener("input", () => {
  if (!isWritableEditMode() || !activeCssPath(current)) return;
  setDirty(true);
  current.zip.file(activeCssPath(current), els.cssEditor.value);
  scheduleCssApply();
});

els.styleSelect.addEventListener("change", () => {
  switchStyle(els.styleSelect.value).catch(error => {
    setStatus("Could not switch style: " + error.message);
    console.error(error);
  });
});

els.newStyleButton.addEventListener("click", () => createStyleFromScratch().catch(console.error));
els.duplicateStyleButton.addEventListener("click", () => duplicateStyle().catch(console.error));
els.renameStyleButton.addEventListener("click", () => renameStyle().catch(console.error));
els.deleteStyleButton.addEventListener("click", () => deleteStyle().catch(console.error));

for (const control of Object.values(designerControls)) {
  control.addEventListener("input", applyDesigner);
  control.addEventListener("change", applyDesigner);
}

els.resetDesigner.addEventListener("click", () => {
  if (!current || !isWritableEditMode() || !activeCssPath(current)) return;

  els.cssEditor.value = stripManagedCss(els.cssEditor.value) + "\n";
  current.zip.file(activeCssPath(current), els.cssEditor.value);
  setDirty(true);
  applyCssLive({ syncDesigner: true }).catch(console.error);
});

for (const eventName of ["dragenter", "dragover"]) {
  els.dropZone.addEventListener(eventName, event => {
    event.preventDefault();
    els.dropZone.classList.add("dragging");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  els.dropZone.addEventListener(eventName, event => {
    event.preventDefault();
    els.dropZone.classList.remove("dragging");
  });
}

els.dropZone.addEventListener("drop", event => {
  const [file] = event.dataTransfer?.files || [];
  if (file) loadFile(file);
});

window.addEventListener("beforeunload", event => {
  renderer.revokeAssets();
  if (current?.dirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});

setInspectorTab("design");
setSourceTab("markdown");
setDesignerEnabled(false);
setEditingState();
