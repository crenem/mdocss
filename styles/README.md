# MDOCSS Reference Style Library

This directory contains optional reference styles for the MDOCSS Core Semantic Class Profile.

These files are **not part of the core container requirements**. They demonstrate how one semantic document can be rendered for different academic, organizational, reading, and accessibility contexts without changing `root.md`.

## Academic profiles

### APA 7 student paper

`apa7-student.css` implements common page-layout and typography conventions for APA 7 student papers: one-inch margins, double spacing, left-aligned body text, half-inch first-line indents, a centered title page, and hanging indents for references.

The stylesheet uses 12-point Times New Roman as one permitted APA font choice. APA permits several other legible fonts.

Profile identifier:

```text
org.mdocss.apa7.student
```

### MLA 9 research paper

`mla9.css` implements common MLA 9 research-paper presentation: one-inch margins, double spacing, a readable 12-point typeface, half-inch paragraph indents, a first-page heading rather than a mandatory separate title page, and hanging indents for Works Cited entries.

Profile identifier:

```text
org.mdocss.mla9
```

### Chicago 18 manuscript

`chicago18-manuscript.css` implements a conventional manuscript presentation informed by current Chicago manuscript-preparation guidance: one-inch margins, 12-point readable type, double spacing, and manuscript-oriented title-page treatment.

Profile identifier:

```text
org.mdocss.chicago18.manuscript
```

## General profiles

- `business-report.css` — structured professional report.
- `clean-reading.css` — comfortable screen reading.
- `dark-reading.css` — dark screen reading.
- `accessible-large-print.css` — large type, generous spacing, high legibility.

## Important limitation

A stylesheet can control presentation, but it cannot make the underlying writing compliant with a citation or editorial standard.

For example, `apa7-student.css` can provide margins, spacing, title-page layout, heading presentation, and hanging references. It cannot determine whether an in-text citation is correct, whether a source entry contains the required bibliographic elements, or whether an instructor has imposed additional requirements.

The reference styles use standard CSS Paged Media for page size/margins, page counters, break control, widows/orphans, and table fragmentation. Current Chromium/Electron print engines support `@page` margin boxes and the `page` / `pages` counters, so the reference readers can generate page numbers without an MDOCSS-specific pagination layer.

Dynamic running heads derived from document content remain less portable than page counters. Profiles therefore degrade conservatively rather than pretending to provide editorial features the active renderer cannot support.

## Sources consulted for the reference academic layouts

- APA: https://www.apa.org/ed/precollege/psn/2020/09/apa-style-student-papers
- MLA: https://style.mla.org/app/uploads/sites/3/2020/12/Formatting-a-Research-Paper_v3_-The-MLA-Style-Center.pdf
- MLA headings: https://style.mla.org/styling-headings-and-subheadings/
- Chicago manuscript margins: https://www.chicagomanualofstyle.org/qanda/data/faq/topics/ManuscriptPreparation/faq0221.html
- Chicago manuscript spacing/type: https://www.chicagomanualofstyle.org/qanda/data/faq/topics/ManuscriptPreparation/faq0163.html

These reference styles are implementation aids and are not endorsed by, or substitutes for, the corresponding style manuals.
