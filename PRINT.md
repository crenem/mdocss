# MDOCSS Print and Paged-Media Guidance

MDOCSS stylesheets may target both screen and print. The core format does not require a particular PDF engine, browser, or paged-media implementation.

## 1. Physical page profiles

Print-oriented styles MAY use physical dimensions such as inches, points, or centimeters.

For example:

```css
@page {
  size: letter;
  margin: 1in;
}
```

A screen-oriented reader should still allow the document to remain readable if the rendering engine ignores `@page`.

## 2. Page breaks

Portable styles SHOULD use modern break properties:

```css
.mdocss-title-page {
  break-after: page;
}

.mdocss-references {
  break-before: page;
}

.mdocss-figure,
.mdocss-table {
  break-inside: avoid;
}
```

Legacy `page-break-*` aliases MAY be added for older engines, but MDOCSS does not require them.

## 3. Generated page numbers and running headers

Support for paged-media margin boxes and generated page numbers varies among rendering engines.

A portable MDOCSS stylesheet SHOULD NOT assume that browser print engines can generate every running header or page-number convention required by an academic or publishing style.

Applications with richer paged-media engines MAY add page numbers and running headers at render/export time without changing `root.md`.

## 4. Print-safe colors

Screen styles SHOULD provide a reasonable print fallback when dark backgrounds, decorative colors, or shadows would reduce print legibility.

For example:

```css
@media print {
  .mdocss-document {
    color: #000;
    background: #fff;
    box-shadow: none;
  }
}
```

## 5. Assets

Readers SHOULD preserve image proportions when printing.

Styles SHOULD use `max-width: 100%` or another responsive constraint for ordinary figures so that an oversized image does not force content outside the printable area.

## 6. Fonts

A document MUST remain readable when a preferred font is unavailable.

Styles SHOULD provide fallback font families.

Embedded font assets are optional. A reader that cannot or will not load them should fall back without making canonical content inaccessible.

## 7. Academic reference styles

The APA, MLA, and Chicago reference styles in `styles/` model common physical-page conventions, but CSS alone cannot guarantee full compliance with an editorial style guide.

Citation correctness, source completeness, pagination behavior, and instructor/publisher-specific requirements remain outside the stylesheet's authority.

## 8. Print preview

A reader SHOULD expose the host platform's normal print preview when practical.

The reference browser viewer and Obsidian reader invoke the browser/Electron print path rather than defining a proprietary print file format.
