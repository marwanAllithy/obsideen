<script lang="ts">
	import type { ChapterInfo } from "../../shared/types";

	export let chapters: ChapterInfo[];
	export let currentSurah: number;
	export let readerMode: "translation" | "qcf";
	export let onChangeSurah: (surah: number) => void;
	export let onJumpToVerse: (verse: number) => void;
	export let onToggleMode: () => void;

	let jumpValue = "";

	function handleSurahChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		onChangeSurah(parseInt(target.value, 10));
	}

	function handleJump() {
		const num = parseInt(jumpValue, 10);
		if (num) onJumpToVerse(num);
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === "Enter") handleJump();
	}

	function prev() {
		onChangeSurah(currentSurah - 1);
	}

	function next() {
		onChangeSurah(currentSurah + 1);
	}
</script>

<div class="obsideen-toolbar">
	<button class="obsideen-nav-btn" on:click={prev}>‹ Prev</button>

	<select class="obsideen-surah-select" value={currentSurah} on:change={handleSurahChange}>
		{#each chapters as ch}
			<option value={ch.chapter}>{ch.chapter}. {ch.englishname} — {ch.arabicname}</option>
		{/each}
	</select>

	<button class="obsideen-nav-btn" on:click={next}>Next ›</button>

	<input
		class="obsideen-jump-input"
		type="number"
		min="1"
		placeholder="Verse"
		bind:value={jumpValue}
		on:keydown={handleKeyDown}
	/>
	<button class="obsideen-nav-btn" on:click={handleJump}>Go</button>

	<button class="obsideen-nav-btn" on:click={onToggleMode}>
		{#if readerMode === "qcf"}
			With translation
		{:else}
			QCF layout
		{/if}
	</button>
</div>
