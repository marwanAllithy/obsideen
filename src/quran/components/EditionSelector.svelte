<script lang="ts">
	import type { EditionMeta } from "../../shared/types";

	export let label: string;
	export let value: string;
	export let editions: EditionMeta[];
	export let onChange: (name: string) => void;

	function handleChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		onChange(target.value);
	}
</script>

<div class="obsideen-control-group">
	<label>{label}</label>
	<select {value} on:change={handleChange}>
		{#each editions as edition}
			<option value={edition.name}>{edition.language}: {edition.author}</option>
		{/each}
	</select>
</div>
