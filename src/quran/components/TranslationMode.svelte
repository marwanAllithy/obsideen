<script lang="ts">
	import type { ChapterInfo, VerseInfo, VerseText, EditionMeta } from "../../shared/types";
	import Verse from "./Verse.svelte";
	import LazySentinel from "../../shared/components/LazySentinel.svelte";

	const PAGES_PER_BATCH = 5;

	export let chapter: ChapterInfo | undefined;
	export let verseTexts: Map<number, VerseText>;
	export let primaryMeta: EditionMeta | undefined;
	export let primaryEdition: string;
	export let jumpTargetVerse = 0;
	export let onOpenTafsir: (verse: number) => void;
	export let onCreateNote: (verse: number) => void;

	let visiblePageCount = PAGES_PER_BATCH;
	let lastChapter = 0;

	// Reset pagination when the chapter changes.
	$: if (chapter && chapter.chapter !== lastChapter) {
		lastChapter = chapter.chapter;
		visiblePageCount = PAGES_PER_BATCH;
	}

	function getPageEndIndices(verses: VerseInfo[]): number[] {
		const ends: number[] = [];
		let lastPage = -1;
		for (let i = 0; i < verses.length; i++) {
			if (verses[i].page !== lastPage) {
				if (lastPage !== -1) ends.push(i);
				lastPage = verses[i].page;
			}
		}
		ends.push(verses.length);
		return ends;
	}

	$: pageEndIndices = chapter ? getPageEndIndices(chapter.verses) : [];
	$: totalPages = pageEndIndices.length;
	$: visibleEndIndex =
		pageEndIndices[Math.min(visiblePageCount, totalPages) - 1] ??
		(chapter ? chapter.verses.length : 0);
	$: visibleVerses = chapter ? chapter.verses.slice(0, visibleEndIndex) : [];
	$: hasMorePages = visiblePageCount < totalPages;

	// Ensure the target verse is rendered when jumping.
	$: if (jumpTargetVerse > 0 && chapter && pageEndIndices.length > 0) {
		const targetIndex = chapter.verses.findIndex((v) => v.verse === jumpTargetVerse);
		if (targetIndex >= 0) {
			const targetPageIndex = pageEndIndices.findIndex((end) => end > targetIndex);
			if (targetPageIndex >= 0) {
				visiblePageCount = Math.max(visiblePageCount, targetPageIndex + 1);
			}
		}
	}

	function loadMorePages() {
		if (visiblePageCount >= totalPages) return;
		visiblePageCount = Math.min(visiblePageCount + PAGES_PER_BATCH, totalPages);
	}
</script>

<div class="obsideen-translation-list">
	{#if chapter}
		{#each visibleVerses as verse}
			{@const texts = verseTexts.get(verse.verse)}
			{#if texts && (texts.primary || texts.secondary)}
				<Verse
					{verse}
					{texts}
					{primaryMeta}
					{primaryEdition}
					showTranslation={true}
					{onOpenTafsir}
					{onCreateNote}
				/>
			{/if}
		{/each}
		{#if hasMorePages}
			<LazySentinel onVisible={loadMorePages} />
		{/if}
	{/if}
</div>
