import test from "node:test";
import assert from "node:assert/strict";
import {
  MANAGED_BEGIN,
  MANAGED_END,
  applyManagedCss,
  buildManagedCss,
  defaultDesignerState,
  stripManagedCss
} from "../apps/studio/src/style-designer.js";

test("DocumentOne designer emits standard CSS paged-media controls", () => {
  const css = buildManagedCss(defaultDesignerState());
  assert.match(css, /@page\s*\{/);
  assert.match(css, /size:\s*letter/);
  assert.match(css, /@top-right/);
  assert.match(css, /counter\(page\)/);
  assert.match(css, /orphans:\s*2/);
  assert.match(css, /widows:\s*2/);
  assert.match(css, /break-after:\s*avoid/);
});

test("DocumentOne designer preserves CSS outside its managed override block", () => {
  const original = [
    ".custom-rule { border: 3px solid rebeccapurple; }",
    "",
    MANAGED_BEGIN,
    ".old { color: red; }",
    MANAGED_END,
    "",
    ".after { display: grid; }"
  ].join("\n");

  const state = defaultDesignerState();
  state.fontSize = 14;
  const changed = applyManagedCss(original, state);

  assert.match(changed, /\.custom-rule \{ border: 3px solid rebeccapurple; \}/);
  assert.match(changed, /\.after \{ display: grid; \}/);
  assert.match(changed, /font-size:\s*14pt/);
  assert.equal((changed.match(/MDOCSS DocumentOne managed overrides: begin/g) || []).length, 1);
});

test("DocumentOne managed overrides can be removed without deleting author CSS", () => {
  const authorCss = ".author { color: navy; }";
  const combined = authorCss + "\n\n" + buildManagedCss(defaultDesignerState());
  assert.equal(stripManagedCss(combined), authorCss);
});
