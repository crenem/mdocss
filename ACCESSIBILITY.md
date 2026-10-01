# MDOCSS Accessibility Guidance

MDOCSS separates semantic content from presentation. That separation is useful only if alternate presentations preserve access to the same information.

This document defines guidance for MDOCSS readers, editors, and stylesheet authors. It complements the core specification; it does not create a separate accessibility-only document format.

## 1. Preserve semantic content

A stylesheet MUST NOT make essential document information available only through color, animation, background imagery, or another presentation feature.

Readers SHOULD preserve native HTML semantics produced from Markdown and the MDOCSS Core Semantic Class Profile.

CSS may change appearance, but it should not change the meaning or reading order of the canonical document.

## 2. Images and alternative text

MDOCSS uses ordinary Markdown image semantics.

Authors should provide meaningful alternative text when an image conveys information:

```markdown
![Quarterly housing placements increased from 42 to 61.](assets/placements-chart.png)
```

Decorative images may use empty alternative text when appropriate:

```markdown
![](assets/decorative-rule.svg)
```

A reader SHOULD preserve the resulting `alt` attribute.

A stylesheet cannot repair missing alternative text and MUST NOT replace authored alternative text with presentation-specific text.

## 3. Keyboard operation

Any reader UI for selecting a stylesheet, opening a document, printing, or editing package content SHOULD be fully keyboard operable.

The reference browser viewer and Obsidian reader use native form controls for stylesheet selection.

Changing presentation MUST NOT move keyboard focus unexpectedly into the document or reset the user's reading position when an implementation can avoid doing so.

## 4. Focus visibility

Styles SHOULD preserve a clearly visible keyboard focus indicator.

Authors of reference styles should prefer `:focus-visible` rather than removing outlines.

A stylesheet MUST NOT use `outline: none` on interactive content unless it supplies an equally visible replacement.

## 5. Contrast and forced colors

Styles SHOULD maintain strong foreground/background contrast.

Styles SHOULD remain usable when the operating system or browser activates a forced-colors/high-contrast mode.

Do not encode meaning by color alone.

The reference large-print profile includes an explicit `forced-colors` adjustment, while the other reference profiles avoid relying on color as their only semantic signal.

## 6. Type size and reflow

Reader implementations SHOULD allow browser/application zoom to work normally.

Styles SHOULD avoid fixed viewport dimensions that prevent reflow.

For reading profiles, prefer line-length constraints such as `ch` or responsive maximum widths over a fixed physical page width.

Physical dimensions such as inches are appropriate for print-oriented profiles but should still degrade reasonably on narrow screens.

## 7. Reduced motion

MDOCSS does not require animation.

If a style introduces animation or transition effects, it SHOULD honor:

```css
@media (prefers-reduced-motion: reduce) {
  .mdocss-document *,
  .mdocss-document *::before,
  .mdocss-document *::after {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
}
```

Essential information MUST NOT depend on motion.

## 8. Tables

Use normal Markdown/HTML table structure where appropriate.

Styles SHOULD preserve visible differentiation between header and data cells without depending exclusively on color.

Readers SHOULD not flatten semantic table markup merely to achieve a visual layout.

## 9. Links

Links SHOULD remain distinguishable from surrounding text by more than color alone, normally through underlining or another persistent visual indicator.

External resources are subject to the reader's security policy, but security blocking should not silently remove the visible link text.

## 10. Alternate presentation as an accessibility feature

A major MDOCSS design benefit is that the same canonical document can ship with multiple presentations.

For example, a package may include:

- an academic print profile;
- a clean reading profile;
- a dark reading profile;
- a large-print profile.

A user may switch among those views without altering `root.md`.

Reader-local style preference is presentation state and should not rewrite the author-defined default.

## 11. Reference accessibility profile

The repository includes:

```text
org.mdocss.accessibility.large-print
```

This is a reference presentation, not a certification of conformance with every accessibility standard or every individual's needs.

Applications should treat user-controlled zoom, platform accessibility settings, assistive technology, and alternate styles as complementary capabilities.
