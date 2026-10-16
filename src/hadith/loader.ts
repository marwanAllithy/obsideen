import type { App, DataAdapter } from "obsidian";
import type { HadithBookFile, HadithBookRef, Hadith } from "../shared/types";
import { readJsonFile } from "../shared/utils/file";
import {
	normalizeSearchText as normalizeSharedSearchText,
	matchesSearchText,
	toLatinDigits
} from "../shared/utils/search";

const HADITH_BOOK_CATEGORIES = ["the_9_books", "other_books", "forties"];

export function getHadithBasePath(manifestDir: string): string {
	return `${manifestDir}/data/hadith/by_book`;
}

async function listDir(
	adapter: DataAdapter,
	path: string
): Promise<{ files: string[]; folders: string[] }> {
	if ("list" in adapter && typeof (adapter as any).list === "function") {
		return (adapter as any).list(path);
	}
	throw new Error("Vault adapter does not support listing directories.");
}

function parseBookFileName(fileName: string): { slug: string; ext: string } | null {
	const match = fileName.match(/^(.+)\.json$/);
	if (!match) return null;
	return { slug: match[1], ext: "json" };
}

export interface DiscoverResult {
	books: HadithBookRef[];
	error?: string;
}

async function loadBooksManifest(
	app: App,
	basePath: string
): Promise<HadithBookRef[] | null> {
	return readJsonFile<HadithBookRef[]>(app, `${basePath}/books.json`);
}

async function tryDiscoverHadithBooks(
	app: App,
	basePath: string
): Promise<DiscoverResult> {
	const manifest = await loadBooksManifest(app, basePath);
	if (manifest && manifest.length > 0) {
		return { books: manifest };
	}

	const refs: HadithBookRef[] = [];

	for (const category of HADITH_BOOK_CATEGORIES) {
		const categoryPath = `${basePath}/${category}`;
		try {
			const listing = await listDir(app.vault.adapter, categoryPath);
			for (const fileName of listing.files) {
				const parsed = parseBookFileName(fileName);
				if (!parsed) continue;
				const filePath = `${categoryPath}/${fileName}`;
				const data = await readJsonFile<HadithBookFile>(app, filePath);
				if (!data) continue;
				refs.push({
					id: data.metadata.id,
					fileName: parsed.slug,
					category,
					englishTitle: data.metadata.english.title,
					arabicTitle: data.metadata.arabic.title,
					englishAuthor: data.metadata.english.author,
					arabicAuthor: data.metadata.arabic.author,
					length: data.metadata.length
				});
			}
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			return {
				books: refs,
				error: `Could not read ${categoryPath}: ${message}`
			};
		}
	}

	refs.sort((a, b) => a.id - b.id);
	return { books: refs };
}

export async function discoverHadithBooks(
	app: App,
	manifestDir: string
): Promise<DiscoverResult> {
	return tryDiscoverHadithBooks(app, getHadithBasePath(manifestDir));
}

export async function loadHadithBook(
	app: App,
	basePath: string,
	ref: HadithBookRef
): Promise<HadithBookFile | null> {
	const filePath = `${basePath}/${ref.category}/${ref.fileName}.json`;
	return readJsonFile<HadithBookFile>(app, filePath);
}

export function normalizeSearchText(text: string): string {
	return normalizeSharedSearchText(text);
}

export function matchesHadith(
	hadith: Hadith,
	query: string,
	searchIn: "english" | "arabic" | "both"
): boolean {
	if (!query.trim()) return true;
	const trimmed = query.trim();

	// Allow searching by hadith number (idInBook).
	const asNumber = Number(toLatinDigits(trimmed));
	if (Number.isInteger(asNumber) && hadith.idInBook === asNumber) return true;

	const fields: string[] = [];
	if (searchIn === "english" || searchIn === "both") {
		fields.push(hadith.english.narrator, hadith.english.text);
	}

	if (searchIn === "arabic" || searchIn === "both") {
		fields.push(hadith.arabic);
	}

	return matchesSearchText(trimmed, ...fields);
}

export function formatHadithForInsert(
	hadith: Hadith,
	bookRef: HadithBookRef,
	chapter: { english: string; arabic: string } | undefined,
	format: "quote" | "plain"
): string {
	const header = `**${bookRef.englishTitle}** — Hadith ${hadith.idInBook}`;
	const chapterLine = chapter ? `*${chapter.english}*` : "";
	const narrator = hadith.english.narrator ? `> ${hadith.english.narrator}` : "";

	const lines: string[] = [];
	if (format === "quote") {
		lines.push(`> ${header}`);
		if (chapterLine) lines.push(`> ${chapterLine}`);
		lines.push(">");
		if (narrator) lines.push(narrator);
		if (narrator) lines.push(">");
		lines.push("> **Arabic**");
		for (const line of hadith.arabic.split("\n")) {
			lines.push(`> ${line}`);
		}
		lines.push(">");
		lines.push("> **English**");
		for (const line of hadith.english.text.split("\n")) {
			lines.push(`> ${line}`);
		}
	} else {
		lines.push(header);
		if (chapterLine) lines.push(chapterLine);
		lines.push("");
		if (hadith.english.narrator) lines.push(hadith.english.narrator);
		lines.push("**Arabic**");
		lines.push(hadith.arabic);
		lines.push("");
		lines.push("**English**");
		lines.push(hadith.english.text);
	}

	return lines.join("\n");
}
