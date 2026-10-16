<script lang="ts">
	import { setIcon } from "obsidian";
	import { onMount } from "svelte";
	import type { DashboardAction } from "../view";

	export let onNavigate: (action: DashboardAction) => void;

	type DashboardTool = {
		action: DashboardAction;
		icon: "book-open" | "search" | "library" | "sun" | "clock" | "youtube";
		category: string;
		title: string;
		description: string;
		buttonText: string;
	};

	const tools: DashboardTool[] = [
		{
			action: "quran",
			icon: "book-open",
			category: "READ & REFLECT",
			title: "Quran Reader",
			description: "Read in Mushaf, QCF, or translation view, and explore tafsir as you go.",
			buttonText: "Open reader"
		},
		{
			action: "search",
			icon: "search",
			category: "FIND",
			title: "Search Quran & Hadith",
			description: "Search across Quran translations and the bundled Hadith collection.",
			buttonText: "Start searching"
		},
		{
			action: "hadith",
			icon: "library",
			category: "LEARN",
			title: "Hadith Library",
			description: "Browse collections, books, and chapters in the Hadith library.",
			buttonText: "Browse library"
		},
		{
			action: "adkar",
			icon: "sun",
			category: "REMEMBER",
			title: "Daily Adkar",
			description: "Keep morning, evening, and everyday remembrances close at hand.",
			buttonText: "View Adkar"
		},
		{
			action: "salah",
			icon: "clock",
			category: "STAY CONSISTENT",
			title: "Salah Times & Tracker",
			description: "Check local prayer times and keep track of your daily prayers.",
			buttonText: "Open prayer tracker"
		},
		{
			action: "youtube",
			icon: "youtube",
			category: "BUILD YOUR LIBRARY",
			title: "YouTube Playlist Notes",
			description: "Create linked vault notes for the videos in a public lecture playlist.",
			buttonText: "Import a playlist"
		}
	];

	let iconElements: HTMLElement[] = [];

	onMount(() => {
		tools.forEach((tool, index) => {
			const iconEl = iconElements[index];
			if (iconEl) setIcon(iconEl, tool.icon);
		});
	});
</script>

<div class="obsideen-dashboard">
	<main class="obsideen-dashboard-content">
		<section class="obsideen-dashboard-hero" aria-labelledby="obsideen-dashboard-title">
			<div class="obsideen-dashboard-hero-copy">
				<div class="obsideen-dashboard-eyebrow">OBSIDEEN · YOUR ISLAMIC STUDY SPACE</div>
				<h1 id="obsideen-dashboard-title">Make space for what matters.</h1>
				<p>Read, reflect, search, and build a steady daily practice—all in one place.</p>
			</div>
			<div class="obsideen-dashboard-hero-art" aria-hidden="true">
				<div class="obsideen-dashboard-orbit"></div>
				<div class="obsideen-dashboard-arabic" lang="ar" dir="rtl">بِسْمِ اللَّهِ</div>
				<div class="obsideen-dashboard-art-caption">A MOMENT TO BEGIN</div>
			</div>
		</section>

		<section class="obsideen-dashboard-section" aria-labelledby="obsideen-dashboard-tools-title">
			<div class="obsideen-dashboard-section-heading">
				<div>
					<div class="obsideen-dashboard-section-label">YOUR TOOLS</div>
					<h2 id="obsideen-dashboard-tools-title">Where would you like to begin?</h2>
				</div>
				<span class="obsideen-dashboard-tool-count">{tools.length} ways to explore</span>
			</div>

			<div class="obsideen-dashboard-grid">
				{#each tools as tool, index (tool.action)}
					<button
						class="obsideen-dashboard-card"
						type="button"
						aria-label={`${tool.buttonText}: ${tool.title}`}
						on:click={() => onNavigate(tool.action)}
					>
						<div class="obsideen-dashboard-card-top">
							<span class="obsideen-dashboard-icon" aria-hidden="true" bind:this={iconElements[index]}></span>
							<span class="obsideen-dashboard-card-category">{tool.category}</span>
						</div>
						<span class="obsideen-dashboard-card-title">{tool.title}</span>
						<span class="obsideen-dashboard-card-description">{tool.description}</span>
						<span class="obsideen-dashboard-card-action">
							{tool.buttonText}<span aria-hidden="true">→</span>
						</span>
					</button>
				{/each}
			</div>
		</section>

		<footer class="obsideen-dashboard-footer">
			<span>Take it one step at a time.</span>
			<span lang="ar" dir="rtl">وَاذْكُر رَّبَّكَ كَثِيرًا</span>
		</footer>
	</main>
</div>
