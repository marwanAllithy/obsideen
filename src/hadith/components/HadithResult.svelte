<script lang="ts">
	import type { Hadith, HadithBookRef, HadithChapter } from "../../shared/types";
	import {
		getHighlightSegments,
		type SearchFuzziness
	} from "../../shared/utils/search";

	export let hadith: Hadith;
	export let bookRef: HadithBookRef;
	export let chapter: HadithChapter | undefined;
	export let onCopy: (hadith: Hadith) => void;
	export let onInsert: (hadith: Hadith) => void;
	export let onCreateNote: (hadith: Hadith) => void;
	export let showChapter = true;
	export let highlightQuery = "";
	export let fuzziness: SearchFuzziness = "balanced";

	function segments(text: string) {
		return getHighlightSegments(text, highlightQuery, fuzziness);
	}

	function handleCopy() {
		onCopy(hadith);
	}

	function handleInsert() {
		onInsert(hadith);
	}

	function handleCreateNote() {
		onCreateNote(hadith);
	}
</script>

<div class="obsideen-hadith-result">
	<div class="obsideen-hadith-header">
		<div class="obsideen-hadith-title">
			{bookRef.englishTitle}
			{#if chapter && showChapter}
				— {chapter.english}
			{/if}
		</div>
		<div class="obsideen-hadith-ref">
			Hadith {hadith.idInBook} · {bookRef.arabicTitle}
		</div>
	</div>

	{#if hadith.english.narrator}
		<div class="obsideen-hadith-narrator">
			{#each segments(hadith.english.narrator) as segment}
				{#if segment.match}<mark class="obsideen-search-highlight">{segment.text}</mark>{:else}{segment.text}{/if}
			{/each}
		</div>
	{/if}

	<div class="obsideen-hadith-arabic" dir="rtl">
		{#each segments(hadith.arabic) as segment}
			{#if segment.match}<mark class="obsideen-search-highlight">{segment.text}</mark>{:else}{segment.text}{/if}
		{/each}
	</div>

	<div class="obsideen-hadith-english">
		{#each segments(hadith.english.text) as segment}
			{#if segment.match}<mark class="obsideen-search-highlight">{segment.text}</mark>{:else}{segment.text}{/if}
		{/each}
	</div>

	<div class="obsideen-hadith-actions">
		<button class="obsideen-action-btn" on:click={handleCopy}>Copy</button>
		<button class="obsideen-action-btn mod-cta" on:click={handleInsert}>Insert</button>
		<button class="obsideen-action-btn" on:click={handleCreateNote}>Create note</button>
	</div>
</div>
