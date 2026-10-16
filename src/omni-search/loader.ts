import type { App } from "obsidian";
import type {
	Hadith,
	HadithBookRef,
	HadithChapter,
	ReaderSettings
} from "../shared/types";
import { discoverHadithBooks, getHadithBasePath, loadHadithBook } from "../hadith/loader";
import {
	BUNDLED_EDITIONS,
	getEditionMeta,
	isArabicEdition,
	loadEditionsCatalog,
	loadQuranInfo,
	loadTranslation
} from "../quran/data-loader";
import {
	normalizeSearchText,
	parseVerseReference,
	scoreNormalizedSearchMatch,
	type SearchFuzziness,
	toLatinDigits
} from "../shared/utils/search";

export interface QuranSearchText {
	edition: string;
	text: string;
	normalized: string;
}

export interface QuranSearchEntry {
	chapter: number;
	verse: number;
	chapterName: string;
	chapterArabicName: string;
	page: number;
	arabicTexts: QuranSearchText[];
	translations: QuranSearchText[];
	preferredTranslation: string;
}

export interface HadithSearchEntry {
	hadith: Hadith;
	bookRef: HadithBookRef;
	chapter?: HadithChapter;
	normalizedArabic: string;
	normalizedEnglish: string;
}

export type OmniSearchResult =
	| {
		kind: "quran";
		entry: QuranSearchEntry;
		score: number;
		translation?: QuranSearchText;
	}
	| {
		kind: "hadith";
		entry: HadithSearchEntry;
		score: number;
	};

export type SearchSource = "all" | "quran" | "hadith";
export type SearchLanguage = "both" | "arabic" | "english";

function getEditionNames(settings: ReaderSettings): string[] {
	return Array.from(
		new Set([...BUNDLED_EDITIONS, settings.primaryEdition, settings.secondaryEdition].filter(Boolean))
	);
}

export async function loadQuranSearchIndex(
	app: App,
	manifestDir: string,
	settings: ReaderSettings
): Promise<QuranSearchEntry[]> {
	const [info, catalog] = await Promise.all([
		loadQuranInfo(app, manifestDir),
		loadEditionsCatalog(app, manifestDir)
	]);
	if (!info) throw new Error("Quran metadata could not be loaded.");

	const editionNames = getEditionNames(settings);
	const editionData = await Promise.all(
		editionNames.map(async (edition) => ({
			edition,
			data: await loadTranslation(app, manifestDir, edition)
		}))
	);
	const versesByKey = new Map<string, Map<string, string>>();
	for (const { edition, data } of editionData) {
		if (!data) continue;
		for (const verse of data.quran) {
			const key = `${verse.chapter}:${verse.verse}`;
			if (!versesByKey.has(key)) versesByKey.set(key, new Map());
			versesByKey.get(key)!.set(edition, verse.text);
		}
	}

	const preferredTranslation = [settings.primaryEdition, settings.secondaryEdition].find((edition) => {
		return edition && !isArabicEdition(getEditionMeta(catalog, edition), edition);
	}) ?? "eng-mustafakhattaba";
	const result: QuranSearchEntry[] = [];
	for (const chapter of info.chapters) {
		for (const verse of chapter.verses) {
			const verseTexts = versesByKey.get(`${chapter.chapter}:${verse.verse}`);
			if (!verseTexts) continue;
			const arabicTexts: QuranSearchText[] = [];
			const translations: QuranSearchText[] = [];
			for (const [edition, text] of verseTexts) {
				const searchText = { edition, text, normalized: normalizeSearchText(text) };
				if (isArabicEdition(getEditionMeta(catalog, edition), edition)) {
					arabicTexts.push(searchText);
				} else {
					translations.push(searchText);
				}
			}
			// Prefer the reader's Arabic edition, then Uthmani Hafs, then any available Arabic text.
			arabicTexts.sort((a, b) => {
				const preference = (edition: string) =>
					edition === settings.primaryEdition || edition === settings.secondaryEdition
						? 0
						: edition === "ara-quranuthmanihaf"
							? 1
							: 2;
				return preference(a.edition) - preference(b.edition);
			});
			translations.sort((a, b) => {
				if (a.edition === preferredTranslation) return -1;
				if (b.edition === preferredTranslation) return 1;
				return a.edition.localeCompare(b.edition);
			});
			result.push({
				chapter: chapter.chapter,
				verse: verse.verse,
				chapterName: chapter.englishname || chapter.name || `Surah ${chapter.chapter}`,
				chapterArabicName: chapter.arabicname,
				page: verse.page,
				arabicTexts,
				translations,
				preferredTranslation
			});
		}
	}
	return result;
}

export async function loadHadithSearchIndex(
	app: App,
	manifestDir: string,
	onProgress?: (message: string) => void
): Promise<HadithSearchEntry[]> {
	const discovery = await discoverHadithBooks(app, manifestDir);
	if (discovery.books.length === 0) {
		throw new Error(discovery.error || "No hadith books could be loaded.");
	}
	const dataPath = getHadithBasePath(manifestDir);
	const result: HadithSearchEntry[] = [];
	const batchSize = 3;
	for (let offset = 0; offset < discovery.books.length; offset += batchSize) {
		const batch = discovery.books.slice(offset, offset + batchSize);
		onProgress?.(`Indexing hadith books ${offset + 1}–${offset + batch.length} of ${discovery.books.length}…`);
		const loaded = await Promise.all(
			batch.map(async (bookRef) => ({ bookRef, data: await loadHadithBook(app, dataPath, bookRef) }))
		);
		for (const { bookRef, data } of loaded) {
			if (!data) continue;
			const chapters = new Map(data.chapters.map((chapter) => [chapter.id, chapter]));
			for (const hadith of data.hadiths) {
				result.push({
					hadith,
					bookRef,
					chapter: chapters.get(hadith.chapterId),
					normalizedArabic: normalizeSearchText(hadith.arabic),
					normalizedEnglish: normalizeSearchText(
						`${hadith.english.narrator} ${hadith.english.text}`
					)
				});
			}
		}
	}
	return result;
}

function selectMatchedTranslation(
	entry: QuranSearchEntry,
	query: string,
	language: SearchLanguage,
	fuzziness: SearchFuzziness
): QuranSearchText | undefined {
	if (language === "arabic") return undefined;
	let matchedTranslation: QuranSearchText | undefined;
	let bestScore = -1;
	for (const translation of entry.translations) {
		const score = scoreNormalizedSearchMatch(query, [translation.normalized], fuzziness);
		if (score > bestScore) {
			bestScore = score;
			matchedTranslation = translation;
		}
	}
	return (
		matchedTranslation ??
		entry.translations.find((translation) => translation.edition === entry.preferredTranslation) ??
		entry.translations[0]
	);
}

export function searchOmniIndex(
	query: string,
	source: SearchSource,
	language: SearchLanguage,
	fuzziness: SearchFuzziness,
	quranIndex: QuranSearchEntry[],
	hadithIndex: HadithSearchEntry[]
): OmniSearchResult[] {
	const results: OmniSearchResult[] = [];
	const reference = source === "hadith" ? null : parseVerseReference(query);
	if (source !== "hadith") {
		for (const entry of quranIndex) {
			let score: number;
			if (reference) {
				if (entry.chapter !== reference.chapter || entry.verse !== reference.verse) continue;
				score = 1000;
			} else {
				const fields = [
					...(language === "english" ? [] : entry.arabicTexts.map((text) => text.normalized)),
					...(language === "arabic" ? [] : entry.translations.map((text) => text.normalized))
				];
				score = scoreNormalizedSearchMatch(query, fields, fuzziness);
				if (score < 0) continue;
			}
			results.push({
				kind: "quran",
				entry,
				score,
				translation: selectMatchedTranslation(entry, query, language, fuzziness)
			});
		}
	}
	if (source !== "quran" && !reference) {
		for (const entry of hadithIndex) {
			const fields = [
				...(language === "english" ? [] : [entry.normalizedArabic]),
				...(language === "arabic" ? [] : [entry.normalizedEnglish])
			];
			let score = scoreNormalizedSearchMatch(query, fields, fuzziness);
			const numericQuery = Number(toLatinDigits(query.trim()));
			if (Number.isInteger(numericQuery) && entry.hadith.idInBook === numericQuery) {
				score = Math.max(score, 1000);
			}
			if (score >= 0) results.push({ kind: "hadith", entry, score });
		}
	}
	return results.sort((a, b) => b.score - a.score);
}
