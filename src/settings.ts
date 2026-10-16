import type { ReaderSettings } from "./shared/types";

export const DEFAULT_SETTINGS: ReaderSettings = {
	primaryEdition: "ara-quranuthmanihaf",
	secondaryEdition: "eng-mustafakhattaba",
	tafsirLanguage: "arabic",
	tafsirSlug: "ar-tafseer-al-saddi",
	insertFormat: "quote",
	readerMode: "translation",
	salahCity: "",
	salahCountry: "",
	salahMethod: 3,
	salahTracker: {},
	salahTimesCache: {}
};

export function mergeSettings(saved: Partial<ReaderSettings>): ReaderSettings {
	saved = saved ?? {};
	const bundledSettings = { ...saved } as Partial<ReaderSettings> & Record<string, unknown>;
	delete bundledSettings.externalDataPath;
	delete bundledSettings.externalTafsirPath;
	delete bundledSettings.hadithDataPath;
	// Existing vaults may still store the removed Arabic-only mode as "moshaf".
	const savedReaderMode = saved.readerMode as string | undefined;
	return {
		...DEFAULT_SETTINGS,
		...bundledSettings,
		primaryEdition:
			saved.primaryEdition === "ara-quransimple" || saved.primaryEdition === "ara-quranuthmanihaf"
				? saved.primaryEdition
				: DEFAULT_SETTINGS.primaryEdition,
		secondaryEdition:
			[
				"eng-mustafakhattaba",
				"eng-abdullahyusufal",
				"eng-abdelhaleem"
			].includes(saved.secondaryEdition ?? "")
				? saved.secondaryEdition!
				: DEFAULT_SETTINGS.secondaryEdition,
		tafsirLanguage: "arabic",
		tafsirSlug:
			saved.tafsirSlug === "ar-tafseer-al-saddi"
				? saved.tafsirSlug
				: DEFAULT_SETTINGS.tafsirSlug,
		readerMode:
			savedReaderMode === "moshaf" || savedReaderMode === "qcf"
				? "qcf"
				: savedReaderMode === "translation"
					? "translation"
					: DEFAULT_SETTINGS.readerMode,
		salahTracker: saved.salahTracker ?? {},
		salahTimesCache: saved.salahTimesCache ?? {}
	};
}
