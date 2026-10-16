import type { ChapterInfo, VerseText, EditionMeta } from "../../shared/types";
import { toArabicIndicDigits } from "../../shared/utils/arabic";

export function formatSurahHeader(chapter: ChapterInfo | undefined): string {
	if (!chapter) return "";
	return `${chapter.englishname} (${chapter.arabicname})`;
}

export function formatVerseRef(chapter: ChapterInfo | undefined, verses: number[]): string {
	if (!chapter || verses.length === 0) return "";
	return `Quran ${chapter.chapter}:${verses.join(", ")}`;
}

export function formatEditionName(meta: EditionMeta | undefined, fallback: string): string {
	return meta ? `${meta.language} — ${meta.author}` : fallback;
}

export function formatVersesForInsert(
	chapter: ChapterInfo | undefined,
	verses: number[],
	verseTexts: Map<number, VerseText>,
	primaryMeta: EditionMeta | undefined,
	secondaryMeta: EditionMeta | undefined,
	insertFormat: "quote" | "plain"
): string {
	if (!chapter || verses.length === 0) return "";

	const primaryName = formatEditionName(primaryMeta, "");
	const secondaryName = formatEditionName(secondaryMeta, "");
	const header = `**${formatSurahHeader(chapter)} — ${formatVerseRef(chapter, verses)}**`;
	const lines: string[] = [];

	if (insertFormat === "quote") {
		lines.push(`> ${header}`);
		lines.push(">");
		for (const v of verses) {
			const texts = verseTexts.get(v);
			if (!texts) continue;
			if (texts.primary) lines.push(`> **${v}.** ${texts.primary}  `);
			if (texts.secondary) lines.push(`> ${texts.secondary}  `);
			if (texts.primary || texts.secondary) lines.push(">");
		}
		if (primaryName) lines.push(`> Arabic: ${primaryName}`);
		if (secondaryName) lines.push(`> Translation: ${secondaryName}`);
	} else {
		lines.push(header);
		for (const v of verses) {
			const texts = verseTexts.get(v);
			if (!texts) continue;
			if (texts.primary) lines.push(`**${v}.** ${texts.primary}`);
			if (texts.secondary) lines.push(texts.secondary);
			if (texts.primary || texts.secondary) lines.push("");
		}
		if (primaryName) lines.push(`Arabic: ${primaryName}`);
		if (secondaryName) lines.push(`Translation: ${secondaryName}`);
	}

	return lines.join("\n");
}
