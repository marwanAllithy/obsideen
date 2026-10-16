export interface AdkarItem {
	id: number;
	title?: string;
	arabic: string;
	translation: string;
	repeat: number;
}

export interface AdkarSection {
	id: string;
	title: string;
	titleArabic: string;
	note: string;
	items: AdkarItem[];
}

export interface AdkarCollection {
	source: string;
	dataset: string;
	sourceUrl: string;
	sections: AdkarSection[];
}
