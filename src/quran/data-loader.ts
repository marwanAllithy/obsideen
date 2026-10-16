import type { App } from "obsidian";
import type {
	QuranInfo,
	EditionsCatalog,
	EditionMeta,
	QuranEditionData,
	VerseKey,
	PageCatalog,
	PageReference,
	QuranWord,
	QcfLineData,
	QcfPageData
} from "../shared/types";
import { readJsonFile } from "../shared/utils/file";

export const BUNDLED_EDITIONS = [
	"ara-quransimple",
	"ara-quranuthmanihaf",
	"eng-mustafakhattaba",
	"eng-abdullahyusufal",
	"eng-abdelhaleem"
];

export function getDataPath(manifestDir: string, filename: string): string {
	return `${manifestDir}/data/${filename}`;
}

export async function loadQuranInfo(app: App, manifestDir: string): Promise<QuranInfo | null> {
	return readJsonFile<QuranInfo>(app, getDataPath(manifestDir, "info.json"));
}

export async function loadEditionsCatalog(
	app: App,
	manifestDir: string
): Promise<EditionsCatalog | null> {
	return readJsonFile<EditionsCatalog>(app, getDataPath(manifestDir, "editions.json"));
}

export async function loadPageCatalog(app: App, manifestDir: string): Promise<PageCatalog | null> {
	return readJsonFile<PageCatalog>(app, getDataPath(manifestDir, "pages.json"));
}

export async function loadBundledTranslation(
	app: App,
	manifestDir: string,
	editionName: string
): Promise<QuranEditionData | null> {
	if (!BUNDLED_EDITIONS.includes(editionName)) return null;
	return readJsonFile<QuranEditionData>(
		app,
		getDataPath(manifestDir, `translations/${editionName}.json`)
	);
}

export async function loadTranslation(
	app: App,
	manifestDir: string,
	editionName: string
): Promise<QuranEditionData | null> {
	return loadBundledTranslation(app, manifestDir, editionName);
}

export function buildVerseMap(data: QuranEditionData | null): Map<string, string> {
	const map = new Map<string, string>();
	if (!data) return map;
	for (const item of data.quran) {
		map.set(`${item.chapter}:${item.verse}`, item.text);
	}
	return map;
}

export function getEditionMeta(
	catalog: EditionsCatalog | null,
	editionName: string
): EditionMeta | undefined {
	if (!catalog) return undefined;
	return Object.values(catalog).find((m) => m.name === editionName);
}

export function listEditions(catalog: EditionsCatalog | null): EditionMeta[] {
	if (!catalog) return [];
	const bundled = new Set(BUNDLED_EDITIONS);
	return Object.values(catalog).filter((meta) => meta.name && bundled.has(meta.name));
}

export function isArabicEdition(meta: EditionMeta | undefined, editionName: string): boolean {
	return meta?.language === "Arabic" || editionName.startsWith("ara-");
}

export function buildPageMap(catalog: PageCatalog | null): Map<number, PageReference> {
	const map = new Map<number, PageReference>();
	if (!catalog) return map;
	for (const page of catalog.pages) {
		map.set(page.page, page);
	}
	return map;
}

export function getPageForVerse(
	catalog: PageCatalog | null,
	key: VerseKey
): PageReference | undefined {
	if (!catalog) return undefined;
	// pages.json stores verses in order, so a binary search is sufficient, but
	// a small linear scan over 604 entries is also fine and keeps the code simple.
	for (const page of catalog.pages) {
		const first = page.verses[0];
		const last = page.verses[page.verses.length - 1];
		const afterFirst =
			key.chapter > first.chapter ||
			(key.chapter === first.chapter && key.verse >= first.verse);
		const beforeLast =
			key.chapter < last.chapter ||
			(key.chapter === last.chapter && key.verse <= last.verse);
		if (afterFirst && beforeLast) return page;
	}
	return undefined;
}

export function getVersesForPage(page: PageReference): string[] {
	return page.verses.map((v) => `${v.chapter}:${v.verse}`);
}

export function groupWordsByLine(words: QuranWord[]): Map<number, QuranWord[]> {
	const lines = new Map<number, QuranWord[]>();
	for (const word of words) {
		const line = word.line_number;
		if (!lines.has(line)) lines.set(line, []);
		lines.get(line)!.push(word);
	}
	for (const lineWords of lines.values()) {
		lineWords.sort((a, b) => {
			// `position` is per-verse; order by verse first so words from the
			// end of one verse and the start of the next do not interleave.
			const verseCmp = a.verse_key.localeCompare(b.verse_key);
			if (verseCmp !== 0) return verseCmp;
			return a.position - b.position;
		});
	}
	return new Map([...lines.entries()].sort((a, b) => a[0] - b[0]));
}

function getChapterFromVerseKey(key: string): number {
	return parseInt(key.split(":")[0], 10);
}

export function buildQcfPageData(
	pageNumber: number,
	words: QuranWord[]
): QcfPageData {
	const lineMap = groupWordsByLine(words);
	const sortedLineNumbers = Array.from(lineMap.keys()).sort((a, b) => a - b);

	// Detect partial (centered) lines:
	// 1. trailing lines with few words
	// 2. the first line of a new surah on this page
	const partialLines = new Set<number>();
	let lastChapter = 0;
	for (const lineNum of sortedLineNumbers) {
		const lineWords = lineMap.get(lineNum)!;
		const chapters = new Set(lineWords.map((w) => getChapterFromVerseKey(w.verse_key)));
		const chapter = chapters.values().next().value as number;
		if (lastChapter !== 0 && chapter !== lastChapter) {
			partialLines.add(lineNum);
		}
		lastChapter = chapter;
	}
	// Walk backwards; short trailing lines are partial.
	for (let i = sortedLineNumbers.length - 1; i >= 0; i--) {
		const lineNum = sortedLineNumbers[i];
		if (lineMap.get(lineNum)!.length <= 6) {
			partialLines.add(lineNum);
		} else {
			break;
		}
	}

	const lines: QcfLineData[] = sortedLineNumbers.map((lineNum) => ({
		lineNumber: lineNum,
		words: lineMap.get(lineNum)!,
		isPartial: partialLines.has(lineNum)
	}));

	return { page: pageNumber, lines };
}

export function getPagesForChapter(
	catalog: PageCatalog | null,
	chapterNumber: number
): PageReference[] {
	if (!catalog) return [];
	return catalog.pages.filter((page) => {
		return (
			page.start.chapter <= chapterNumber && page.end.chapter >= chapterNumber
		);
	});
}

export function getQcfPageDataPath(manifestDir: string, pageNumber: number): string {
	return `${manifestDir}/data/qcf-pages/${pageNumber}.json`;
}

export async function loadQcfPageData(
	app: App,
	manifestDir: string,
	pageNumber: number
): Promise<QcfPageData | null> {
	return readJsonFile<QcfPageData>(app, getQcfPageDataPath(manifestDir, pageNumber));
}

export function getQcfFontUrl(
	app: App,
	manifestDir: string,
	pageNumber: number
): string {
	const fontPath = `${manifestDir}/fonts/qcf-v2/p${pageNumber}.woff2`;
	const adapter = app.vault.adapter;
	return "getResourcePath" in adapter
		? (adapter as any).getResourcePath(fontPath)
		: `file://${fontPath}`;
}
