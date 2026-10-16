import type { App } from "obsidian";

export const DEFAULT_TAFSIR_SLUG = "ar-tafseer-al-saddi";
const tafsirCatalogCache = new Map<string, TafsirEdition[]>();
const BUNDLED_TAFSIR_SLUGS = new Set([DEFAULT_TAFSIR_SLUG]);

export interface TafsirEdition {
	name: string;
	slug: string;
	language: string;
	languageLabel: string;
	author: string;
	source: string;
}

export interface TafsirLanguageOption {
	id: string;
	label: string;
	direction: "ltr" | "rtl";
}

interface RawTafsirEdition {
	name?: string;
	slug?: string;
	language_name?: string;
	author_name?: string;
	source?: string;
}

interface TafsirVerse {
	text?: string;
	ayah?: number;
	surah?: number;
}

const RTL_LANGUAGES = new Set(["arabic", "persian", "urdu", "pashto", "kurdish"]);

const FALLBACK_EDITION: TafsirEdition = {
	name: "Tafseer Al Saadi - Arabic",
	slug: DEFAULT_TAFSIR_SLUG,
	language: "arabic",
	languageLabel: "arabic",
	author: "Saddi",
	source: "Bundled Tafseer Al Saadi data"
};

function parseEditions(data: unknown): TafsirEdition[] {
	if (!Array.isArray(data)) return [];
	return data
		.filter(
			(item: RawTafsirEdition) =>
				typeof item?.slug === "string" &&
				typeof item?.name === "string" &&
				typeof item?.language_name === "string"
		)
		.map((item: RawTafsirEdition) => ({
			name: item.name!,
			slug: item.slug!,
			language: item.language_name!.trim().toLocaleLowerCase(),
			languageLabel: item.language_name!.trim(),
			author: item.author_name ?? "",
			source: item.source ?? ""
		}));
}

export async function loadTafsirEditions(
	app: App,
	manifestDir: string
): Promise<TafsirEdition[]> {
	const cached = tafsirCatalogCache.get(manifestDir);
	if (cached) return cached;

	try {
		const path = `${manifestDir}/data/tafsir/editions.json`;
		const editions = parseEditions(JSON.parse(await app.vault.adapter.read(path)))
			.filter((edition) => BUNDLED_TAFSIR_SLUGS.has(edition.slug));
		const result = editions.length > 0 ? editions : [FALLBACK_EDITION];
		tafsirCatalogCache.set(manifestDir, result);
		return result;
	} catch (error) {
		console.error("Obsideen: failed to load tafsir catalog", error);
		const result = [FALLBACK_EDITION];
		tafsirCatalogCache.set(manifestDir, result);
		return result;
	}
}

export function getTafsirLanguages(editions: TafsirEdition[]): TafsirLanguageOption[] {
	const languages = new Map<string, string>();
	for (const edition of editions) {
		if (!languages.has(edition.language)) {
			languages.set(edition.language, edition.languageLabel);
		}
	}
	return Array.from(languages.entries())
		.map(([id, label]) => {
			const direction: TafsirLanguageOption["direction"] = RTL_LANGUAGES.has(id) ? "rtl" : "ltr";
			return {
				id,
				label: label.charAt(0).toLocaleUpperCase() + label.slice(1),
				direction
			};
		})
		.sort((a, b) => (a.id === "arabic" ? -1 : b.id === "arabic" ? 1 : a.label.localeCompare(b.label)));
}

export function getPreferredTafsir(
	editions: TafsirEdition[],
	language: string,
	preferredSlug: string
): TafsirEdition | undefined {
	const languageEditions = editions.filter((edition) => edition.language === language);
	if (languageEditions.length === 0) return undefined;
	return (
		languageEditions.find((edition) => edition.slug === preferredSlug) ??
		(language === "arabic"
			? languageEditions.find((edition) => edition.slug === DEFAULT_TAFSIR_SLUG)
			: undefined) ??
		languageEditions.find((edition) => /saadi|saddi/i.test(`${edition.name} ${edition.author}`)) ??
		languageEditions[0]
	);
}

function extractTafsirText(data: unknown, verse: number): string | null {
	if (!data || typeof data !== "object") return null;
	if (Array.isArray(data)) {
		const item = data.find(
			(entry) => entry && typeof entry === "object" && (entry as TafsirVerse).ayah === verse
		) as TafsirVerse | undefined;
		return typeof item?.text === "string" && item.text.trim() ? item.text : null;
	}
	const item = data as TafsirVerse;
	return typeof item.text === "string" && item.text.trim() ? item.text : null;
}

async function readLocalTafsir(
	app: App,
	manifestDir: string,
	editionSlug: string,
	surah: number,
	ayah: number
): Promise<string | null> {
	if (!BUNDLED_TAFSIR_SLUGS.has(editionSlug)) return null;
	const surahPath = `${manifestDir}/data/tafsir/tafsir/${editionSlug}/${surah}.json`;
	try {
		return extractTafsirText(JSON.parse(await app.vault.adapter.read(surahPath)), ayah);
	} catch {
		return null;
	}
}

export async function loadTafsir(
	app: App,
	manifestDir: string,
	editionSlug: string,
	surah: number,
	ayah: number
): Promise<string | null> {
	return readLocalTafsir(app, manifestDir, editionSlug, surah, ayah);
}
