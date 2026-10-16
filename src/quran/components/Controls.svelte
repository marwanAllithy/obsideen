<script lang="ts">
	import type { EditionMeta } from "../../shared/types";
	import EditionSelector from "./EditionSelector.svelte";

	export let editions: EditionMeta[];
	export let primaryEdition: string;
	export let secondaryEdition: string;
	export let onPrimaryChange: (name: string) => void;
	export let onSecondaryChange: (name: string) => void;
</script>

<div class="obsideen-controls">
	<EditionSelector
		label="Arabic / Primary"
		value={primaryEdition}
		{editions}
		onChange={onPrimaryChange}
	/>

	<EditionSelector
		label="Translation"
		value={secondaryEdition}
		{editions}
		onChange={onSecondaryChange}
	/>
</div>
