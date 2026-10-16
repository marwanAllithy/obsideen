<script lang="ts">
	import type { App } from "obsidian";
	import type { ChapterInfo, PageCatalog, QcfPageData, QuranWord } from "../../shared/types";
	import { toArabicIndicDigits } from "../../shared/utils/arabic";
	import { isCenterAlignedLine } from "../utils/qcf-layout";
	import { loadQcfPageData, getQcfFontUrl, getPagesForChapter } from "../data-loader";
	import LazySentinel from "../../shared/components/LazySentinel.svelte";

	const PAGES_PER_BATCH = 5;

	export let chapter: ChapterInfo | undefined;
	export let pageCatalog: PageCatalog | null;
	export let app: App;
	export let manifestDir: string;
	export let jumpTargetVerse = 0;
	export let selectedVerses: Set<number>;
	export let onToggleVerse: (verse: number) => void;

	let qcfPages: QcfPageData[] = [];
	let loading = false;
	let error = "";
	let loadedFonts = new Set<number>();
	let visiblePageCount = PAGES_PER_BATCH;
	let lastChapter = 0;

	$: chapterPages = chapter ? getPagesForChapter(pageCatalog, chapter.chapter) : [];
	$: visibleChapterPages = chapterPages.slice(0, visiblePageCount);
	$: hasMorePages = visiblePageCount < chapterPages.length;

	// Reset pagination and cached pages when the chapter changes.
	$: if (chapter && chapter.chapter !== lastChapter) {
		lastChapter = chapter.chapter;
		visiblePageCount = PAGES_PER_BATCH;
		qcfPages = [];
	}

	// Ensure the target verse is rendered when jumping.
	$: if (jumpTargetVerse > 0 && chapter && chapterPages.length > 0) {
		const targetInfo = chapter.verses.find((v) => v.verse === jumpTargetVerse);
		if (targetInfo) {
			const targetIndex = chapterPages.findIndex((p) => p.page === targetInfo.page);
			if (targetIndex >= 0) {
				visiblePageCount = Math.max(visiblePageCount, targetIndex + 1);
			}
		}
	}

	// Load data for the current visible page window.
	$: if (chapter && app && manifestDir && visibleChapterPages.length > 0) {
		void loadVisiblePages();
	}

	function loadMorePages() {
		if (visiblePageCount >= chapterPages.length || loading) return;
		visiblePageCount = Math.min(visiblePageCount + PAGES_PER_BATCH, chapterPages.length);
	}

	async function loadVisiblePages() {
		if (visibleChapterPages.length === 0) {
			qcfPages = [];
			return;
		}
		loading = true;
		error = "";

		const chapterNumber = chapter!.chapter;
		const results = await Promise.all(
			visibleChapterPages.map(async (pageRef) => {
				const cached = qcfPages.find((p) => p.page === pageRef.page);
				if (cached) return cached;

				const pageData = await loadQcfPageData(app, manifestDir, pageRef.page);
				if (!pageData) return null;

				const fontUrl = getQcfFontUrl(app, manifestDir, pageRef.page);
				injectQcfFontStyle(pageRef.page, fontUrl);

				const filteredLines = pageData.lines.map((line) => ({
					lineNumber: line.lineNumber,
					words: line.words.filter(
						(w) => parseInt(w.verse_key.split(":")[0], 10) === chapterNumber
					),
					isPartial: isCenterAlignedLine(pageRef.page, line.lineNumber)
				}));

				await loadQcfFont(pageRef.page);
				return { page: pageRef.page, lines: filteredLines };
			})
		);

		const failed = results.findIndex((r) => r === null);
		if (failed >= 0) {
			error = `Failed to load page ${visibleChapterPages[failed].page} data.`;
		} else {
			error = "";
			// Preserve already-loaded pages and append newly loaded ones in page order.
			const merged = new Map(qcfPages.map((p) => [p.page, p]));
			for (const page of results as QcfPageData[]) {
				merged.set(page.page, page);
			}
			qcfPages = Array.from(merged.values()).sort((a, b) => a.page - b.page);
		}
		loading = false;
	}

	function fontFamily(page: number): string {
		return `QCFp${page}`;
	}

	function injectQcfFontStyle(page: number, fontUrl: string) {
		const id = `obsideen-qcf-font-${page}`;
		if (document.getElementById(id)) return;
		const style = document.createElement("style");
		style.id = id;
		style.textContent = `
			@font-face {
				font-family: "${fontFamily(page)}";
				src: url("${fontUrl}") format("woff2");
				font-display: block;
			}
		`;
		document.head.appendChild(style);
	}

	async function loadQcfFont(page: number) {
		if (loadedFonts.has(page)) return;
		try {
			await document.fonts.load(`1em ${fontFamily(page)}`);
			loadedFonts = new Set(loadedFonts);
			loadedFonts.add(page);
		} catch (e) {
			console.error("Obsideen: failed to load QCF font for page", page, e);
		}
	}

	function wordDisplay(word: QuranWord, page: number): string {
		// Only use the QCF glyph code if the per-page font actually loaded;
		// otherwise the glyph code renders as tofu/boxes.
		if (word.code_v2 && loadedFonts.has(page)) return word.code_v2;
		return word.text_uthmani;
	}

	function isMarker(word: QuranWord): boolean {
		return word.char_type_name === "end";
	}

	function verseNumber(word: QuranWord): number | undefined {
		const [chapterNumber, verse] = word.verse_key.split(":").map(Number);
		return chapterNumber === chapter?.chapter ? verse : undefined;
	}

	function isVerseSelected(word: QuranWord): boolean {
		const verse = verseNumber(word);
		return verse !== undefined && selectedVerses.has(verse);
	}

	function toggleWordVerse(word: QuranWord) {
		const verse = verseNumber(word);
		if (verse !== undefined) onToggleVerse(verse);
	}
</script>

<div class="obsideen-qcf-page">
	{#if loading && qcfPages.length === 0}
		<div class="obsideen-loading">Loading QCF layout…</div>
	{:else if error}
		<div class="obsideen-empty">{error}</div>
	{:else if qcfPages.length === 0}
		<div class="obsideen-empty">No page data.</div>
	{:else}
		{#each qcfPages as page (page.page)}
			<div class="obsideen-qcf-sheet">
				<div class="obsideen-qcf-lines">
					{#each page.lines as line (line.lineNumber)}
						<div
							class="obsideen-qcf-line"
							class:partial={line.isPartial}
							data-line={line.lineNumber}
						>
							{#each line.words as word (word.id)}
								<span
									class="obsideen-qcf-word"
									class:marker={isMarker(word)}
									class:selected={isVerseSelected(word)}
									data-verse={verseNumber(word)}
									style="font-family: '{fontFamily(page.page)}', var(--obsideen-font-arabic);"
									on:click|stopPropagation={() => toggleWordVerse(word)}
								>
									{wordDisplay(word, page.page)}
								</span>
							{/each}
						</div>
					{/each}
				</div>
				<div class="obsideen-qcf-page-number">{toArabicIndicDigits(page.page)}</div>
			</div>
		{/each}
		{#if hasMorePages}
			<LazySentinel onVisible={loadMorePages} disabled={loading} />
		{/if}
	{/if}
</div>
