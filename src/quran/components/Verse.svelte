<script lang="ts">
	import type { VerseInfo, VerseText, EditionMeta } from "../../shared/types";
	import { isArabicEdition } from "../data-loader";

	export let verse: VerseInfo;
	export let texts: VerseText;
	export let primaryMeta: EditionMeta | undefined;
	export let primaryEdition: string;
	export let showTranslation: boolean;
	export let selected = false;
	export let onToggle: ((verse: number) => void) | undefined = undefined;
	export let onOpenTafsir: ((verse: number) => void) | undefined = undefined;
	export let onCreateNote: ((verse: number) => void) | undefined = undefined;

	function toggle() {
		if (onToggle) onToggle(verse.verse);
	}

	function openTafsir() {
		if (onOpenTafsir) onOpenTafsir(verse.verse);
	}

	function createNote() {
		if (onCreateNote) onCreateNote(verse.verse);
	}

	$: primaryIsArabic = isArabicEdition(primaryMeta, primaryEdition);
	$: clickable = !!onToggle;
</script>

<div
	class="obsideen-verse"
	class:selected
	class:sajda={verse.sajda}
	data-verse={verse.verse}
>
	<div
		class="obsideen-verse-badge"
		class:clickable
		on:click|stopPropagation={clickable ? toggle : undefined}
		role={clickable ? "button" : undefined}
		tabindex={clickable ? 0 : undefined}
	>
		<span class="obsideen-verse-number">{verse.verse}</span>
		{#if verse.sajda}
			<span class="obsideen-sajda-marker" title="Verse of prostration">Sajda</span>
		{/if}
	</div>
	<div class="obsideen-verse-content">
		{#if showTranslation && onOpenTafsir}
			<div class="obsideen-verse-actions">
				<div class="obsideen-verse-action-group">
					<button
						class="obsideen-tafsir-button"
						type="button"
						title={`Open tafsir for ${verse.chapter}:${verse.verse}`}
						aria-label={`Open tafsir for verse ${verse.verse}`}
						on:click|stopPropagation={openTafsir}
					>
						Tafsir
					</button>
					{#if onCreateNote}
						<button
							class="obsideen-tafsir-button obsideen-create-note-button"
							type="button"
							title={`Create a note for ${verse.chapter}:${verse.verse}`}
							aria-label={`Create note for verse ${verse.verse}`}
							on:click|stopPropagation={createNote}
						>
							Create note
						</button>
					{/if}
				</div>
			</div>
		{/if}
		<div
			class="obsideen-verse-body"
			class:clickable
			on:click|stopPropagation={clickable ? toggle : undefined}
			role={clickable ? "button" : undefined}
			tabindex={clickable ? 0 : undefined}
		>
			{#if texts.primary}
				<div class="obsideen-verse-primary" class:arabic={primaryIsArabic}>
					<p>{texts.primary}</p>
				</div>
			{/if}
			{#if showTranslation && texts.secondary}
				<div class="obsideen-verse-secondary">
					<p>{texts.secondary}</p>
				</div>
			{/if}
		</div>
	</div>
</div>
