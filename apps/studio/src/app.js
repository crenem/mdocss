import {
  activeCssPath,
  activeStyle,
  createNewPackage,
  generatePackageBlob,
  openPackage,
  readActiveCss,
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

const $ = selector => document.querySelector(selector);

const els = {
  newButton: $("#new-button"),
  fileInput: $("#file-input"),
  saveButton: $("#save-button"),
  printButton: $("#print-button"),
  markdownTab: $("#markdown-tab"),
  cssTab: $("#css-tab"),
  markdownEditor: $("#markdown-editor"),
  cssEditor: $("#css-editor"),
  sourceLabel: $("#source-label"),
  dirty: $("#dirty-indicator"),
  styleSelect: $("#style-select"),
  dropZone: $("#drop-zone"),
  emptyState: $("#empty-state"),
  frame: $("#document-frame"),
  status: $("#status"),
  documentInfo: $("#document-info"),
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
  paragraphIndent: $("#paragraph-indent"),
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
  paragraphIndent: els.paragraphIndent,
  widows: els.widows,
  orphans: els.orphans,
  keepHeadings: els.keepHeadings
};

const renderer = new StudioRenderer(els.frame);
let current = null;
let renderTimer = null;

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

function setDesignerEnabled(enabled) {
  els.designerControls.disabled = !enabled;
  els.pageControls.disabled = !enabled;
  els.paragraphControls.disabled = !enabled;
  els.resetDesigner.disabled = !enabled;
}

function setEditingState() {
  const loaded = Boolean(current);
  const readOnly = current?.readOnly || false;
  const hasCss = loaded && Boolean(activeCssPath(current));

  els.markdownEditor.disabled = !loaded;
  els.markdownEditor.readOnly = readOnly;
  els.cssEditor.disabled = !loaded;
  els.cssEditor.readOnly = readOnly || !hasCss;
  els.saveButton.disabled = !loaded || readOnly;
  els.printButton.disabled = !loaded;
  setDesignerEnabled(Boolean(hasCss && !readOnly));
}

function setTab(tab) {
  const markdown = tab === "markdown";
  els.markdownEditor.hidden = !markdown;
  els.cssEditor.hidden = markdown;
  els.markdownTab.classList.toggle("is-active", markdown);
  els.cssTab.classList.toggle("is-active", !markdown);
  els.markdownTab.setAttribute("aria-selected", String(markdown));
  els.cssTab.setAttribute("aria-selected", String(!markdown));
  els.sourceLabel.textContent = markdown
    ? "root.md"
    : (activeCssPath(current) || "No active stylesheet");
}

function populateStyles() {
  els.styleSelect.innerHTML = "";

  if (!current?.styles.length) {
    els.styleSelect.add(new Option("No bundled styles", ""));
    els.styleSelect.disabled = true;
    return;
  }

  for (const style of current.styles) {
    els.styleSelect.add(new Option(style.label, style.id));
  }

  els.styleSelect.disabled = current.readOnly;
  if (current.activeStyleId) els.styleSelect.value = current.activeStyleId;
}

async function loadActiveCss() {
  els.cssEditor.value = current ? await readActiveCss(current) : "";
  setEditingState();
  setTab(els.cssTab.classList.contains("is-active") ? "css" : "markdown");
}

async function render({ syncDesigner = false } = {}) {
  if (!current) return;

  try {
    const result = await renderer.render(
      els.markdownEditor.value,
      els.cssEditor.value
    );

    els.emptyState.hidden = true;
    els.frame.hidden = false;

    if (syncDesigner && !current.readOnly && activeCssPath(current)) {
      syncDesignerControls(designerControls, els.frame, result.css);
    }

    setStatus(current.readOnly
      ? "Recovery mode: canonical content is read-only."
      : "Preview updated.");
  } catch (error) {
    setStatus("Preview error: " + error.message);
    console.error(error);
  }
}

function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => render().catch(console.error), 180);
}

async function loadFile(file) {
  setStatus("Opening " + file.name + "…");

  try {
    current = await openPackage(file);
    renderer.setDocument(current);

    els.markdownEditor.value = current.markdown;
    await loadActiveCss();
    populateStyles();
    setEditingState();
    setTab("markdown");
    setDirty(false);

    const title = current.manifest?.title || current.fileName;
    setInfo(
      title + " · " + current.styles.length + " style" +
      (current.styles.length === 1 ? "" : "s")
    );

    if (current.readOnly) {
      setStatus(
        "Unsupported MDOCSS version " +
        (current.compatibility.version || "unknown") +
        "; canonical-content recovery mode."
      );
    }

    await render({ syncDesigner: true });
  } catch (error) {
    renderer.revokeAssets();
    current = null;
    els.frame.hidden = true;
    els.emptyState.hidden = false;
    els.markdownEditor.value = "";
    els.cssEditor.value = "";
    els.styleSelect.innerHTML = "<option>No document loaded</option>";
    els.styleSelect.disabled = true;
    setDesignerEnabled(false);
    setEditingState();
    setInfo("");
    setStatus("Could not open document: " + error.message);
    console.error(error);
  }
}

async function switchStyle(styleId) {
  if (!current || current.readOnly) return;

  writeEditors(current, els.markdownEditor.value, els.cssEditor.value);
  current.activeStyleId = styleId || null;
  await loadActiveCss();
  await render({ syncDesigner: true });

  const style = activeStyle(current);
  setStatus(style ? "Style: " + style.label : "No active stylesheet.");
}

function markAndRender() {
  if (!current || current.readOnly) return;
  setDirty(true);
  scheduleRender();
}

function applyDesigner() {
  if (!current || current.readOnly || !activeCssPath(current)) return;

  els.cssEditor.value = applyManagedCss(
    els.cssEditor.value,
    readDesignerState(designerControls)
  );

  current.zip.file(activeCssPath(current), els.cssEditor.value);
  setDirty(true);
  scheduleRender();
}

async function newDocument() {
  const state = defaultDesignerState();
  const file = await createNewPackage(buildManagedCss(state) + "\n");
  await loadFile(file);
  setDirty(true);
  setStatus("New document created locally.");
}

async function saveCopy() {
  if (!current || current.readOnly) return;

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
  writeEditors(current, els.markdownEditor.value, els.cssEditor.value);
  renderer.print();
});

els.markdownTab.addEventListener("click", () => setTab("markdown"));
els.cssTab.addEventListener("click", () => setTab("css"));

els.markdownEditor.addEventListener("input", markAndRender);
els.cssEditor.addEventListener("input", markAndRender);

els.styleSelect.addEventListener("change", () => {
  switchStyle(els.styleSelect.value).catch(error => {
    setStatus("Could not switch style: " + error.message);
    console.error(error);
  });
});

for (const control of Object.values(designerControls)) {
  control.addEventListener("input", applyDesigner);
  control.addEventListener("change", applyDesigner);
}

els.resetDesigner.addEventListener("click", () => {
  if (!current || current.readOnly || !activeCssPath(current)) return;

  els.cssEditor.value = stripManagedCss(els.cssEditor.value) + "\n";
  current.zip.file(activeCssPath(current), els.cssEditor.value);
  setDirty(true);
  render({ syncDesigner: true }).catch(console.error);
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

setTab("markdown");
setDesignerEnabled(false);
setEditingState();
