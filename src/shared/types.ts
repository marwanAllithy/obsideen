export interface VerseKey {
	chapter: number;
	verse: number;
}

export interface VerseInfo extends VerseKey {
	line: number;
	juz: number;
	manzil: number;
	page: number;
	ruku: number;
	maqra: number;
	sajda: boolean;
}

export interface ChapterInfo {
	chapter: number;
	name: string;
	englishname: string;
	arabicname: string;
	revelation: string;
	verses: VerseInfo[];
}

export interface QuranInfo {
	verses: { count: number };
	chapters: ChapterInfo[];
	pages: {
		count: number;
		references: PageReference[];
	};
}

export interface PageReference {
	page: number;
	start: VerseKey;
	end: VerseKey;
	verses: VerseKey[];
}

export interface PageCatalog {
	count: number;
	pages: PageReference[];
}

export interface EditionMeta {
	name: string;
	author: string;
	language: string;
	direction: string;
	source: string;
	comments: string;
	link: string;
	linkmin: string;
}

export interface EditionsCatalog {
	[key: string]: EditionMeta;
}

export interface QuranVerse {
	chapter: number;
	verse: number;
	text: string;
}

export interface QuranEditionData {
	quran: QuranVerse[];
}

export interface VerseText {
	primary?: string;
	secondary?: string;
}

export interface ReaderSettings {
	primaryEdition: string;
	secondaryEdition: string;
	tafsirLanguage: string;
	tafsirSlug: string;
	insertFormat: 'quote' | 'plain';
	readerMode: 'translation' | 'qcf';
	salahCity: string;
	salahCountry: string;
	salahMethod: number;
	salahTracker: SalahTracker;
	salahTimesCache: Record<string, CachedSalahTimes>;
}

export type SalahPrayer = "Fajr" | "Dhuhr" | "Asr" | "Maghrib" | "Isha";

export type SalahTracker = Record<string, Partial<Record<SalahPrayer, boolean>>>;

export interface CachedSalahTimes {
	timings: Record<SalahPrayer, string>;
	dateKey: string;
	dateLabel: string;
	timezone: string;
	hijriDate: string;
	cachedAt: number;
}

export interface QuranWord {
	id: number;
	position: number;
	char_type_name: 'word' | 'end' | 'pause_mark';
	code_v2?: string;
	line_number: number;
	text_uthmani: string;
	verse_key: string;
}

export interface QcfLineData {
	lineNumber: number;
	words: QuranWord[];
	isPartial: boolean;
}

export interface QcfPageData {
	page: number;
	lines: QcfLineData[];
}

export interface HadithEnglish {
	narrator: string;
	text: string;
}

export interface Hadith {
	id: number;
	idInBook: number;
	chapterId: number;
	bookId: number;
	arabic: string;
	english: HadithEnglish;
}

export interface HadithChapter {
	id: number;
	bookId: number;
	arabic: string;
	english: string;
}

export interface HadithBookInfo {
	title: string;
	author: string;
	introduction: string | undefined;
}

export interface HadithBookMetadata {
	id: number;
	length: number;
	arabic: HadithBookInfo;
	english: HadithBookInfo;
}

export interface HadithBookFile {
	id: number;
	metadata: HadithBookMetadata;
	chapters: HadithChapter[];
	hadiths: Hadith[];
}

export interface HadithBookRef {
	id: number;
	fileName: string;
	category: string;
	englishTitle: string;
	arabicTitle: string;
	englishAuthor: string;
	arabicAuthor: string;
	length: number;
}
