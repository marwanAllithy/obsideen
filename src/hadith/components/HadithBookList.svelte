<script lang="ts">
	import type { HadithBookRef } from "../../shared/types";

	export let books: HadithBookRef[];
	export let onOpen: (book: HadithBookRef) => void;
</script>

<div class="obsideen-hadith-library">
	{#if books.length === 0}
		<div class="obsideen-empty">No hadith books found.</div>
	{:else}
		<div class="obsideen-hadith-book-grid">
			{#each books as book (book.id)}
				<button
					class="obsideen-hadith-book-card"
					on:click={() => onOpen(book)}
					type="button"
				>
					<div class="obsideen-hadith-book-card-title">{book.englishTitle}</div>
					<div class="obsideen-hadith-book-card-arabic">{book.arabicTitle}</div>
					<div class="obsideen-hadith-book-card-meta">{book.englishAuthor}</div>
					<div class="obsideen-hadith-book-card-count">{book.length} hadiths</div>
				</button>
			{/each}
		</div>
	{/if}
</div>
