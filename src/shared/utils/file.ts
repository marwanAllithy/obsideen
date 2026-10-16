import type { App } from "obsidian";

export async function readJsonFile<T>(app: App, path: string): Promise<T | null> {
	try {
		const data = await app.vault.adapter.read(path);
		return JSON.parse(data) as T;
	} catch (e) {
		console.error("Obsideen: failed to read", path, e);
		return null;
	}
}
