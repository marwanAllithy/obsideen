<script lang="ts">
	import { Notice, TFile, type App } from "obsidian";
	import type {
		Hadith,
		HadithBookRef,
		HadithBookFile,
		HadithChapter,
		ReaderSettings
	} from "../../shared/types";
	import {
		discoverHadithBooks,
		loadHadithBook,
		matchesHadith,
		formatHadithForInsert,
		getHadithBasePath
	} from "../loader";
	import HadithBookList from "./HadithBookList.svelte";
	import HadithBookView from "./HadithBookView.svelte";
	import HadithResult from "./HadithResult.svelte";
	import LazySentinel from "../../shared/components/LazySentinel.svelte";

	export let app: App;
	export let manifestDir: string;
	export let settings: ReaderSettings;

	$: basePath = getHadithBasePath(manifestDir);

	let books: HadithBookRef[] = [];
	let status = "";
	let error = "";
	let activeView: "books" | "book" | "search" = "books";
	let selectedBook: HadithBookRef | null = null;
	let bookData: HadithBookFile | null = null;
	let bookCache = new Map<number, HadithBookFile>();
	let query = "";
	let searchIn: "english" | "arabic" | "both" = "both";
	let searching = false;
	let searchResults: {
		hadith: Hadith;
		bookRef: HadithBookRef;
		chapter: HadithChapter | undefined;
	}[] = [];

	const MAX_RESULTS = 200;
	const HADITHS_PER_BATCH = 20;

	let visibleSearchCount = HADITHS_PER_BATCH;

	$: visibleSearchResults = searchResults.slice(0, visibleSearchCount);
	$: hasMoreSearchResults = visibleSearchCount < searchResults.length;

	export async function initialize() {
		await refreshBooks();
	}

	// Load books from the bundled collection.
	$: if (basePath) {
		void refreshBooks();
	}

	async function refreshBooks() {
		status = "Loading books…";
		error = "";
		const result = await discoverHadithBooks(app, manifestDir);
		books = result.books;
		if (result.error) {
			error = result.error;
			status = "";
		} else if (books.length === 0) {
			status = "";
			error = "No hadith books found in the bundled collection.";
		} else {
			status = `Loaded ${books.length} book${books.length === 1 ? "" : "s"}.`;
		}
	}

	async function openBook(ref: HadithBookRef) {
		selectedBook = ref;
		activeView = "book";
		bookData = await ensureBookLoaded(ref);
	}

	function backToBooks() {
		activeView = "books";
		selectedBook = null;
		bookData = null;
	}

	async function ensureBookLoaded(ref: HadithBookRef): Promise<HadithBookFile | null> {
		const cached = bookCache.get(ref.id);
		if (cached) return cached;
		const data = await loadHadithBook(app, basePath, ref);
		if (data) {
			bookCache.set(ref.id, data);
		}
		return data;
	}

	async function performSearch() {
		if (!query.trim()) {
			new Notice("Enter a search term.");
			return;
		}
		if (books.length === 0) {
			new Notice("No hadith books loaded to search.");
			return;
		}
		activeView = "search";
		searching = true;
		searchResults = [];
		visibleSearchCount = HADITHS_PER_BATCH;
		status = "Searching…";
		error = "";

		try {
			for (const ref of books) {
				const data = await ensureBookLoaded(ref);
				if (!data) continue;
				const chapterMap = new Map(data.chapters.map((c) => [c.id, c]));
				for (const hadith of data.hadiths) {
					if (matchesHadith(hadith, query, searchIn)) {
						searchResults = [
							...searchResults,
							{
								hadith,
								bookRef: ref,
								chapter: chapterMap.get(hadith.chapterId)
							}
						];
						if (searchResults.length >= MAX_RESULTS) {
							status = `Showing first ${MAX_RESULTS} results.`;
							searching = false;
							return;
						}
					}
				}
			}
			status = `Found ${searchResults.length} result${searchResults.length === 1 ? "" : "s"}.`;
		} finally {
			searching = false;
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === "Enter" && !searching) {
			performSearch();
		}
	}

	function loadMoreSearchResults() {
		if (visibleSearchCount >= searchResults.length) return;
		visibleSearchCount = Math.min(visibleSearchCount + HADITHS_PER_BATCH, searchResults.length);
	}

	function getBookRefById(id: number): HadithBookRef | undefined {
		return books.find((b) => b.id === id);
	}

	function getChapterForHadith(hadith: Hadith): HadithChapter | undefined {
		const data = bookCache.get(hadith.bookId);
		return data?.chapters.find((c) => c.id === hadith.chapterId);
	}

	function copyHadith(hadith: Hadith) {
		const ref = getBookRefById(hadith.bookId);
		if (!ref) return;
		const chapter = getChapterForHadith(hadith);
		const text = formatHadithForInsert(hadith, ref, chapter, settings.insertFormat);
		navigator.clipboard.writeText(text);
		new Notice("Hadith copied to clipboard.");
	}

	async function insertHadith(hadith: Hadith) {
		const ref = getBookRefById(hadith.bookId);
		if (!ref) return;
		const chapter = getChapterForHadith(hadith);
		const text = formatHadithForInsert(hadith, ref, chapter, settings.insertFormat);

		const activeFile = app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice("No active note to insert into.");
			return;
		}

		const editor = app.workspace.activeEditor?.editor;
		if (editor) {
			editor.replaceSelection(text);
			new Notice("Hadith inserted into active note.");
		} else {
			const current = await app.vault.read(activeFile);
			await app.vault.modify(activeFile, current + "\n\n" + text);
			new Notice("Hadith appended to active note.");
		}
	}

	function getSafeBookFolder(ref: HadithBookRef): string {
		return ref.fileName.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || `book-${ref.id}`;
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

	function makeHadithNote(hadith: Hadith, ref: HadithBookRef, chapter?: HadithChapter): string {
		const reference = `${ref.englishTitle} — Hadith ${hadith.idInBook}`;
		const chapterName = chapter?.english || chapter?.arabic;
		const details = [
			`**Collection:** ${ref.englishTitle}`,
			`**Reference:** Hadith ${hadith.idInBook}`,
			chapterName ? `**Chapter:** ${chapterName}` : "",
			hadith.english.narrator ? `**Narrator:** ${hadith.english.narrator}` : ""
		].filter(Boolean);

		return [
			`# ${reference}`,
			"",
			...details,
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
		].join("\n");
	}

	async function createHadithNote(hadith: Hadith) {
		const ref = getBookRefById(hadith.bookId);
		if (!ref) {
			new Notice("Could not find the hadith book for this note.");
			return;
		}

		const folderPath = `obsideen/hadith/${getSafeBookFolder(ref)}/${hadith.idInBook}`;
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
			const file = await app.vault.create(
				notePath,
				makeHadithNote(hadith, ref, getChapterForHadith(hadith))
			);
			await app.workspace.getLeaf(false).openFile(file);
			new Notice(`Created hadith note: ${ref.englishTitle} ${hadith.idInBook}.`);
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			new Notice(`Could not create hadith note: ${message}`);
		}
	}
</script>

<div class="obsideen-hadith-search">
	<div class="obsideen-hadith-toolbar">
		{#if activeView !== "books"}
			<button class="obsideen-nav-btn" on:click={backToBooks}>‹ Books</button>
		{/if}

		<input
			class="obsideen-hadith-query"
			type="text"
			placeholder="Search hadith in Arabic or English…"
			bind:value={query}
			on:keydown={handleKeyDown}
		/>

		<select class="obsideen-hadith-language" bind:value={searchIn}>
			<option value="both">Arabic & English</option>
			<option value="english">English only</option>
			<option value="arabic">Arabic only</option>
		</select>

		<button class="obsideen-action-btn mod-cta" on:click={performSearch} disabled={searching}>
			{searching ? "Searching…" : "Search"}
		</button>

		<button class="obsideen-nav-btn" on:click={refreshBooks} title="Reload books from disk">
			Reload
		</button>
	</div>

	{#if status}
		<div class="obsideen-hadith-status">{status}</div>
	{/if}

	{#if error}
		<div class="obsideen-hadith-error">
			<div>{error}</div>
		</div>
	{/if}

	<div class="obsideen-hadith-results">
		{#if activeView === "books"}
			<HadithBookList {books} onOpen={openBook} />
		{:else if activeView === "book" && selectedBook && bookData}
			<HadithBookView
				bookRef={selectedBook}
				{bookData}
				onBack={backToBooks}
				onCopy={copyHadith}
				onInsert={insertHadith}
				onCreateNote={createHadithNote}
			/>
		{:else if activeView === "search"}
			{#if searching}
				<div class="obsideen-loading">Searching…</div>
			{:else if searchResults.length === 0}
				<div class="obsideen-empty">No hadiths matched your search.</div>
			{:else}
				{#each visibleSearchResults as result (result.hadith.id)}
					<HadithResult
						hadith={result.hadith}
						bookRef={result.bookRef}
						chapter={result.chapter}
						onCopy={copyHadith}
						onInsert={insertHadith}
						onCreateNote={createHadithNote}
					/>
				{/each}
				{#if hasMoreSearchResults}
					<LazySentinel onVisible={loadMoreSearchResults} />
				{/if}
			{/if}
		{/if}
	</div>
</div>
