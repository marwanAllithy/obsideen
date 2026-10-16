import { requestUrl } from "obsidian";

export interface YoutubePlaylistVideo {
	id: string;
	title: string;
	channel: string;
	published: string;
	duration: string;
	description: string;
}

export interface YoutubePlaylist {
	id: string;
	title: string;
	videos: YoutubePlaylistVideo[];
	unavailableVideoCount: number;
}

interface PlaylistPageConfig {
	apiKey: string;
	context: Record<string, unknown>;
}

const MAX_CONTINUATION_PAGES = 100;

export function extractYoutubePlaylistId(input: string): string {
	let url: URL;
	try {
		url = new URL(input.trim());
	} catch {
		throw new Error("Enter a valid YouTube playlist URL.");
	}

	const host = url.hostname.toLocaleLowerCase();
	if (
		!(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"].includes(host)) ||
		!url.searchParams.has("list")
	) {
		throw new Error("The URL must be a YouTube link that includes a playlist ID.");
	}

	const playlistId = url.searchParams.get("list")?.trim() ?? "";
	if (!/^[\w-]+$/.test(playlistId)) {
		throw new Error("The playlist ID in that URL does not look valid.");
	}
	return playlistId;
}

export async function fetchYoutubePlaylist(input: string): Promise<YoutubePlaylist> {
	const playlistId = extractYoutubePlaylistId(input);
	const playlistUrl = `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`;
	const pageResponse = await requestUrl({
		url: playlistUrl,
		method: "GET",
		headers: { "Accept-Language": "en-US,en;q=0.9" },
		throw: false
	});
	if (pageResponse.status >= 400) {
		throw new Error(`YouTube could not load that playlist (HTTP ${pageResponse.status}). It may be private or unavailable.`);
	}

	const initialData = extractInitialData(pageResponse.text);
	if (!initialData) {
		throw new Error("YouTube did not return playlist data. The playlist may be private, restricted, or YouTube may have changed its page format.");
	}

	const pageConfig = extractPageConfig(pageResponse.text);
	const title = getPlaylistTitle(initialData) || "YouTube Playlist";
	const videos: YoutubePlaylistVideo[] = [];
	const seenVideoIds = new Set<string>();
	let unavailableVideoCount = 0;
	const firstPage = collectPlaylistVideos(initialData, seenVideoIds);
	videos.push(...firstPage.videos);
	unavailableVideoCount += firstPage.unavailableCount;

	let continuation = findContinuation(initialData);
	const seenContinuations = new Set<string>();
	let continuationPages = 0;
	while (continuation) {
		if (seenContinuations.has(continuation)) {
			throw new Error("YouTube repeated a playlist continuation token. No notes were created.");
		}
		if (!pageConfig) {
			throw new Error("YouTube returned more playlist items but its continuation settings could not be read.");
		}
		if (continuationPages >= MAX_CONTINUATION_PAGES) {
			throw new Error(`This playlist exceeds the ${MAX_CONTINUATION_PAGES}-page safety limit. No notes were created.`);
		}

		seenContinuations.add(continuation);
		continuationPages += 1;
		const response = await requestUrl({
			url: `https://www.youtube.com/youtubei/v1/browse?key=${encodeURIComponent(pageConfig.apiKey)}&prettyPrint=false`,
			method: "POST",
			contentType: "application/json",
			headers: {
				Origin: "https://www.youtube.com",
				Referer: playlistUrl
			},
			body: JSON.stringify({ context: pageConfig.context, continuation }),
			throw: false
		});
		if (response.status >= 400) {
			throw new Error(`YouTube stopped returning playlist items (HTTP ${response.status}). No notes were created.`);
		}

		let continuationData: unknown;
		try {
			continuationData = JSON.parse(response.text);
		} catch {
			throw new Error("YouTube returned an unreadable playlist response. No notes were created.");
		}
		if (
			continuationData &&
			typeof continuationData === "object" &&
			"error" in continuationData
		) {
			throw new Error("YouTube rejected the playlist continuation request. The playlist may be restricted. No notes were created.");
		}

		const page = collectPlaylistVideos(continuationData, seenVideoIds);
		videos.push(...page.videos);
		unavailableVideoCount += page.unavailableCount;
		continuation = findContinuation(continuationData);
	}

	if (videos.length === 0) {
		throw new Error("No playable videos were found. The playlist may be empty, private, or restricted.");
	}

	return { id: playlistId, title, videos, unavailableVideoCount };
}

function extractInitialData(html: string): unknown | null {
	const marker = /ytInitialData\s*=/g;
	let match: RegExpExecArray | null;
	while ((match = marker.exec(html))) {
		const parsed = parseJsonObjectAt(html, match.index + match[0].length);
		if (parsed !== null) return parsed;
	}
	return null;
}

function extractPageConfig(html: string): PlaylistPageConfig | null {
	const config: Record<string, unknown> = {};
	let searchFrom = 0;
	while (true) {
		const marker = html.indexOf("ytcfg.set(", searchFrom);
		if (marker < 0) break;
		const parsed = parseJsonObjectAt(html, marker + "ytcfg.set(".length);
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			Object.assign(config, parsed);
		}
		searchFrom = marker + "ytcfg.set(".length;
	}

	const apiKey =
		(typeof config.INNERTUBE_API_KEY === "string" && config.INNERTUBE_API_KEY) ||
		html.match(/["']INNERTUBE_API_KEY["']\s*:\s*["']([^"']+)["']/)?.[1];
	let context = config.INNERTUBE_CONTEXT;
	if (!context || typeof context !== "object" || Array.isArray(context)) {
		const property = /["']INNERTUBE_CONTEXT["']\s*:/g.exec(html);
		context = property ? parseJsonObjectAt(html, property.index + property[0].length) : null;
	}
	if (typeof apiKey !== "string" || !apiKey || !context || typeof context !== "object" || Array.isArray(context)) {
		return null;
	}

	return { apiKey, context: context as Record<string, unknown> };
}

function parseJsonObjectAt(source: string, from: number): unknown | null {
	const start = source.indexOf("{", from);
	if (start < 0) return null;

	let depth = 0;
	let inString = false;
	let escaped = false;
	for (let index = start; index < source.length; index += 1) {
		const character = source[index];
		if (inString) {
			if (escaped) escaped = false;
			else if (character === "\\") escaped = true;
			else if (character === '"') inString = false;
			continue;
		}

		if (character === '"') inString = true;
		else if (character === "{") depth += 1;
		else if (character === "}") {
			depth -= 1;
			if (depth === 0) {
				try {
					return JSON.parse(source.slice(start, index + 1));
				} catch {
					return null;
				}
			}
		}
	}
	return null;
}

function getPlaylistTitle(data: unknown): string {
	const metadata = findRenderer(data, "playlistMetadataRenderer");
	const header = findRenderer(data, "playlistHeaderRenderer");
	return getText(metadata?.title) || getText(header?.title) || "";
}

function collectPlaylistVideos(
	data: unknown,
	seenIds: Set<string>
): { videos: YoutubePlaylistVideo[]; unavailableCount: number } {
	const videos: YoutubePlaylistVideo[] = [];
	let unavailableCount = 0;

	function visit(value: unknown): void {
		if (!value || typeof value !== "object") return;
		if (Array.isArray(value)) {
			for (const child of value) visit(child);
			return;
		}

		const object = value as Record<string, unknown>;
		const lockup = object.lockupViewModel;
		if (
			lockup &&
			typeof lockup === "object" &&
			!Array.isArray(lockup) &&
			(lockup as Record<string, unknown>).contentType === "LOCKUP_CONTENT_TYPE_VIDEO"
		) {
			const video = lockup as Record<string, unknown>;
			const id = typeof video.contentId === "string" ? video.contentId : "";
			if (!/^[\w-]+$/.test(id)) {
				unavailableCount += 1;
				return;
			}
			if (seenIds.has(id)) return;
			seenIds.add(id);

			const lockupMetadata = getObject(video.metadata)?.lockupMetadataViewModel;
			const metadata = getObject(lockupMetadata)?.metadata;
			const rows = getObject(getObject(metadata)?.contentMetadataViewModel)?.metadataRows;
			const firstRow = Array.isArray(rows) ? getObject(rows[0]) : null;
			const secondRow = Array.isArray(rows) ? getObject(rows[1]) : null;
			const firstParts = Array.isArray(firstRow?.metadataParts) ? firstRow.metadataParts : [];
			const secondParts = Array.isArray(secondRow?.metadataParts) ? secondRow.metadataParts : [];

			videos.push({
				id,
				title: getText(getObject(lockupMetadata)?.title) || `YouTube video ${id}`,
				channel: getText(getObject(firstParts[0])?.text),
				published: getText(getObject(secondParts[1])?.text),
				duration: findDuration(video.contentImage),
				description: ""
			});
			return;
		}

		const renderer = object.playlistVideoRenderer;
		if (renderer && typeof renderer === "object" && !Array.isArray(renderer)) {
			const video = renderer as Record<string, unknown>;
			const id = typeof video.videoId === "string" ? video.videoId : "";
			if (!/^[\w-]+$/.test(id)) {
				unavailableCount += 1;
				return;
			}
			if (seenIds.has(id)) return;
			seenIds.add(id);
			videos.push({
				id,
				title: getText(video.title) || `YouTube video ${id}`,
				channel: getText(video.shortBylineText) || getText(video.ownerText),
				published: getText(video.publishedTimeText),
				duration: getText(video.lengthText),
				description: getText(video.descriptionSnippet)
			});
			return;
		}

		for (const child of Object.values(object)) visit(child);
	}

	visit(data);
	return { videos, unavailableCount };
}

function findContinuation(data: unknown): string | null {
	const continuationViewModel = findRenderer(data, "continuationItemViewModel");
	if (continuationViewModel) {
		const token = findStringProperty(continuationViewModel, "token");
		if (token) return token;
	}

	const continuationItem = findRenderer(data, "continuationItemRenderer");
	if (continuationItem) {
		const command = findRenderer(continuationItem, "continuationCommand");
		const token = findStringProperty(command ?? continuationItem, "token");
		if (token) return token;
	}

	for (const key of ["nextContinuationData", "reloadContinuationData"]) {
		const continuationData = findRenderer(data, key);
		if (typeof continuationData?.continuation === "string") return continuationData.continuation;
	}
	return null;
}

function findStringProperty(data: unknown, property: string): string | null {
	if (!data || typeof data !== "object") return null;
	if (Array.isArray(data)) {
		for (const child of data) {
			const found = findStringProperty(child, property);
			if (found) return found;
		}
		return null;
	}

	const object = data as Record<string, unknown>;
	if (typeof object[property] === "string") return object[property] as string;
	for (const child of Object.values(object)) {
		const found = findStringProperty(child, property);
		if (found) return found;
	}
	return null;
}

function getObject(value: unknown): Record<string, unknown> | null {
	return value && typeof value === "object" && !Array.isArray(value)
		? value as Record<string, unknown>
		: null;
}

function findDuration(data: unknown): string {
	if (!data || typeof data !== "object") return "";
	if (Array.isArray(data)) {
		for (const child of data) {
			const found = findDuration(child);
			if (found) return found;
		}
		return "";
	}

	const object = data as Record<string, unknown>;
	const badge = getObject(object.thumbnailBadgeViewModel);
	const text = getText(badge?.text);
	if (/^(?:\d{1,3}:)?\d{1,2}:\d{2}$/.test(text)) return text;
	for (const child of Object.values(object)) {
		const found = findDuration(child);
		if (found) return found;
	}
	return "";
}

function findRenderer(data: unknown, rendererName: string): Record<string, unknown> | null {
	if (!data || typeof data !== "object") return null;
	if (Array.isArray(data)) {
		for (const child of data) {
			const found = findRenderer(child, rendererName);
			if (found) return found;
		}
		return null;
	}

	const object = data as Record<string, unknown>;
	const renderer = object[rendererName];
	if (renderer && typeof renderer === "object" && !Array.isArray(renderer)) {
		return renderer as Record<string, unknown>;
	}
	for (const child of Object.values(object)) {
		const found = findRenderer(child, rendererName);
		if (found) return found;
	}
	return null;
}

function getText(value: unknown): string {
	if (typeof value === "string") return value.trim();
	if (!value || typeof value !== "object") return "";
	const object = value as Record<string, unknown>;
	if (typeof object.simpleText === "string") return object.simpleText.trim();
	if (typeof object.content === "string") return object.content.trim();
	if (Array.isArray(object.runs)) {
		return object.runs
			.map((run) => (run && typeof run === "object" && typeof (run as Record<string, unknown>).text === "string"
				? (run as Record<string, string>).text
				: ""))
			.join("")
			.trim();
	}
	return "";
}
