<script lang="ts">
	import { Notice, TFile, type App } from "obsidian";
	import type {
		QuranInfo,
		EditionsCatalog,
		ChapterInfo,
		VerseText,
		ReaderSettings,
		PageCatalog
	} from "../../shared/types";
	import {
		loadQuranInfo,
		loadEditionsCatalog,
		loadPageCatalog,
		loadTranslation,
		buildVerseMap,
		getEditionMeta,
		listEditions
	} from "../data-loader";
	import { formatVersesForInsert } from "../utils/format";
	import { tick } from "svelte";
	import Toolbar from "./Toolbar.svelte";
	import SurahHeader from "./SurahHeader.svelte";
	import Controls from "./Controls.svelte";
	import TranslationMode from "./TranslationMode.svelte";
	import QcfMode from "./QcfMode.svelte";
	import { TafsirModal } from "../TafsirModal";
	import { DEFAULT_TAFSIR_SLUG } from "../tafsir-loader";

	export let app: App;
	export let manifestDir: string;
	export let settings: ReaderSettings;
	export let onSettingsChange: (settings: ReaderSettings) => void;

	let quranInfo: QuranInfo | null = null;
	let catalog: EditionsCatalog | null = null;
	let pageCatalog: PageCatalog | null = null;
	let currentSurah = 1;
	let primaryEdition = settings.primaryEdition;
	let secondaryEdition = settings.secondaryEdition;
	let readerMode: "translation" | "qcf" = settings.readerMode;
	let primaryMap = new Map<string, string>();
	let secondaryMap = new Map<string, string>();
	let selectedVerses = new Set<number>();
	let verseTexts = new Map<number, VerseText>();
	let versesContainer: HTMLDivElement;
	let jumpTargetVerse = 0;

	$: chapters = quranInfo?.chapters ?? [];
	$: chapter = chapters.find((c) => c.chapter === currentSurah);
	$: editions = listEditions(catalog);
	$: primaryMeta = getEditionMeta(catalog, primaryEdition);
	$: secondaryMeta = getEditionMeta(catalog, secondaryEdition);
	$: isQcf = readerMode === "qcf";
	$: if (settings.secondaryEdition && settings.secondaryEdition !== secondaryEdition) {
		secondaryEdition = settings.secondaryEdition;
		void loadSecondaryEdition(secondaryEdition);
	}

	$: verseTexts = buildVerseTexts(chapter, primaryMap, secondaryMap);

	function buildVerseTexts(
		chapter: ChapterInfo | undefined,
		primary: Map<string, string>,
		secondary: Map<string, string>
	): Map<number, VerseText> {
		const result = new Map<number, VerseText>();
		if (!chapter) return result;
		for (const v of chapter.verses) {
			const key = `${chapter.chapter}:${v.verse}`;
			const primaryText = primary.get(key);
			const secondaryText = secondary.get(key);
			if (primaryText !== undefined || secondaryText !== undefined) {
				result.set(v.verse, { primary: primaryText, secondary: secondaryText });
			}
		}
		return result;
	}

	export async function initialize() {
		[quranInfo, catalog, pageCatalog] = await Promise.all([
			loadQuranInfo(app, manifestDir),
			loadEditionsCatalog(app, manifestDir),
			loadPageCatalog(app, manifestDir)
		]);
		currentSurah = 1;
		await loadEditions();
	}

	async function loadEditions() {
		const secondaryName = secondaryEdition;
		const primaryData = await loadTranslation(
			app,
			manifestDir,
			primaryEdition
		);
		const secondaryData = await loadTranslation(
			app,
			manifestDir,
			secondaryName
		);
		primaryMap = buildVerseMap(primaryData);
		if (secondaryName === secondaryEdition) {
			secondaryMap = buildVerseMap(secondaryData);
		}
	}

	async function changeSurah(surah: number) {
		const max = chapters.length;
		let next = surah;
		if (next < 1) next = 1;
		if (next > max) next = max;
		if (next === currentSurah) return;
		currentSurah = next;
		selectedVerses = new Set();
	}

	async function handlePrimaryChange(name: string) {
		primaryEdition = name;
		settings = { ...settings, primaryEdition: name };
		onSettingsChange(settings);
		const data = await loadTranslation(app, manifestDir, name);
		primaryMap = buildVerseMap(data);
	}

	async function handleSecondaryChange(name: string) {
		if (name === secondaryEdition) return;
		secondaryEdition = name;
		settings = { ...settings, secondaryEdition: name };
		onSettingsChange(settings);
		await loadSecondaryEdition(name);
	}

	async function loadSecondaryEdition(name: string) {
		const data = await loadTranslation(app, manifestDir, name);
		if (name !== secondaryEdition) return;
		secondaryMap = buildVerseMap(data);
	}

	function openTafsir(verseNumber: number) {
		if (!chapter) return;
		const verse = chapter.verses.find((item) => item.verse === verseNumber);
		if (!verse) return;
		const text = verseTexts.get(verseNumber)?.primary ?? "";
		new TafsirModal(
			app,
			chapter,
			verse,
			text,
			manifestDir,
			settings.tafsirLanguage ?? "arabic",
			settings.tafsirSlug ?? DEFAULT_TAFSIR_SLUG,
			(language: string, tafsirSlug: string) => {
				settings = { ...settings, tafsirLanguage: language, tafsirSlug };
				onSettingsChange(settings);
			}
		).open();
	}

	function getSafeSurahFolder(chapter: ChapterInfo): string {
		const name = chapter.englishname
			.toLocaleLowerCase()
			.replace(/[^a-z0-9_-]+/g, "-")
			.replace(/^-+|-+$/g, "");
		return `${chapter.chapter}-${name || `surah-${chapter.chapter}`}`;
	}

	async function ensureVaultFolder(folderPath: string) {
		let currentPath = "";
		for (const segment of folderPath.split("/")) {
			currentPath = currentPath ? `${currentPath}/${segment}` : segment;
			if (!app.vault.getAbstractFileByPath(currentPath)) {
				await app.vault.createFolder(currentPath);
			}
		}
	}

	function makeVerseNote(verseNumber: number): string {
		if (!chapter) return "";
		const text = verseTexts.get(verseNumber);
		const reference = `${chapter.chapter}:${verseNumber}`;
		const lines = [
			`# Quran ${reference} — ${chapter.englishname}`,
			"",
			`**Surah:** ${chapter.englishname} (${chapter.arabicname})`,
			`**Reference:** Quran ${reference}`
		];
		if (text?.primary) {
			lines.push("", `## Verse (${primaryMeta?.author || primaryEdition})`, "", text.primary);
		}

		if (text?.secondary) {
			lines.push(
				"",
				`## Translation (${secondaryMeta?.author || secondaryEdition})`,
				"",
				text.secondary
			);
		}

		lines.push(
			"",
			"## Personal notes",
			"",
			"**Reflection:**",
			"",
			"**Questions:**",
			"",
			"**Further study:**",
			""
		);
		return lines.join("\n");
	}

	async function createVerseNote(verseNumber: number) {
		if (!chapter) return;
		const folderPath = `obsideen/quran/${getSafeSurahFolder(chapter)}/${verseNumber}`;
		const notePath = `${folderPath}/Quran ${chapter.chapter}-${verseNumber}.md`;
		try {
			const existing = app.vault.getAbstractFileByPath(notePath);
			if (existing) {
				if (existing instanceof TFile) {
					await app.workspace.getLeaf(false).openFile(existing);
					new Notice("Verse note already exists; opened it.");
					return;
				}
				throw new Error(`A folder already exists at ${notePath}.`);
			}

			await ensureVaultFolder(folderPath);
			const file = await app.vault.create(notePath, makeVerseNote(verseNumber));
			await app.workspace.getLeaf(false).openFile(file);
			new Notice(`Created Quran verse note: ${chapter.chapter}:${verseNumber}.`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			new Notice(`Could not create verse note: ${message}`);
		}
	}

	function toggleMode() {
		if (readerMode === "qcf") {
			readerMode = "translation";
		} else {
			readerMode = "qcf";
		}
		settings = { ...settings, readerMode };
		onSettingsChange(settings);
	}

	function toggleVerse(verse: number) {
		const next = new Set(selectedVerses);
		if (next.has(verse)) next.delete(verse);
		else next.add(verse);
		selectedVerses = next;
	}

	async function jumpToVerse(num: number) {
		if (!chapter) return;
		let target = num;
		if (target < 1) target = 1;
		if (target > chapter.verses.length) target = chapter.verses.length;

		// Ask the active reader mode to render the page containing the target verse.
		jumpTargetVerse = target;
		await tick();

		const selector = isQcf
			? `.obsideen-qcf-word[data-verse="${target}"]`
			: `.obsideen-verse[data-verse="${target}"]`;

		// Give async modes (e.g. QCF) a moment to load data before looking for the element.
		let el = versesContainer?.querySelector<HTMLElement>(selector);
		let attempts = 0;
		while (!el && attempts < 30) {
			await new Promise((r) => setTimeout(r, 100));
			el = versesContainer?.querySelector<HTMLElement>(selector);
			attempts++;
		}

		if (el) {
			el.scrollIntoView({ behavior: "smooth", block: "start" });
			el.classList.add("obsideen-highlight");
			setTimeout(() => el!.classList.remove("obsideen-highlight"), 1500);
		}

		jumpTargetVerse = 0;
	}

	export async function openVerse(chapterNumber: number, verseNumber: number) {
		if (!chapters.some((item) => item.chapter === chapterNumber)) return;
		if (currentSurah !== chapterNumber) {
			currentSurah = chapterNumber;
			selectedVerses = new Set();
			await tick();
		}
		await jumpToVerse(verseNumber);
	}

	function getSelectedSorted(): number[] {
		return Array.from(selectedVerses).sort((a, b) => a - b);
	}

	function buildInsertText(): string {
		return formatVersesForInsert(
			chapter,
			getSelectedSorted(),
			verseTexts,
			primaryMeta,
			secondaryMeta,
			settings.insertFormat
		);
	}

	export async function copySelectedVerses() {
		const text = buildInsertText();
		if (!text) {
			new Notice("No verses selected.");
			return;
		}
		await navigator.clipboard.writeText(text);
		new Notice("Selected verses copied to clipboard.");
	}

	export async function insertSelectedVerses() {
		const text = buildInsertText();
		if (!text) {
			new Notice("No verses selected.");
			return;
		}

		const activeFile = app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice("No active note to insert into.");
			return;
		}

		const editor = app.workspace.activeEditor?.editor;
		if (editor) {
			editor.replaceSelection(text);
			new Notice("Verses inserted into active note.");
		} else {
			const current = await app.vault.read(activeFile);
			await app.vault.modify(activeFile, current + "\n\n" + text);
			new Notice("Verses appended to active note.");
		}
	}
</script>

<div class="obsideen-reader" class:obsideen-qcf-mode={isQcf}>
	<Toolbar
		{chapters}
		{currentSurah}
		{readerMode}
		onChangeSurah={changeSurah}
		onJumpToVerse={jumpToVerse}
		onToggleMode={toggleMode}
	/>

	<SurahHeader {chapter} />

	{#if readerMode === "translation"}
		<Controls
			{editions}
			{primaryEdition}
			{secondaryEdition}
			onPrimaryChange={handlePrimaryChange}
			onSecondaryChange={handleSecondaryChange}
		/>
	{/if}

	<div class="obsideen-verses" bind:this={versesContainer}>
		{#if !chapter}
			<div class="obsideen-empty">No chapter data.</div>
		{:else if isQcf}
			<QcfMode
				{chapter}
				{pageCatalog}
				{app}
				{manifestDir}
				{jumpTargetVerse}
				{selectedVerses}
				onToggleVerse={toggleVerse}
			/>
		{:else if verseTexts.size === 0}
			<div class="obsideen-loading">Loading verses…</div>
		{:else}
			<TranslationMode
				{chapter}
				{verseTexts}
				{primaryMeta}
				{primaryEdition}
				{jumpTargetVerse}
				onOpenTafsir={openTafsir}
				onCreateNote={createVerseNote}
			/>
		{/if}
	</div>
</div>
