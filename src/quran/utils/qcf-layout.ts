/**
 * QCF line alignment helpers inspired by quran.com-frontend-next.
 * The data below is taken from quran.com-frontend-next/src/components/Verse/pageUtils.ts.
 */

// Pages where the entire page is center-aligned, such as Al-Faatiha and the
// opening of Al-Baqarah in the Madani layout.
const CENTER_ALIGNED_PAGES = new Set<number>([1, 2]);

// Specific physical lines that are centered, typically short surah endings.
const CENTER_ALIGNED_PAGE_LINES: Record<number, number[]> = {
	255: [2], // 13(Ar-Ra'd), last ayah
	528: [9], // 67 (Al Qalam) last ayah
	534: [6], // 55(Ar-Rahman) last ayah
	545: [6], // 58(Al-Mujadila) last ayah
	586: [1], // 80('Abasa) last ayah
	593: [2], // 88(Al-Ghashiyah) last 2 ayah
	594: [5], // 89(Al-Fajr) last 2 ayah
	600: [10], // 100(Al-'Adiyat) last 2 ayah
	602: [5, 15], // 106(Quraysh) last ayah, 108(Al-Kawthar) last ayah
	603: [10, 15], // 110(An-Nasr) last ayah, 111(Al-Masad) last ayah
	604: [4, 9, 14, 15] // 112(Al-Ikhlas) last ayah, 113(Al-Falaq) last ayah, 114(An-Nas) last 2 ayah
};

export function isCenterAlignedLine(pageNumber: number, lineNumber: number): boolean {
	if (CENTER_ALIGNED_PAGES.has(pageNumber)) return true;
	const centerLines = CENTER_ALIGNED_PAGE_LINES[pageNumber];
	return centerLines ? centerLines.includes(lineNumber) : false;
}
