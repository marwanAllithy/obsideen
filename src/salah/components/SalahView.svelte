<script lang="ts">
	import { onDestroy } from "svelte";
	import type {
		CachedSalahTimes,
		ReaderSettings,
		SalahPrayer,
		SalahTracker
	} from "../../shared/types";
	import {
		loadSalahTimes,
		SALAH_PRAYERS,
		type SalahTimes
	} from "../loader";

	export let settings: ReaderSettings;
	export let onSaveSettings: (settings: ReaderSettings) => Promise<void>;

	const METHODS = [
		{ id: 1, name: "University of Islamic Sciences, Karachi" },
		{ id: 2, name: "Islamic Society of North America (ISNA)" },
		{ id: 3, name: "Muslim World League" },
		{ id: 4, name: "Umm Al-Qura, Makkah" },
		{ id: 5, name: "Egyptian General Authority" }
	];

	let times: SalahTimes | null = null;
	let loading = false;
	let isCached = false;
	let error = "";
	let now = Date.now();
	let clockInterval: ReturnType<typeof setInterval> | undefined;
	let dateRefreshAttempt = "";
	let initialSettingsLoaded = false;
	let loadedLocationKey = "";

	$: dateKey = times?.dateKey ?? new Date().toISOString().slice(0, 10);
	$: todaysTracker = settings.salahTracker[dateKey] ?? {};
	$: completedCount = SALAH_PRAYERS.filter((prayer) => todaysTracker[prayer]).length;
	$: nextPrayer = times ? getNextPrayer(times, now) : null;
	$: weeklyProgress = getWeeklyProgress(settings.salahTracker, dateKey);
	$: methodName = METHODS.find((item) => item.id === settings.salahMethod)?.name ?? "Custom method";
	$: activeLocationKey = getSalahCacheKey(settings.salahCity, settings.salahCountry, settings.salahMethod);
	$: if (initialSettingsLoaded && activeLocationKey !== loadedLocationKey) {
		loadedLocationKey = activeLocationKey;
		times = null;
		isCached = false;
		error = "";
		if (settings.salahCity.trim() && settings.salahCountry.trim()) void fetchTimes(false);
	}

	export async function initialize(): Promise<void> {
		clockInterval = setInterval(() => {
			now = Date.now();
			if (times && !loading) {
				const currentDate = getLocationDateKey(now, times.timezone);
				if (currentDate === times.dateKey) dateRefreshAttempt = "";
				else if (dateRefreshAttempt !== currentDate) {
					dateRefreshAttempt = currentDate;
					void fetchTimes(true);
				}
			}
		}, 30_000);
		loadedLocationKey = getSalahCacheKey(settings.salahCity, settings.salahCountry, settings.salahMethod);
		initialSettingsLoaded = true;
		if (settings.salahCity.trim() && settings.salahCountry.trim()) await fetchTimes(false);
	}

	onDestroy(() => {
		if (clockInterval) clearInterval(clockInterval);
	});

	async function refreshTimes(): Promise<void> {
		await fetchTimes(true);
	}

	async function fetchTimes(forceRefresh: boolean): Promise<void> {
		const cleanCity = settings.salahCity.trim();
		const cleanCountry = settings.salahCountry.trim();
		if (!cleanCity || !cleanCountry) {
			error = "Set a city and country in plugin settings to load prayer times.";
			return;
		}

		const selectedMethod = settings.salahMethod;
		const cacheKey = getSalahCacheKey(cleanCity, cleanCountry, selectedMethod);
		const cached = settings.salahTimesCache[cacheKey];
		if (!forceRefresh && cached && cacheIsForToday(cached)) {
			const updatedSettings = {
				...settings,
				salahCity: cleanCity,
				salahCountry: cleanCountry,
				salahMethod: selectedMethod
			};
			if (
				settings.salahCity !== cleanCity ||
				settings.salahCountry !== cleanCountry ||
				settings.salahMethod !== selectedMethod
			) {
				await onSaveSettings(updatedSettings);
			}
			settings = updatedSettings;
			times = cached;
			isCached = true;
			error = "";
			return;
		}

		loading = true;
		error = "";
		try {
			const fetchedTimes = await loadSalahTimes(cleanCity, cleanCountry, selectedMethod);
			const cache: Record<string, CachedSalahTimes> = {
				...settings.salahTimesCache,
				[cacheKey]: { ...fetchedTimes, cachedAt: Date.now() }
			};
			trimCache(cache, 30);

			const updatedSettings = {
				...settings,
				salahCity: cleanCity,
				salahCountry: cleanCountry,
				salahMethod: selectedMethod,
				salahTimesCache: cache
			};
			await onSaveSettings(updatedSettings);
			settings = updatedSettings;
			times = fetchedTimes;
			isCached = false;
		} catch (cause) {
			if (cached && cacheIsForToday(cached)) {
				times = cached;
				isCached = true;
				const message = cause instanceof Error ? cause.message : "Could not load prayer times.";
				error = `${message} Showing today’s saved times.`;
			} else {
				error = cause instanceof Error ? cause.message : "Could not load prayer times.";
			}
		} finally {
			loading = false;
		}
	}

	function getSalahCacheKey(locationCity: string, locationCountry: string, calculationMethod: number): string {
		return JSON.stringify([
			locationCity.trim().toLocaleLowerCase(),
			locationCountry.trim().toLocaleLowerCase(),
			calculationMethod
		]);
	}

	function cacheIsForToday(cached: CachedSalahTimes): boolean {
		return cached.dateKey === getLocationDateKey(Date.now(), cached.timezone);
	}

	function trimCache(cache: Record<string, CachedSalahTimes>, maxEntries: number): void {
		const oldestFirst = Object.entries(cache).sort(([, first], [, second]) => first.cachedAt - second.cachedAt);
		for (const [key] of oldestFirst.slice(0, Math.max(0, oldestFirst.length - maxEntries))) {
			delete cache[key];
		}
	}

	async function togglePrayer(prayer: SalahPrayer): Promise<void> {
		const today = { ...settings.salahTracker[dateKey] };
		if (today[prayer]) delete today[prayer];
		else today[prayer] = true;

		const tracker: SalahTracker = { ...settings.salahTracker, [dateKey]: today };
		const savedDays = Object.keys(tracker).sort();
		for (const oldDay of savedDays.slice(0, Math.max(0, savedDays.length - 365))) {
			delete tracker[oldDay];
		}

		const updatedSettings = { ...settings, salahTracker: tracker };
		settings = updatedSettings;
		await onSaveSettings(updatedSettings);
	}

	function getNextPrayer(data: SalahTimes, timestamp: number): { name: SalahPrayer; time: string } {
		const currentMinutes = getLocationMinutes(timestamp, data.timezone);
		for (const name of SALAH_PRAYERS) {
			const time = data.timings[name];
			if (getTimeMinutes(time) > currentMinutes) return { name, time };
		}
		return { name: "Fajr", time: data.timings.Fajr };
	}

	function getLocationMinutes(timestamp: number, timezone: string): number {
		try {
			const parts = new Intl.DateTimeFormat("en-GB", {
				timeZone: timezone || undefined,
				hour: "2-digit",
				minute: "2-digit",
				hourCycle: "h23"
			}).formatToParts(timestamp);
			const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
			const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
			return hour * 60 + minute;
		} catch {
			const local = new Date(timestamp);
			return local.getHours() * 60 + local.getMinutes();
		}
	}

	function getLocationDateKey(timestamp: number, timezone: string): string {
		try {
			const parts = new Intl.DateTimeFormat("en-CA", {
				timeZone: timezone || undefined,
				year: "numeric",
				month: "2-digit",
				day: "2-digit"
			}).formatToParts(timestamp);
			const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
			return `${part("year")}-${part("month")}-${part("day")}`;
		} catch {
			return new Date(timestamp).toISOString().slice(0, 10);
		}
	}

	function getTimeMinutes(value: string): number {
		const match = /^(\d{1,2}):(\d{2})/.exec(value);
		return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
	}

	function formatTime(value: string): string {
		const match = /^(\d{1,2}):(\d{2})/.exec(value);
		if (!match) return value;
		const hour = Number(match[1]);
		const suffix = hour >= 12 ? "PM" : "AM";
		return `${hour % 12 || 12}:${match[2]} ${suffix}`;
	}

	function getWeeklyProgress(tracker: SalahTracker, lastDay: string) {
		const lastDate = new Date(`${lastDay}T12:00:00Z`);
		return Array.from({ length: 7 }, (_, index) => {
			const date = new Date(lastDate);
			date.setUTCDate(date.getUTCDate() - (6 - index));
			const key = date.toISOString().slice(0, 10);
			const count = SALAH_PRAYERS.filter((prayer) => tracker[key]?.[prayer]).length;
			return {
				key,
				label: new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: "UTC" }).format(date),
				count
			};
		});
	}
</script>

<div class="obsideen-salah">
	<header class="obsideen-salah-header">
		<div>
			<div class="obsideen-salah-eyebrow">DAILY WORSHIP</div>
			<h1>Salah times</h1>
			<p>Prayer times and a simple daily prayer tracker.</p>
		</div>
		{#if times}
			<div class="obsideen-salah-date">
				<strong>{times.dateLabel}</strong>
				{#if times.hijriDate}<span>{times.hijriDate} AH</span>{/if}
			</div>
		{/if}
	</header>

	<div class="obsideen-salah-location-summary">
		<div>
			<span class="obsideen-salah-location-label">LOCATION</span>
			<strong>
				{settings.salahCity && settings.salahCountry
					? `${settings.salahCity}, ${settings.salahCountry}`
					: "Not set in plugin settings"}
			</strong>
			<span class="obsideen-salah-method-label">{methodName}</span>
		</div>
		<button
			type="button"
			class="mod-cta"
			on:click={refreshTimes}
			disabled={loading || !settings.salahCity.trim() || !settings.salahCountry.trim()}
		>
			{loading ? "Refreshing…" : "Refresh times"}
		</button>
	</div>

	{#if error}
		<div class="obsideen-salah-error" role="alert">{error}</div>
	{/if}

	{#if times}
		{#if isCached}
			<div class="obsideen-salah-cache-note">Using today’s saved times · no API request needed</div>
		{/if}
		{#if nextPrayer}
			<section class="obsideen-salah-next" aria-label="Next prayer">
				<div>
					<span>UP NEXT</span>
					<strong>{nextPrayer.name}</strong>
				</div>
				<time>{formatTime(nextPrayer.time)}</time>
			</section>
		{/if}

		<section class="obsideen-salah-times" aria-label="Today's prayer times">
			{#each SALAH_PRAYERS as prayer (prayer)}
				<article class:completed={todaysTracker[prayer]} class="obsideen-salah-time-card">
					<div class="obsideen-salah-prayer-name">{prayer}</div>
					<time>{formatTime(times.timings[prayer])}</time>
				</article>
			{/each}
		</section>

		<section class="obsideen-salah-tracker">
			<div class="obsideen-salah-section-heading">
				<div>
					<h2>Prayer tracker</h2>
					<p>Mark each prayer when you’ve completed it.</p>
				</div>
				<div class="obsideen-salah-progress-count">{completedCount}<span> / 5 today</span></div>
			</div>

			<div class="obsideen-salah-checklist">
				{#each SALAH_PRAYERS as prayer (prayer)}
					<label class:checked={todaysTracker[prayer]} class="obsideen-salah-check-row">
						<input
							type="checkbox"
							checked={Boolean(todaysTracker[prayer])}
							on:change={() => togglePrayer(prayer)}
						/>
						<span class="obsideen-salah-check-name">{prayer}</span>
						<span class="obsideen-salah-check-time">{formatTime(times.timings[prayer])}</span>
					</label>
				{/each}
			</div>

			<div class="obsideen-salah-week">
				<div class="obsideen-salah-week-title">Last 7 days</div>
				<div class="obsideen-salah-week-grid">
					{#each weeklyProgress as day (day.key)}
						<div class="obsideen-salah-week-day" title={`${day.count} of 5 prayers`}>
							<div class="obsideen-salah-week-bar">
								<span style={`height: ${day.count * 20}%`}></span>
							</div>
							<span>{day.label}</span>
						</div>
					{/each}
				</div>
			</div>
		</section>

		{#if times.timezone}
			<footer class="obsideen-salah-footnote">Times for {settings.salahCity}, {settings.salahCountry} · {times.timezone} · Provided by AlAdhan</footer>
		{/if}
	{:else if !loading && !error}
		<div class="obsideen-salah-empty">
			<div class="obsideen-salah-empty-icon">☾</div>
			<h2>Configure Salah times</h2>
			<p>Set your city, country, and calculation method in Obsideen’s plugin settings under <strong>Salah Times</strong>.</p>
		</div>
	{/if}
</div>
