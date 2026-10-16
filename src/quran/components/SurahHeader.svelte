<script lang="ts">
	import type { ChapterInfo } from "../../shared/types";

	export let chapter: ChapterInfo | undefined;
</script>

{#if chapter}
	<div class="obsideen-header">
		<div class="obsideen-header-arabic">{chapter.arabicname}</div>
		<div class="obsideen-header-english">{chapter.englishname}</div>
		<div class="obsideen-header-meta">
			<span>{chapter.revelation}</span>
			<span>• {chapter.verses.length} verses</span>
			<span>• Surah {chapter.chapter}</span>
		</div>
	</div>
	{#if chapter.chapter !== 9}
		<div class="obsideen-bismillah">
			<span>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</span>
		</div>
	{/if}
{/if}
