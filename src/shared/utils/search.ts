/** Normalize Arabic and Latin text so search is not sensitive to diacritics or punctuation. */
export function normalizeSearchText(text: string): string {
	return text
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036F]/g, "")
		.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "")
		.replace(/[أإآٱ]/g, "ا")
		.replace(/[ؤ]/g, "و")
		.replace(/[ئىیى]/g, "ي")
		.replace(/[ة]/g, "ه")
		.replace(/[ک]/g, "ك")
		.replace(/[\p{P}\p{S}\s]+/gu, " ")
		.trim();
}

export function getSearchTerms(query: string): string[] {
	return normalizeSearchText(query).split(/\s+/).filter(Boolean);
}

export type SearchFuzziness = "strict" | "balanced" | "fuzzy";

export interface HighlightSegment {
	text: string;
	match: boolean;
}

/** Require every query term to be present, regardless of order. */
export function matchesSearchText(query: string, ...fields: string[]): boolean {
	const terms = getSearchTerms(query);
	if (terms.length === 0) return false;
	const haystack = normalizeSearchText(fields.join(" "));
	return terms.every((term) => haystack.includes(term));
}

function editDistanceWithin(left: string, right: string, maximum: number): number | null {
	if (maximum === 0) return left === right ? 0 : null;
	if (Math.abs(left.length - right.length) > maximum) return null;

	let previousPrevious: number[] | null = null;
	let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
	for (let i = 1; i <= left.length; i++) {
		const current = new Array<number>(right.length + 1);
		current[0] = i;
		let rowMinimum = current[0];
		for (let j = 1; j <= right.length; j++) {
			const substitutionCost = left[i - 1] === right[j - 1] ? 0 : 1;
			current[j] = Math.min(
				previous[j] + 1,
				current[j - 1] + 1,
				previous[j - 1] + substitutionCost
			);
			if (
				previousPrevious &&
				i > 1 &&
				j > 1 &&
				left[i - 1] === right[j - 2] &&
				left[i - 2] === right[j - 1]
			) {
				current[j] = Math.min(current[j], previousPrevious[j - 2] + 1);
			}
			rowMinimum = Math.min(rowMinimum, current[j]);
		}
		if (rowMinimum > maximum) return null;
		previousPrevious = previous;
		previous = current;
	}
	return previous[right.length] <= maximum ? previous[right.length] : null;
}

interface TokenMatch {
	quality: number;
	kind: "exact" | "prefix" | "substring" | "typo";
}

function getTokenMatch(
	term: string,
	token: string,
	fuzziness: SearchFuzziness
): TokenMatch | null {
	if (term === token) return { quality: 1, kind: "exact" };
	if (fuzziness === "strict") return null;

	// Prefix matching makes partial queries useful without accepting arbitrary substrings.
	if (term.length >= 3 && token.startsWith(term)) {
		return { quality: 0.94, kind: "prefix" };
	}
	if (term.length >= 4 && token.includes(term)) {
		return { quality: 0.88, kind: "substring" };
	}

	if (term.length < 3) return null;
	const threshold = fuzziness === "balanced" ? 0.78 : 0.62;
	const maximum = Math.floor((1 - threshold) * Math.max(term.length, token.length));
	if (maximum < 1) return null;
	const distance = editDistanceWithin(term, token, maximum);
	if (distance === null) return null;
	const quality = 1 - distance / Math.max(term.length, token.length);
	return quality >= threshold ? { quality, kind: "typo" } : null;
}

function scoreOneNormalizedField(
	terms: string[],
	field: string,
	fuzziness: SearchFuzziness
): number {
	const tokens = field.split(/\s+/).filter(Boolean);
	const candidates = terms.map((term) => {
		const matches: Array<{ tokenIndex: number; match: TokenMatch }> = [];
		for (let index = 0; index < tokens.length; index++) {
			const match = getTokenMatch(term, tokens[index], fuzziness);
			if (match) matches.push({ tokenIndex: index, match });
		}
		return matches.sort(
			(a, b) => b.match.quality - a.match.quality || a.tokenIndex - b.tokenIndex
		);
	});
	// Fuzziness changes how a word can match, never how many query words may be ignored.
	if (candidates.some((matches) => matches.length === 0)) return -1;

	const termOrder = terms
		.map((_, index) => index)
		.sort((a, b) => candidates[a].length - candidates[b].length);
	const tokenOwners = new Map<number, number>();
	const assignedMatches = new Map<number, { tokenIndex: number; match: TokenMatch }>();
	function assignTerm(termIndex: number, visitedTokens: Set<number>): boolean {
		for (const candidate of candidates[termIndex]) {
			if (visitedTokens.has(candidate.tokenIndex)) continue;
			visitedTokens.add(candidate.tokenIndex);
			const previousOwner = tokenOwners.get(candidate.tokenIndex);
			if (
				previousOwner === undefined ||
				assignTerm(previousOwner, visitedTokens)
			) {
				tokenOwners.set(candidate.tokenIndex, termIndex);
				assignedMatches.set(termIndex, candidate);
				return true;
			}
		}
		return false;
	}
	for (const termIndex of termOrder) {
		if (!assignTerm(termIndex, new Set())) return -1;
	}
	const completeMatches = terms.map((_, index) => assignedMatches.get(index)!);
	const averageQuality =
		completeMatches.reduce((sum, match) => sum + match.match.quality, 0) / completeMatches.length;
	const positions = completeMatches.map((match) => match.tokenIndex);
	const span = Math.max(...positions) - Math.min(...positions) + 1;
	let score = averageQuality * 100;
	if (completeMatches.every((match) => match.match.kind === "exact")) score += 10;
	score += Math.max(0, 15 - Math.max(0, span - terms.length) * 2);
	if (field.includes(terms.join(" "))) score += 25;
	return score;
}

/** Score normalized fields, keeping every query term within one source text. */
export function scoreNormalizedSearchMatch(
	query: string,
	fields: string[],
	fuzziness: SearchFuzziness
): number {
	const terms = Array.from(new Set(getSearchTerms(query)));
	if (terms.length === 0) return -1;
	let bestScore = -1;
	for (const field of fields) {
		if (!field) continue;
		bestScore = Math.max(bestScore, scoreOneNormalizedField(terms, field, fuzziness));
	}
	return bestScore;
}

interface MappedToken {
	value: string;
	start: number;
	end: number;
	characters: Array<{ start: number; end: number }>;
}

function getMappedTokens(text: string): MappedToken[] {
	const tokens: MappedToken[] = [];
	let token: MappedToken | null = null;
	for (let offset = 0; offset < text.length; ) {
		const character = String.fromCodePoint(text.codePointAt(offset)!);
		const end = offset + character.length;
		if (/[\p{P}\p{S}\s]/u.test(character)) {
			if (token) tokens.push(token);
			token = null;
			offset = end;
			continue;
		}
		const normalized = normalizeSearchText(character);
		for (const normalizedCharacter of normalized) {
			if (!token) {
				token = { value: "", start: offset, end, characters: [] };
			}
			token.value += normalizedCharacter;
			token.end = end;
			token.characters.push({ start: offset, end });
		}
		offset = end;
	}
	if (token) tokens.push(token);
	return tokens;
}

/** Map normalized query terms back to safe, renderable ranges in the original text. */
export function getHighlightSegments(
	text: string,
	query: string,
	fuzziness: SearchFuzziness = "balanced"
): HighlightSegment[] {
	const queryTerms = Array.from(new Set(getSearchTerms(query)));
	if (!text || queryTerms.length === 0) return [{ text, match: false }];

	const tokens = getMappedTokens(text);
	const ranges: Array<{ start: number; end: number }> = [];
	for (const term of queryTerms) {
		for (const token of tokens) {
			const match = getTokenMatch(term, token.value, fuzziness);
			if (!match) continue;
			const matchIndex = match.kind === "substring" ? token.value.indexOf(term) : 0;
			const matchedLength =
				match.kind === "prefix" || match.kind === "substring"
					? term.length
					: token.characters.length;
			const first = token.characters[matchIndex];
			const last = token.characters[matchedLength - 1];
			if (first && last) ranges.push({ start: first.start, end: last.end });
		}
	}

	ranges.sort((a, b) => a.start - b.start || a.end - b.end);
	const merged: Array<{ start: number; end: number }> = [];
	for (const range of ranges) {
		const previous = merged[merged.length - 1];
		if (previous && range.start <= previous.end) {
			previous.end = Math.max(previous.end, range.end);
		} else {
			merged.push({ ...range });
		}
	}

	const segments: HighlightSegment[] = [];
	let cursor = 0;
	for (const range of merged) {
		if (range.start > cursor) segments.push({ text: text.slice(cursor, range.start), match: false });
		segments.push({ text: text.slice(range.start, range.end), match: true });
		cursor = range.end;
	}
	if (cursor < text.length) segments.push({ text: text.slice(cursor), match: false });
	return segments.length > 0 ? segments : [{ text, match: false }];
}

export function toLatinDigits(text: string): string {
	return text
		.replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
		.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

/** Parse a direct Quran reference, e.g. 2:255 or ٢:٢٥٥. */
export function parseVerseReference(query: string): { chapter: number; verse: number } | null {
	const latinDigits = toLatinDigits(query).trim();
	const match = latinDigits.match(/^(?:quran\s*)?(\d{1,3})\s*[:.]\s*(\d{1,3})$/i);
	if (!match) return null;
	const chapter = Number(match[1]);
	const verse = Number(match[2]);
	return chapter > 0 && verse > 0 ? { chapter, verse } : null;
}
