# MDOCSS Print and Paged-Media Guidance

MDOCSS uses standard CSS Paged Media for pagination. The core format does not invent page-break syntax, page-number fields, or a proprietary page model.

A document remains canonical Markdown plus replaceable CSS. Pagination is presentation.

## 1. Pagination model

A print-oriented stylesheet MAY use standard paged-media rules, including:

- `@page`;
- physical or host-selected page sizes;
- page margins;
- page-margin boxes such as `@top-right` and `@bottom-center`;
- the predefined `page` and `pages` counters;
- `break-before`, `break-after`, and `break-inside`;
- `widows` and `orphans`;
- named pages and other standard paged-media features where the rendering engine supports them.

MDOCSS readers MUST NOT require pagination metadata in `manifest.json` to use these CSS features.

A reader that exposes printing SHOULD preserve supported paged-media rules from the active document stylesheet rather than replacing them with application-specific pagination instructions.

## 2. Physical page profiles

Print-oriented styles MAY use physical dimensions such as inches, points, millimeters, or centimeters.

For example:

```css
@page {
  size: letter;
  margin: 1in;
}
```

A profile intended to follow a specific paper convention MAY choose a fixed page size. A general-purpose profile MAY use `size: auto` so the host print dialog determines Letter, A4, or another target.

A screen-oriented reader must remain usable when its normal continuous view does not visually reproduce page boxes.

## 3. Page numbers

Page numbers are presentation. They MUST NOT be inserted into `root.md` merely to support printed pagination.

Where supported, a stylesheet can generate page numbers using standard page-margin boxes:

```css
@page {
  margin: 1in;

  @top-right {
    content: counter(page);
  }
}
```

A footer may include both the current and total page count:

```css
@page {
  @bottom-center {
    content: "Page " counter(page) " of " counter(pages);
  }
}
```

The reference Chromium/Electron readers use the host print engine, which supports page-margin boxes and the `page` / `pages` counters. Other rendering engines may provide less complete support.

If the host print dialog also supplies browser-generated headers or footers, users may need to disable those controls to avoid duplicating stylesheet-authored margin content.

## 4. Running headers

Static running text can be placed directly in a page-margin box.

Dynamic running headers derived from document content require generated-content features such as named strings. Support for those features is less consistent than page counters.

A portable MDOCSS stylesheet SHOULD therefore degrade acceptably when a dynamic running header is unavailable. Applications with richer paged-media engines MAY provide additional generated running heads without changing `root.md`.

The MLA reference profile, for example, provides portable page numbering but does not attempt to infer an author's surname from canonical content.

## 5. Page breaks

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

Headings SHOULD generally avoid a break immediately after the heading when practical:

```css
h1,
h2,
h3 {
  break-after: avoid;
}
```

Legacy `page-break-*` aliases MAY be added for older engines, but MDOCSS does not require them.

MDOCSS does not define a proprietary Markdown page-break token. Where an author requires an explicit one-off break and the selected Markdown profile permits inline HTML, ordinary HTML/CSS may be used, for example:

```html
<div style="break-before: page"></div>
```

An application MAY provide a UI for authoring such standards-based presentation instructions.

## 6. Widows and orphans

Print styles SHOULD use `widows` and `orphans` for ordinary paragraphs and list items where supported.

For example:

```css
p,
li {
  orphans: 3;
  widows: 3;
}
```

These are layout preferences rather than guarantees. A renderer may need to violate them when no legal fragmentation solution exists.

## 7. Tables, figures, and repeated table headers

Figures, tables, captions, reference entries, and short block quotations SHOULD avoid internal page breaks when doing so does not create excessive blank space.

For tables that span multiple pages, authors SHOULD use semantic `<thead>` markup. Print styles MAY use:

```css
thead {
  display: table-header-group;
}
```

so capable engines repeat the header when the table fragments across pages.

A very large figure or table may still need to fragment, scale, or overflow according to the rendering engine and active stylesheet.

## 8. Assets

Readers SHOULD preserve image proportions when printing.

Styles SHOULD use `max-width: 100%` or another responsive constraint for ordinary figures so that an oversized image does not force content outside the printable area.

## 9. Fonts and pagination stability

Pagination depends on font metrics.

A document MUST remain readable when a preferred font is unavailable, and styles SHOULD provide fallback font families. A fallback font can change line wrapping and therefore page boundaries.

For that reason, MDOCSS 1.0 does **not** define identical page count, line breaks, or element-to-page assignment across unrelated rendering engines as a conformance requirement.

Two conforming readers can paginate the same semantic document differently while still honoring the same page size, margins, break constraints, and other supported CSS rules.

When exact final pagination is legally or editorially significant, the selected rendering/export engine and available fonts become part of the publication workflow.

## 10. Print-safe colors

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

## 11. Academic reference styles

The APA, MLA, and Chicago reference styles in `styles/` model common physical-page conventions and now include portable page counters and fragmentation controls.

CSS cannot determine whether the underlying writing is compliant with an editorial style guide. Citation correctness, source completeness, dynamic running-head requirements, and instructor/publisher-specific rules remain outside the stylesheet's authority.

The reference styles are demonstrations of the MDOCSS presentation model, not endorsement or certification by the organizations associated with those styles.

## 12. Screen pagination versus print pagination

A continuous screen reader and a print renderer solve different problems.

The normative pagination contract is the CSS used for paged media. A reader MAY additionally provide a screen **Print Layout** or paginated preview, but such a preview is an application feature and MUST NOT mutate canonical Markdown.

If a screen pagination preview uses a pagination polyfill or a different rendering engine, the application SHOULD identify it as a preview rather than promise byte-for-byte or page-for-page identity with every external printer.

The host print/PDF engine remains the reference implementation's authoritative physical-page renderer.

## 13. Print preview

A reader SHOULD expose the host platform's normal print preview when practical.

The reference browser viewer and Obsidian reader invoke the browser/Electron print path rather than defining a proprietary print file format.
