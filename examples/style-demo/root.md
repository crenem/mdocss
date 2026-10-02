<section class="mdocss-title-page">
  <h1 class="mdocss-title">One Document, Many Presentations</h1>
  <p class="mdocss-subtitle">MDOCSS Reference Style Demonstration</p>
  <p class="mdocss-author">Example Author</p>
  <p class="mdocss-affiliation">Example University</p>
  <p class="mdocss-course">DOC 100: Portable Documents</p>
  <p class="mdocss-instructor">Professor Example</p>
  <p class="mdocss-date">October 1, 2026</p>
</section>

<section class="mdocss-abstract">
  <h2 class="mdocss-abstract-title">Abstract</h2>
  <p>This package demonstrates that presentation can change without changing the canonical Markdown content. Academic, professional, reading, dark, and large-print profiles all operate on the same semantic document.</p>
  <p class="mdocss-keywords"><strong>Keywords:</strong> portability, Markdown, CSS, semantics</p>
</section>

# Introduction

MDOCSS treats Markdown as canonical semantic content and CSS as replaceable presentation. A reader can change the active stylesheet without rewriting this paragraph.

The ordinary document structure continues to use ordinary Markdown. Semantic classes are reserved for roles that Markdown cannot identify reliably.

## Portable Semantics

A title, an author, an abstract, and a reference entry have meanings that are independent of whether the document is being presented as an academic manuscript, a business report, or a comfortable reading view.

> Presentation is a view of the document, not ownership of the document.

<section class="mdocss-references">
  <h1>References</h1>
  <p class="mdocss-reference">Example, A. (2026). <em>Portable documents and semantic presentation</em>. Example Press.</p>
  <p class="mdocss-reference">Writer, B. (2025). Separation of content and presentation. <em>Journal of Open Documents, 10</em>(2), 1–10.</p>
</section>


# Semantic Components

<figure class="mdocss-figure">
  <div class="mdocss-figure-label">Figure 1</div>
  <figcaption class="mdocss-caption">A semantic figure can be restyled without changing its role.</figcaption>
  <div aria-hidden="true">Content → Semantics → Presentation</div>
  <p class="mdocss-source-note">Note. Demonstration figure generated as text so the example remains asset-free.</p>
</figure>

<section class="mdocss-table">
  <div class="mdocss-table-label">Table 1</div>
  <div class="mdocss-caption">MDOCSS layers</div>
  <table>
    <thead>
      <tr><th>Layer</th><th>Portable representation</th></tr>
    </thead>
    <tbody>
      <tr><td>Content</td><td>Markdown</td></tr>
      <tr><td>Presentation</td><td>CSS</td></tr>
      <tr><td>Metadata</td><td>JSON</td></tr>
      <tr><td>Container</td><td>ZIP</td></tr>
    </tbody>
  </table>
  <p class="mdocss-source-note">Note. The table uses ordinary HTML table semantics inside an MDOCSS role container.</p>
</section>

<section class="mdocss-footnotes">
  <h1>Notes</h1>
  <p class="mdocss-footnote">1. A reader may expose richer note navigation while preserving this semantic role.</p>
  <p class="mdocss-note">Author note. This document exists to exercise the portable semantic profile.</p>
</section>

<section class="mdocss-appendices">
  <section class="mdocss-appendix">
    <div class="mdocss-appendix-label">Appendix A</div>
    <h1 class="mdocss-appendix-title">Interoperability Principle</h1>
    <p>The same semantic source should remain intelligible when presentation support is absent.</p>
  </section>
</section>
