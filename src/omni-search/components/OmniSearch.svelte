<script lang="ts">
	import { Notice, TFile, type App } from "obsidian";
	import type { Hadith, ReaderSettings } from "../../shared/types";
	import { formatHadithForInsert } from "../../hadith/loader";
	import HadithResult from "../../hadith/components/HadithResult.svelte";
	import LazySentinel from "../../shared/components/LazySentinel.svelte";
	import {
		getHighlightSegments,
		parseVerseReference,
		type SearchFuzziness
	} from "../../shared/utils/search";
	import {
		loadHadithSearchIndex,
		loadQuranSearchIndex,
		searchOmniIndex,
		type HadithSearchEntry,
		type OmniSearchResult,
		type QuranSearchEntry,
		type SearchLanguage,
		type SearchSource
	} from "../loader";

	export let app: App;
	export let manifestDir: string;
	export let settings: ReaderSettings;
	export let onOpenVerse: (chapter: number, verse: number) => Promise<void>;

	let query = "";
	let source: SearchSource = "all";
	let language: SearchLanguage = "both";
	let fuzziness: SearchFuzziness = "balanced";
	let resultQuery = "";
	let resultFuzziness: SearchFuzziness = "balanced";
	let searching = false;
	let status = "Search Quran verses and hadiths by Arabic or English text, or enter a reference such as 2:255.";
	let error = "";
	let searchResults: OmniSearchResult[] = [];
	let totalResults = 0;
	let visibleCount = 20;
	let quranIndex: QuranSearchEntry[] | null = null;
	let hadithIndex: HadithSearchEntry[] | null = null;
	let quranIndexPromise: Promise<QuranSearchEntry[]> | null = null;
	let hadithIndexPromise: Promise<HadithSearchEntry[]> | null = null;
	let searchRun = 0;
	let indexGeneration = 0;

	const MAX_RESULTS = 200;
	const RESULTS_PER_BATCH = 20;
	$: visibleResults = searchResults.slice(0, visibleCount);
	$: hasMore = visibleCount < searchResults.length;

	function ensureQuranIndex(): Promise<QuranSearchEntry[]> {
		if (quranIndex) return Promise.resolve(quranIndex);
		if (!quranIndexPromise) {
			const generation = indexGeneration;
			quranIndexPromise = loadQuranSearchIndex(app, manifestDir, settings)
				.then((index) => {
					if (generation === indexGeneration) quranIndex = index;
					return index;
				})
				.catch((e) => {
					if (generation === indexGeneration) quranIndexPromise = null;
					throw e;
				});
		}
		return quranIndexPromise;
	}

	function ensureHadithIndex(run: number): Promise<HadithSearchEntry[]> {
		if (hadithIndex) return Promise.resolve(hadithIndex);
		if (!hadithIndexPromise) {
			const generation = indexGeneration;
			hadithIndexPromise = loadHadithSearchIndex(app, manifestDir, (message) => {
				if (run === searchRun) status = message;
			})
				.then((index) => {
					if (generation === indexGeneration) hadithIndex = index;
					return index;
				})
				.catch((e) => {
					if (generation === indexGeneration) hadithIndexPromise = null;
					throw e;
				});
		}
		return hadithIndexPromise;
	}

	async function performSearch() {
		const searchQuery = query.trim();
		if (!searchQuery) {
			new Notice("Enter a search term or Quran reference.");
			return;
		}

		const run = ++searchRun;
		resultQuery = searchQuery;
		resultFuzziness = fuzziness;
		searching = true;
		searchResults = [];
		totalResults = 0;
		visibleCount = RESULTS_PER_BATCH;
		error = "";
		status = "Preparing search index…";

		try {
			const referenceSearch = source === "all" && parseVerseReference(searchQuery) !== null;
			const [quran, hadith] = await Promise.all([
				source === "hadith" ? Promise.resolve([]) : ensureQuranIndex(),
				source === "quran" || referenceSearch
					? Promise.resolve([])
					: ensureHadithIndex(run)
			]);
			if (run !== searchRun) return;

			const matches = searchOmniIndex(
				searchQuery,
				source,
				language,
				resultFuzziness,
				quran,
				hadith
			);
			totalResults = matches.length;
			searchResults = matches.slice(0, MAX_RESULTS);
			status = matches.length > MAX_RESULTS
				? `Showing the best ${MAX_RESULTS} of ${matches.length} matches.`
				: `Found ${matches.length} result${matches.length === 1 ? "" : "s"}.`;
		} catch (e) {
			if (run !== searchRun) return;
			error = e instanceof Error ? e.message : String(e);
			status = "Search could not be completed.";
		} finally {
			if (run === searchRun) searching = false;
		}
	}

	function loadMore() {
		visibleCount = Math.min(visibleCount + RESULTS_PER_BATCH, searchResults.length);
	}

	function highlightSegments(text: string) {
		return getHighlightSegments(text, resultQuery, resultFuzziness);
	}

	export function resetIndexes() {
		searchRun++;
		indexGeneration++;
		quranIndex = null;
		hadithIndex = null;
		quranIndexPromise = null;
		hadithIndexPromise = null;
		searchResults = [];
		totalResults = 0;
		searching = false;
		error = "";
		status = "Search indexes will be rebuilt the next time you search.";
	}

	function editionLabel(edition: string): string {
		return edition
			.replace(/^(ara|eng)-/, "")
			.replace(/-/g, " ")
			.replace(/\b\w/g, (letter) => letter.toUpperCase());
	}

	async function openVerse(entry: QuranSearchEntry) {
		try {
			await onOpenVerse(entry.chapter, entry.verse);
		} catch (e) {
			new Notice(`Could not open Quran verse: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	function getHadithInsertText(hadith: Hadith, result: Extract<OmniSearchResult, { kind: "hadith" }>): string {
		return formatHadithForInsert(hadith, result.entry.bookRef, result.entry.chapter, settings.insertFormat);
	}

	async function copyHadith(
		hadith: Hadith,
		result: Extract<OmniSearchResult, { kind: "hadith" }>
	) {
		try {
			await navigator.clipboard.writeText(getHadithInsertText(hadith, result));
			new Notice("Hadith copied to clipboard.");
		} catch {
			new Notice("Could not copy hadith to clipboard.");
		}
	}

	async function insertHadith(
		hadith: Hadith,
		result: Extract<OmniSearchResult, { kind: "hadith" }>
	) {
		const text = getHadithInsertText(hadith, result);
		const activeFile = app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice("No active note to insert into.");
			return;
		}
		const editor = app.workspace.activeEditor?.editor;
		if (editor) {
			editor.replaceSelection(text);
			new Notice("Hadith inserted into active note.");
			return;
		}
		const current = await app.vault.read(activeFile);
		await app.vault.modify(activeFile, `${current}\n\n${text}`);
		new Notice("Hadith appended to active note.");
	}

	function getSafeBookFolder(fileName: string, bookId: number): string {
		return fileName.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || `book-${bookId}`;
	}

	async function ensureVaultFolder(folderPath: string) {
		let currentPath = "";
		for (const segment of folderPath.split("/")) {
			currentPath = currentPath ? `${currentPath}/${segment}` : segment;
			if (!app.vault.getAbstractFileByPath(currentPath)) await app.vault.createFolder(currentPath);
		}
	}

	async function createHadithNote(
		hadith: Hadith,
		result: Extract<OmniSearchResult, { kind: "hadith" }>
	) {
		const { bookRef, chapter } = result.entry;
		const bookFolder = getSafeBookFolder(bookRef.fileName, bookRef.id);
		const folderPath = `obsideen/hadith/${bookFolder}/${hadith.idInBook}`;
		const notePath = `${folderPath}/Hadith ${hadith.idInBook}.md`;
		try {
			const existing = app.vault.getAbstractFileByPath(notePath);
			if (existing) {
				if (existing instanceof TFile) {
					await app.workspace.getLeaf(false).openFile(existing);
					new Notice("Hadith note already exists; opened it.");
					return;
				}
				throw new Error(`A folder already exists at ${notePath}.`);
			}
			await ensureVaultFolder(folderPath);
			const contents = [
				`# ${bookRef.englishTitle} — Hadith ${hadith.idInBook}`,
				"",
				`**Collection:** ${bookRef.englishTitle}`,
				`**Reference:** Hadith ${hadith.idInBook}`,
			chapter?.english ? `**Chapter:** ${chapter.english}` : null,
			hadith.english.narrator ? `**Narrator:** ${hadith.english.narrator}` : null,
				"",
				"## Arabic",
				"",
				hadith.arabic,
				"",
				"## English",
				"",
				hadith.english.text,
				"",
				"## Personal notes",
				"",
				"**Reflection:**",
				"",
				"**Questions:**",
				"",
				"**Further study:**",
				""
			].filter((line): line is string => line !== null).join("\n");
			const file = await app.vault.create(notePath, contents);
			await app.workspace.getLeaf(false).openFile(file);
			new Notice(`Created hadith note: ${bookRef.englishTitle} ${hadith.idInBook}.`);
		} catch (e) {
			new Notice(`Could not create hadith note: ${e instanceof Error ? e.message : String(e)}`);
		}
	}
</script>

<div class="obsideen-omni-search">
	<form class="obsideen-omni-toolbar" on:submit|preventDefault={performSearch}>
		<input
			class="obsideen-omni-query"
			type="search"
			placeholder="Search Quran and hadiths…"
			aria-label="Search Quran and hadiths"
			bind:value={query}
			disabled={searching}
		/>
		<select aria-label="Search source" bind:value={source} disabled={searching}>
			<option value="all">Quran & Hadith</option>
			<option value="quran">Quran only</option>
			<option value="hadith">Hadith only</option>
		</select>
		<select aria-label="Search language" bind:value={language} disabled={searching}>
			<option value="both">Arabic & English</option>
			<option value="arabic">Arabic only</option>
			<option value="english">English only</option>
		</select>
		<label class="obsideen-omni-fuzziness" title="Choose how closely each word must match. Every query word must still match the same verse or hadith text.">
			<span>Fuzziness</span>
			<select aria-label="Search fuzziness" bind:value={fuzziness} disabled={searching}>
				<option value="strict">Strict</option>
				<option value="balanced">Balanced</option>
				<option value="fuzzy">Fuzzy</option>
			</select>
		</label>
		<button class="obsideen-action-btn mod-cta" type="submit" disabled={searching}>
			{searching ? "Searching…" : "Search"}
		</button>
	</form>

	<div class="obsideen-omni-hint">Strict matches complete words. Balanced also matches prefixes, word fragments, and close spellings; Fuzzy tolerates looser spellings. Every query word must still match the same text. Arabic diacritics are ignored. Use a reference like 2:255 to jump to a verse.</div>
	<div class="obsideen-omni-status" aria-live="polite">{status}</div>
	{#if error}
		<div class="obsideen-omni-error">{error}</div>
	{/if}

	<div class="obsideen-omni-results">
		{#if searching}
			<div class="obsideen-loading">Building search index…</div>
		{:else if query.trim() && searchResults.length === 0 && !error}
			<div class="obsideen-empty">No Quran verses or hadiths matched this search.</div>
		{:else}
			{#each visibleResults as result (`${result.kind}-${result.kind === "quran" ? `${result.entry.chapter}:${result.entry.verse}` : `${result.entry.bookRef.id}:${result.entry.hadith.id}`}`)}
				{#if result.kind === "quran"}
					<article class="obsideen-omni-result obsideen-omni-quran-result">
						<div class="obsideen-omni-result-header">
							<div>
								<span class="obsideen-omni-source">Quran</span>
								<strong>{result.entry.chapterName} · {result.entry.chapter}:{result.entry.verse}</strong>
							</div>
							<span class="obsideen-omni-page">Page {result.entry.page}</span>
						</div>
						{#if result.entry.arabicTexts[0]}
							<div class="obsideen-omni-arabic" dir="rtl">
								{#each highlightSegments(result.entry.arabicTexts[0].text) as segment}
									{#if segment.match}<mark class="obsideen-search-highlight">{segment.text}</mark>{:else}{segment.text}{/if}
								{/each}
							</div>
						{/if}
						{#if result.translation}
							<div class="obsideen-omni-translation">
								{#each highlightSegments(result.translation.text) as segment}
									{#if segment.match}<mark class="obsideen-search-highlight">{segment.text}</mark>{:else}{segment.text}{/if}
								{/each}
							</div>
							<div class="obsideen-omni-translation-label">{editionLabel(result.translation.edition)}</div>
						{/if}
						<div class="obsideen-omni-result-actions">
							<button class="obsideen-action-btn mod-cta" on:click={() => openVerse(result.entry)}>
								Open in Quran reader
							</button>
						</div>
					</article>
				{:else}
					<HadithResult
						hadith={result.entry.hadith}
						bookRef={result.entry.bookRef}
						chapter={result.entry.chapter}
						highlightQuery={resultQuery}
						fuzziness={resultFuzziness}
						onCopy={(hadith) => copyHadith(hadith, result)}
						onInsert={(hadith) => insertHadith(hadith, result)}
						onCreateNote={(hadith) => createHadithNote(hadith, result)}
					/>
				{/if}
			{/each}
			{#if hasMore}
				<LazySentinel onVisible={loadMore} />
			{/if}
		{/if}
	</div>
</div>
