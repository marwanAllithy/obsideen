# Obsideen Quran Reader

An Obsidian plugin for reading and studying the Quran, translations, tafsir, and hadith.

## Development

```bash
npm ci
npm run build
node --check main.js
```

The plugin reads runtime resources from `data/` and `fonts/`. When installed through BRAT or the Community Plugin Store without those folders, Obsideen opens a setup screen and keeps its feature views locked until both resource packs have been downloaded and verified.

## Publish resource packs

Before creating a GitHub release, run:

```bash
npm run package:resources
```

This creates `dist/resources/obsideen-resources-<version>-data.zip` and `dist/resources/obsideen-resources-<version>-fonts.zip`. Create a GitHub release whose tag exactly matches the `manifest.json` version, then attach both ZIPs along with the standard `main.js`, `manifest.json`, and `styles.css` files. BRAT and Obsidian install the standard files; the plugin's **Install Obsideen offline resources** command downloads and verifies the two ZIPs directly from that release.

The release must be public for users to download the resource packs without authentication. Keep the per-dataset license and source notices in the packs.
