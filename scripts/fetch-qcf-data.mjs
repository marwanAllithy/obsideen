#!/usr/bin/env node
/**
 * Fetches the Quran.com word-level Mushaf layout and QCF V2 per-page fonts
 * so the QcfMode reader can work fully offline.
 *
 * Run from the plugin root:
 *   node scripts/fetch-qcf-data.mjs
 *
 * Outputs:
 *   - data/qcf-pages/{page}.json  (word layout per Mushaf page)
 *   - fonts/qcf-v2/p{page}.woff2  (QCF V2 font per page)
 */

import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const QCF_API_BASE = "https://api.quran.com/api/v4";
const QCF_FONT_BASE = "https://static.qurancdn.com/fonts/quran/hafs/v2/woff2";
const PAGES = 604;
const WORD_FIELDS = "code_v2,line_number,position,char_type_name,text_uthmani,page_number";
const CONCURRENCY = 8;

const rootDir = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const dataDir = path.join(rootDir, "data", "qcf-pages");
const fontDir = path.join(rootDir, "fonts", "qcf-v2");

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureDirs() {
	await mkdir(dataDir, { recursive: true });
	await mkdir(fontDir, { recursive: true });
}

async function fetchPage(pageNumber) {
	const url = `${QCF_API_BASE}/verses/by_page/${pageNumber}?words=true&per_page=200&word_fields=${WORD_FIELDS}`;
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`HTTP ${response.status} for page ${pageNumber}`);
	}
	const json = await response.json();
	const verses = json.verses ?? [];
	const words = [];
	for (const verse of verses) {
		const verseKey = verse.verse_key;
		for (const word of verse.words ?? []) {
			words.push({
				id: word.id,
				position: word.position,
				char_type_name: word.char_type_name,
				code_v2: word.code_v2,
				line_number: word.line_number,
				text_uthmani: word.text_uthmani,
				page_number: word.page_number,
				verse_key: verseKey
			});
		}
	}

	const lineMap = new Map();
	for (const word of words) {
		const line = word.line_number;
		if (!lineMap.has(line)) lineMap.set(line, []);
		lineMap.get(line).push(word);
	}
	const lines = Array.from(lineMap.entries())
		.sort((a, b) => a[0] - b[0])
		.map(([lineNumber, lineWords]) => ({
			lineNumber,
			words: lineWords.sort((a, b) => {
				// `position` is per-verse, so when a line contains the end of one
				// verse and the start of the next we must order by verse first.
				const verseCmp = a.verse_key.localeCompare(b.verse_key);
				if (verseCmp !== 0) return verseCmp;
				return a.position - b.position;
			})
		}));

	return { page: pageNumber, lines };
}

async function savePage(pageNumber) {
	const outPath = path.join(dataDir, `${pageNumber}.json`);
	if (existsSync(outPath)) {
		console.log(`  skipping page ${pageNumber} (already cached)`);
		return;
	}
	const data = await fetchPage(pageNumber);
	await writeFile(outPath, JSON.stringify(data));
	console.log(`  saved page ${pageNumber} (${data.lines.length} lines)`);
}

async function downloadFont(pageNumber) {
	const outPath = path.join(fontDir, `p${pageNumber}.woff2`);
	if (existsSync(outPath)) {
		console.log(`  skipping font ${pageNumber} (already cached)`);
		return;
	}
	const url = `${QCF_FONT_BASE}/p${pageNumber}.woff2`;
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`HTTP ${response.status} for font ${pageNumber}`);
	}
	const buffer = Buffer.from(await response.arrayBuffer());
	await writeFile(outPath, buffer);
	console.log(`  saved font ${pageNumber} (${buffer.length} bytes)`);
}

async function runInBatches(items, fn, concurrency) {
	const queue = [...items];
	const workers = Array.from({ length: concurrency }, async () => {
		while (queue.length > 0) {
			const item = queue.shift();
			await fn(item);
		}
	});
	await Promise.all(workers);
}

async function main() {
	console.log("Fetching Quran.com QCF data for offline use…");
	await ensureDirs();

	console.log("\n1/2 Fetching word layout…");
	for (let page = 1; page <= PAGES; page++) {
		await savePage(page);
		// Be polite to the Quran.com API.
		if (page < PAGES) await sleep(50);
	}

	console.log("\n2/2 Downloading QCF V2 fonts…");
	const pages = Array.from({ length: PAGES }, (_, i) => i + 1);
	await runInBatches(pages, downloadFont, CONCURRENCY);

	console.log("\nDone.");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
