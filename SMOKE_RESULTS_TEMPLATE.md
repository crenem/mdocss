# MDOCSS Runtime Smoke-Test Results

Copy this template into GitHub issue #2 after completing `SMOKE_TEST.md`.

## Environment

- MDOCSS commit:
- Date tested:
- Operating system:
- Browser and version:
- Obsidian version:
- Obsidian installer/channel, if relevant:

## Browser viewer

| Check | Result | Notes |
| --- | --- | --- |
| Viewer opens locally | ☐ Pass ☐ Fail | |
| Minimal/basic package renders | ☐ Pass ☐ Fail | |
| Semantic multi-style package renders | ☐ Pass ☐ Fail | |
| Seven-profile style demo renders | ☐ Pass ☐ Fail | |
| All seven profiles selectable | ☐ Pass ☐ Fail | |
| Style switching is immediate | ☐ Pass ☐ Fail | |
| Canonical text unchanged | ☐ Pass ☐ Fail | |
| Local Markdown asset resolves | ☐ Pass ☐ Fail | |
| Local CSS asset resolves | ☐ Pass ☐ Fail | |
| Remote image is not fetched automatically | ☐ Pass ☐ Fail | |
| Remote CSS resource is not fetched automatically | ☐ Pass ☐ Fail | |
| Print preview opens | ☐ Pass ☐ Fail | |
| Dark style prints with safe colors | ☐ Pass ☐ Fail | |
| Large-print style remains usable | ☐ Pass ☐ Fail | |
| Hostile fixtures fail safely | ☐ Pass ☐ Fail | |

## Obsidian reader

| Check | Result | Notes |
| --- | --- | --- |
| Plugin installs/enables | ☐ Pass ☐ Fail | |
| `.mdocss` file association works | ☐ Pass ☐ Fail | |
| Package renders without permanent extraction | ☐ Pass ☐ Fail | |
| Style selector lists bundled profiles | ☐ Pass ☐ Fail | |
| Style switching leaves archive unchanged | ☐ Pass ☐ Fail | |
| Per-file style preference persists | ☐ Pass ☐ Fail | |
| Preference follows rename | ☐ Pass ☐ Fail | |
| Local Markdown asset resolves | ☐ Pass ☐ Fail | |
| Local CSS asset resolves | ☐ Pass ☐ Fail | |
| Remote resources are blocked | ☐ Pass ☐ Fail | |
| Print preview opens | ☐ Pass ☐ Fail | |
| Hostile fixtures fail safely | ☐ Pass ☐ Fail | |

## Canonical-content check

Expected SHA-256 from smoke kit:

```text
[paste ROOT-SHA256.txt]
```

Observed before style switching:

```text
[paste digest]
```

Observed after style switching:

```text
[paste digest]
```

## Cross-render differences

Describe any material differences between the browser viewer and Obsidian for the same document/style.

## Safety findings

Describe any unexpected network request, unsafe extraction/write behavior, crash, or unresponsive host.

## Disposition

- [ ] Passes v0.4/v0.5 runtime gate
- [ ] Fails gate; blocking issue(s) linked below

Blocking/follow-up issues:
