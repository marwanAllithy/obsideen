<script lang="ts">
	import { onMount, onDestroy } from "svelte";

	export let onVisible: () => void;
	export let disabled = false;
	export let root: Element | null = null;
	export let rootMargin = "200px";

	let el: HTMLDivElement;
	let observer: IntersectionObserver | null = null;
	let isIntersecting = false;

	onMount(() => {
		if (!el) return;
		observer = new IntersectionObserver(
			(entries) => {
				isIntersecting = entries[0].isIntersecting;
			},
			{ root, rootMargin, threshold: 0 }
		);
		observer.observe(el);
	});

	onDestroy(() => {
		observer?.disconnect();
	});

	// Trigger when the sentinel enters the viewport or when it is already visible
	// and becomes enabled again (e.g. after a data load finishes).
	$: if (!disabled && isIntersecting) {
		onVisible();
	}
</script>

<div class="obsideen-lazy-sentinel" bind:this={el}>
	<span class="obsideen-lazy-hint">Loading more…</span>
</div>
