import { requestUrl } from "obsidian";
import type { SalahPrayer } from "../shared/types";

export const SALAH_PRAYERS: SalahPrayer[] = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

export interface SalahTimes {
	timings: Record<SalahPrayer, string>;
	dateKey: string;
	dateLabel: string;
	timezone: string;
	hijriDate: string;
}

export interface CityLocation {
	city: string;
	country: string;
}

interface AladhanResponse {
	code: number;
	status: string;
	data?: {
		timings?: Record<string, string>;
		date?: {
			gregorian?: { date?: string; weekday?: { en?: string } };
			hijri?: { date?: string; month?: { en?: string } };
		};
		meta?: { timezone?: string };
	};
}

interface NominatimResponse {
	address?: Record<string, string | undefined>;
}

/** Resolve browser-provided coordinates to a city for AlAdhan's city endpoint. */
export async function findCityFromCoordinates(latitude: number, longitude: number): Promise<CityLocation> {
	const url = new URL("https://nominatim.openstreetmap.org/reverse");
	url.searchParams.set("format", "jsonv2");
	url.searchParams.set("addressdetails", "1");
	url.searchParams.set("zoom", "10");
	url.searchParams.set("lat", String(latitude));
	url.searchParams.set("lon", String(longitude));

	const response = await requestUrl({
		url: url.toString(),
		method: "GET",
		headers: { "User-Agent": "Obsideen Obsidian plugin (prayer-time location lookup)" },
		throw: false
	});
	if (response.status >= 400) {
		throw new Error(`OpenStreetMap location lookup failed (HTTP ${response.status}).`);
	}

	let result: NominatimResponse;
	try {
		result = JSON.parse(response.text) as NominatimResponse;
	} catch {
		throw new Error("The location service returned an unreadable response.");
	}

	const address = result.address;
	const city = address?.city
		?? address?.town
		?? address?.village
		?? address?.municipality
		?? address?.hamlet
		?? address?.city_district
		?? address?.suburb;
	const country = address?.country;
	if (!city || !country) {
		throw new Error("Could not identify a city for your location. You can enter it manually instead.");
	}
	return { city, country };
}

export async function loadSalahTimes(
	city: string,
	country: string,
	method: number
): Promise<SalahTimes> {
	const url = new URL("https://api.aladhan.com/v1/timingsByCity");
	url.searchParams.set("city", city);
	url.searchParams.set("country", country);
	url.searchParams.set("method", String(method));

	const response = await requestUrl({ url: url.toString(), method: "GET", throw: false });
	if (response.status >= 400) {
		throw new Error(`AlAdhan returned HTTP ${response.status}.`);
	}

	let result: AladhanResponse;
	try {
		result = JSON.parse(response.text) as AladhanResponse;
	} catch {
		throw new Error("AlAdhan returned an unreadable response.");
	}
	if (result.code !== 200 || !result.data?.timings) {
		throw new Error(result.status || "AlAdhan could not find prayer times for that location.");
	}

	const timings = {} as Record<SalahPrayer, string>;
	for (const prayer of SALAH_PRAYERS) {
		const value = result.data.timings[prayer];
		if (!value || !/^\d{1,2}:\d{2}/.test(value)) {
			throw new Error(`AlAdhan did not return a valid time for ${prayer}.`);
		}
		timings[prayer] = value;
	}

	const gregorianDate = result.data.date?.gregorian?.date ?? "";
	const dateKey = toDateKey(gregorianDate);
	const weekday = result.data.date?.gregorian?.weekday?.en;
	const hijri = result.data.date?.hijri;
	const hijriDate = [hijri?.date, hijri?.month?.en].filter(Boolean).join(" ");

	return {
		timings,
		dateKey,
		dateLabel: formatGregorianDate(gregorianDate, weekday),
		timezone: result.data.meta?.timezone ?? "",
		hijriDate
	};
}

function toDateKey(date: string): string {
	const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(date);
	return match ? `${match[3]}-${match[2]}-${match[1]}` : new Date().toISOString().slice(0, 10);
}

function formatGregorianDate(date: string, weekday?: string): string {
	const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(date);
	if (!match) return date || "Today";
	const parsed = new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 12));
	const formatted = new Intl.DateTimeFormat(undefined, {
		day: "numeric",
		month: "long",
		year: "numeric",
		timeZone: "UTC"
	}).format(parsed);
	return weekday ? `${weekday}, ${formatted}` : formatted;
}
