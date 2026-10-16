const ARABIC_INDIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

export function toArabicIndicDigits(num: number): string {
	return String(num)
		.split("")
		.map((digit) => ARABIC_INDIC_DIGITS[parseInt(digit, 10)] ?? digit)
		.join("");
}
