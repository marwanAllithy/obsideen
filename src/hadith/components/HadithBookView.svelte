<script lang="ts">
	import type { HadithBookRef, HadithBookFile, Hadith, HadithChapter } from "../../shared/types";
	import { matchesHadith } from "../loader";
	import HadithResult from "./HadithResult.svelte";
	import LazySentinel from "../../shared/components/LazySentinel.svelte";

	const HADITHS_PER_BATCH = 20;

	export let bookRef: HadithBookRef;
	export let bookData: HadithBookFile;
	export let onBack: () => void;
	export let onCopy: (hadith: Hadith) => void;
	export let onInsert: (hadith: Hadith) => void;
	export let onCreateNote: (hadith: Hadith) => void;

	type HadithSection = {
		chapterId: number;
		chapter: HadithChapter | undefined;
		ordinal: number;
		hadithCount: number;
	};

	let selectedChapterId: number | null = null;
	let query = "";
	let visibleCount = HADITHS_PER_BATCH;
	let filterKey = "";

	$: chapterMap = new Map(bookData.chapters.map((c) => [c.id, c]));
	$: sections = ((): HadithSection[] => {
		const counts = new Map<number, number>();
		for (const hadith of bookData.hadiths) {
			counts.set(hadith.chapterId, (counts.get(hadith.chapterId) || 0) + 1);
		}

		const knownChapterIds = new Set(bookData.chapters.map((chapter) => chapter.id));
		const result = bookData.chapters
			.map((chapter, index) => ({
				chapterId: chapter.id,
				chapter,
				ordinal: index + 1,
				hadithCount: counts.get(chapter.id) || 0
			}))
			.filter((section) => section.hadithCount > 0);

		for (const [chapterId, hadithCount] of counts) {
			if (!knownChapterIds.has(chapterId)) {
				result.push({
					chapterId,
					chapter: undefined,
					ordinal: result.length + 1,
					hadithCount
				});
			}
		}

		return result;
	})();
	$: selectedSection = sections.find((section) => section.chapterId === selectedChapterId);

	// Reset pagination when opening another internal book or changing its search.
	$: {
		const newKey = `${selectedChapterId ?? "sections"}:${query.trim()}`;
		if (newKey !== filterKey) {
			filterKey = newKey;
			visibleCount = HADITHS_PER_BATCH;
		}
	}

	$: filteredHadiths = ((): Hadith[] => {
		if (selectedChapterId === null) return [];
		let list = bookData.hadiths.filter((hadith) => hadith.chapterId === selectedChapterId);
		if (query.trim()) {
			list = list.filter((hadith) => matchesHadith(hadith, query, "both"));
		}
		return list;
	})();
	$: visibleHadiths = filteredHadiths.slice(0, visibleCount);
	$: hasMore = visibleCount < filteredHadiths.length;

	function sectionTitle(section: HadithSection): string {
		return section.chapter?.english || section.chapter?.arabic || `Book ${section.ordinal}`;
	}

	function openSection(chapterId: number) {
		selectedChapterId = chapterId;
		query = "";
		visibleCount = HADITHS_PER_BATCH;
	}

	function backToSections() {
		selectedChapterId = null;
		query = "";
		visibleCount = HADITHS_PER_BATCH;
	}

	function loadMoreHadiths() {
		if (visibleCount >= filteredHadiths.length) return;
		visibleCount = Math.min(visibleCount + HADITHS_PER_BATCH, filteredHadiths.length);
	}
</script>

<div class="obsideen-hadith-book">
	<div class="obsideen-hadith-book-header">
		{#if selectedChapterId === null}
			<button class="obsideen-nav-btn" on:click={onBack}>‹ Back to collections</button>
		{:else}
			<button class="obsideen-nav-btn" on:click={backToSections}>‹ All books in this collection</button>
		{/if}
		<div class="obsideen-hadith-book-title">{bookRef.englishTitle}</div>
		<div class="obsideen-hadith-book-subtitle">{bookRef.arabicTitle}</div>
		{#if selectedSection}
			<div class="obsideen-hadith-section-current-title">Book {selectedSection.ordinal}: {sectionTitle(selectedSection)}</div>
			{#if selectedSection.chapter?.arabic && selectedSection.chapter.english}
				<div class="obsideen-hadith-section-current-arabic" dir="rtl">{selectedSection.chapter.arabic}</div>
			{/if}
			<div class="obsideen-hadith-book-meta">{selectedSection.hadithCount} hadiths</div>
		{:else}
			<div class="obsideen-hadith-book-meta">{bookRef.englishAuthor} · {sections.length} internal books · {bookRef.length} hadiths</div>
		{/if}
	</div>

	<div class="obsideen-hadith-book-results">
		{#if selectedChapterId === null}
			{#if sections.length === 0}
				<div class="obsideen-empty">No internal books were found in this collection.</div>
			{:else}
				<div class="obsideen-hadith-section-list">
					{#each sections as section (section.chapterId)}
						<button
							class="obsideen-hadith-section-card"
							on:click={() => openSection(section.chapterId)}
							type="button"
						>
							<div class="obsideen-hadith-section-card-top">
								<span class="obsideen-hadith-section-number">Book {section.ordinal}</span>
								<span class="obsideen-hadith-section-count">{section.hadithCount} hadiths</span>
							</div>
							<div class="obsideen-hadith-section-card-title">{sectionTitle(section)}</div>
							{#if section.chapter?.arabic && section.chapter.english}
								<div class="obsideen-hadith-section-card-arabic" dir="rtl">{section.chapter.arabic}</div>
							{/if}
						</button>
					{/each}
				</div>
			{/if}
		{:else}
			<div class="obsideen-hadith-book-filters">
				<input
					class="obsideen-hadith-query"
					type="text"
					placeholder="Filter hadiths in this book…"
					bind:value={query}
				/>
			</div>

			{#if filteredHadiths.length === 0}
				<div class="obsideen-empty">No hadiths match the current filter.</div>
			{:else}
				{#each visibleHadiths as hadith (hadith.id)}
					<HadithResult
						{hadith}
						{bookRef}
						chapter={selectedSection?.chapter}
						showChapter={false}
						onCopy={onCopy}
						onInsert={onInsert}
						onCreateNote={onCreateNote}
					/>
				{/each}
				{#if hasMore}
					<LazySentinel onVisible={loadMoreHadiths} />
				{/if}
			{/if}
		{/if}
	</div>
</div>
