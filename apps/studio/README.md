# MDOCSS Studio — Portable Web Editor

MDOCSS Studio is the zero-install web editor for MDOCSS documents.

The release artifact is a single self-contained file:

\`\`\`text
artifacts/MDOCSS-Studio.html
\`\`\`

Open it directly in a modern browser. No web server, Node.js runtime, installer, CDN, or network connection is required at runtime.

## Current MVP

The first vertical slice supports:

- create a new 1.0 MDOCSS package;
- open or drag/drop an existing \`.mdocss\` file;
- edit canonical \`root.md\`;
- edit the active stylesheet as raw CSS;
- live sanitized preview in a script-free sandboxed iframe;
- local package images/media/fonts through blob URLs;
- automatic blocking of remote document resources;
- switch among declared document styles;
- visual style controls for:
  - body font;
  - font size;
  - line height;
  - text and page colors;
  - Letter, A4, or printer-selected page size;
  - uniform physical page margins;
  - page-number placement;
  - paragraph first-line indent;
  - widows and orphans;
  - heading keep-with-next behavior;
- print through the browser's physical print/PDF engine;
- rebuild and download an edited MDOCSS package;
- preserve archive members the editor does not understand;
- read-only canonical-content recovery for unsupported future major versions.

## Style Designer preservation model

The visual Style Designer does not regenerate or normalize the entire stylesheet.

It writes one clearly delimited override region:

\`\`\`css
/* MDOCSS Studio managed overrides: begin */
/* generated standard CSS */
/* MDOCSS Studio managed overrides: end */
\`\`\`

CSS outside that region is preserved byte-for-byte at the text level when the designer updates its managed settings.

Users can always switch to the **CSS** tab to inspect or edit the actual stylesheet.

The managed block uses ordinary CSS, including standard CSS Paged Media. Other MDOCSS readers do not need to understand MDOCSS Studio to render the resulting stylesheet.

## Build

From the repository root:

\`\`\`bash
npm install
npm run build:studio
\`\`\`

The build uses esbuild to bundle JavaScript dependencies, then inlines the compiled JavaScript and application CSS into the HTML shell.

The build fails if the resulting artifact still contains an external script or stylesheet reference.

## Runtime security

Application JavaScript is trusted editor code.

Document content is untrusted and is rendered separately in a sandboxed iframe. The document frame:

- does not receive \`allow-scripts\`;
- permits \`allow-same-origin\` for controlled package-local blob resources;
- permits \`allow-modals\` for the explicit Print command;
- uses a restrictive Content Security Policy;
- strips or blocks automatic remote document-resource loads.

The application itself never needs to upload a document.

## Saving

The portable local-HTML version uses a browser download for its universal save path:

\`\`\`text
Open → Edit → Save Copy → document.mdocss
\`\`\`

This works without privileged filesystem access.

A hosted HTTPS version may later add File System Access API integration where available, but direct filesystem overwrite is not required for the portable single-file editor.

## Next milestones

The MVP intentionally establishes the durable core before richer authoring UX.

Planned work includes:

1. structured Markdown editing commands and toolbar;
2. style creation, duplication, rename, and deletion;
3. semantic-role-specific design panels;
4. asset manager;
5. document/manifest metadata editor;
6. Continuous / Print Layout preview;
7. direct Save / Save As when the browser grants file-handle access;
8. undo/redo history spanning source and designer operations;
9. reusable style-library import/export;
10. accessibility and keyboard workflow audit.

The desktop editor should reuse these modules rather than fork the format logic.
