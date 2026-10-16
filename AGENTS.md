# Obsideen Obsidian Plugin — Agent Notes

This is the standalone **Obsideen** Obsidian plugin repository. The repository root is the plugin directory; do not add a full Obsidian vault or local vault configuration.

## Required workflow

- Inspect `git status` before editing and preserve existing user changes.
- Work on a separate task branch; do not make task changes directly on `main`.
- Commit requested changes in focused commits.
- Do not merge a work branch into `main` until the user explicitly approves.
- Do not push to a remote unless the user explicitly asks for a push. Preserve existing remotes when adding another destination.
- Keep local Obsidian settings and the runtime-generated `data.json` out of commits.

## Project layout

- `manifest.json`, `main.js`, and `styles.css` are the plugin entry files.
- `src/` contains TypeScript and Svelte source code.
- `data/` and `fonts/` contain runtime resources read relative to the plugin directory. Keep them with the plugin and preserve their upstream notices.
- `scripts/` contains data-generation utilities.

## Build and verification

```bash
npm ci
npm run build
node --check main.js
```

The build uses esbuild and esbuild-svelte to generate the CommonJS bundle `main.js`. Obsidian loads `styles.css` directly.

## Distribution note

BRAT and the Community Plugin Store install the standard release files (`manifest.json`, `main.js`, and `styles.css`) only. This plugin's setup gate downloads the data and font packs from public GitHub Release assets. Run `npm run package:resources`, then attach both generated ZIPs to a release whose tag matches `manifest.json`'s version. Keep each pack's embedded `resource-pack.json` and all upstream notices intact.
