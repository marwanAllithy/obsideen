<script lang="ts">
	import type { App } from "obsidian";
	import { readJsonFile } from "../../shared/utils/file";
	import type { AdkarCollection } from "../types";

	export let app: App;
	export let manifestDir: string;

	let collection: AdkarCollection | null = null;
	let error = "";

	function jumpToSection(sectionId: string): void {
		document.getElementById(`obsideen-adkar-section-${sectionId}`)?.scrollIntoView({
			behavior: "smooth",
			block: "start"
		});
	}

	function formatTranslation(text: string): string {
		return text.replace(/\[([^\]]+)\]\(\s*\d+\s*\)/g, "$1");
	}

	export async function initialize(): Promise<void> {
		const data = await readJsonFile<AdkarCollection>(app, `${manifestDir}/data/adhkar/daily.json`);
		if (!data || !Array.isArray(data.sections) || data.sections.length === 0) {
			error = "Could not load the bundled Adkar collection.";
			return;
		}

		collection = data;
	}
</script>

<div class="obsideen-adkar">
	<header class="obsideen-adkar-header">
		<div class="obsideen-adkar-eyebrow">Obsideen · DAILY WORSHIP</div>
		<h1>Daily Adkar</h1>
		<p>Browse the remembrances for the day, evening, and night.</p>
	</header>

	{#if error}
		<div class="obsideen-adkar-error">{error}</div>
	{:else if !collection}
		<div class="obsideen-loading">Loading Adkar…</div>
	{:else}
		<nav class="obsideen-adkar-tabs" aria-label="Jump to an Adkar section">
			{#each collection.sections as section (section.id)}
				<button class="obsideen-adkar-tab" type="button" on:click={() => jumpToSection(section.id)}>
					<span>{section.title}</span>
					<span class="obsideen-adkar-tab-count">{section.items.length}</span>
				</button>
			{/each}
		</nav>

		<div class="obsideen-adkar-content">
			{#each collection.sections as section (section.id)}
				<section id={`obsideen-adkar-section-${section.id}`} class="obsideen-adkar-section">
					<div class="obsideen-adkar-section-heading">
						<div>
							<h2>{section.title}</h2>
							<p>{section.note}</p>
						</div>
						<div class="obsideen-adkar-section-arabic" lang="ar" dir="rtl">{section.titleArabic}</div>
					</div>

					<div class="obsideen-adkar-list">
						{#each section.items as item, index (`${section.id}-${index}`)}
							<article class="obsideen-adkar-card">
								<div class="obsideen-adkar-card-header">
									<div class="obsideen-adkar-card-title">
										<span class="obsideen-adkar-number">{index + 1}</span>
										{#if item.title}<span>{item.title}</span>{:else}<span>Adkar</span>{/if}
									</div>
									<span class="obsideen-adkar-repeat">Repeat {item.repeat}×</span>
								</div>

								<div class="obsideen-adkar-arabic" lang="ar" dir="rtl">{item.arabic}</div>
								<div class="obsideen-adkar-translation">{formatTranslation(item.translation)}</div>
							</article>
						{/each}
					</div>
				</section>
			{/each}

			<footer class="obsideen-adkar-source">
				Based on {collection.source} ·
				<a href={collection.sourceUrl} target="_blank" rel="noopener noreferrer">Data source and attribution</a>
			</footer>
		</div>
	{/if}
</div>
