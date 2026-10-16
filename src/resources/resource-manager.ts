import { requestUrl, type App } from "obsidian";
import { unzip, type Unzipped } from "fflate";

type ResourcePackName = "data" | "fonts";

interface ResourcePackManifest {
	version: string;
	pack: ResourcePackName;
	files: Record<string, { size: number; sha256: string }>;
}

const RESOURCE_RELEASE_BASE = "https://github.com/marwanAllithy/obsideen/releases/download";
const RESOURCE_MARKER = "data/.obsideen-resource-version";
const MAX_ARCHIVE_SIZE = 512 * 1024 * 1024;
const MAX_ARCHIVE_FILES = 2_000;

const REQUIRED_RESOURCE_FILES = [
	"data/info.json",
	"data/editions.json",
	"data/pages.json",
	"data/translations/ara-quransimple.json",
	"data/translations/ara-quranuthmanihaf.json",
	"data/translations/eng-mustafakhattaba.json",
	"data/translations/eng-abdullahyusufal.json",
	"data/translations/eng-abdelhaleem.json",
	"data/qcf-pages/1.json",
	"data/tafsir/editions.json",
	"data/hadith/by_book/books.json",
	"data/adhkar/daily.json",
	"fonts/UthmanicHafs.ttf",
	"fonts/NotoNaskhArabic-Regular.ttf",
	"fonts/qcf-v2/p1.woff2"
];

export async function areResourcesInstalled(
	app: App,
	pluginDir: string,
	version: string
): Promise<boolean> {
	const adapter = app.vault.adapter;

	try {
		const installedVersion = (await adapter.read(`${pluginDir}/${RESOURCE_MARKER}`)).trim();
		if (installedVersion !== version) return false;

		const requiredFilesExist = await Promise.all(
			REQUIRED_RESOURCE_FILES.map((path) => adapter.exists(`${pluginDir}/${path}`))
		);
		return requiredFilesExist.every(Boolean);
	} catch {
		return false;
	}
}

export async function installResourcePacks(
	app: App,
	pluginDir: string,
	version: string,
	onStatus: (message: string) => void
): Promise<void> {
	const adapter = app.vault.adapter;
	const packs: ResourcePackName[] = ["data", "fonts"];
	let markerContents: Uint8Array | null = null;
	const markerPath = `${pluginDir}/${RESOURCE_MARKER}`;
	if (await adapter.exists(markerPath)) await adapter.remove(markerPath);

	for (const [index, pack] of packs.entries()) {
		onStatus(
			`Downloading ${pack === "data" ? "Quran and library data" : "Arabic fonts"} (${index + 1} of ${packs.length})…`
		);

		const filename = `obsideen-resources-${version}-${pack}.zip`;
		const url = `${RESOURCE_RELEASE_BASE}/${encodeURIComponent(version)}/${filename}`;
		const response = await requestUrl({ url, throw: false });
		if (response.status < 200 || response.status >= 300) {
			throw new Error(
				`The ${pack} resource pack could not be downloaded (HTTP ${response.status}). ` +
				`Check that ${filename} is attached to the GitHub release tagged ${version}.`
			);
		}
		if (response.arrayBuffer.byteLength === 0 || response.arrayBuffer.byteLength > MAX_ARCHIVE_SIZE) {
			throw new Error(`The ${pack} resource archive has an invalid size.`);
		}

		onStatus(`Verifying and installing ${pack} resources…`);
		const archive = await unzipAsync(new Uint8Array(response.arrayBuffer));
		const files = await validateResourcePack(archive, pack, version);

		for (const [path, contents] of files) {
			if (path === RESOURCE_MARKER) {
				markerContents = contents;
				continue;
			}

			await ensureParentDirectory(adapter, `${pluginDir}/${path}`);
			await adapter.writeBinary(`${pluginDir}/${path}`, toArrayBuffer(contents));
		}
	}

	if (!markerContents || new TextDecoder().decode(markerContents).trim() !== version) {
		throw new Error("The resource archives did not contain the matching Obsideen version marker.");
	}

	await ensureParentDirectory(adapter, `${pluginDir}/${RESOURCE_MARKER}`);
	await adapter.write(`${pluginDir}/${RESOURCE_MARKER}`, version);

	if (!(await areResourcesInstalled(app, pluginDir, version))) {
		throw new Error("Some required resource files are missing after installation. Please try again.");
	}
}

async function validateResourcePack(
	archive: Unzipped,
	pack: ResourcePackName,
	version: string
): Promise<Array<[string, Uint8Array]>> {
	const manifestBytes = archive["resource-pack.json"];
	if (!manifestBytes) throw new Error(`The ${pack} archive is missing its resource manifest.`);

	let manifest: ResourcePackManifest;
	try {
		manifest = JSON.parse(new TextDecoder().decode(manifestBytes)) as ResourcePackManifest;
	} catch {
		throw new Error(`The ${pack} archive contains an invalid resource manifest.`);
	}

	if (manifest.version !== version || manifest.pack !== pack || !manifest.files) {
		throw new Error(`The ${pack} archive does not match resource version ${version}.`);
	}

	const entries = Object.keys(archive)
		.filter((path) => path !== "resource-pack.json")
		.map((path): [string, Uint8Array] => [path, archive[path]]);
	const expectedPaths = Object.keys(manifest.files);
	if (entries.length === 0 || entries.length > MAX_ARCHIVE_FILES || entries.length !== expectedPaths.length) {
		throw new Error(`The ${pack} archive has an unexpected number of files.`);
	}

	const expectedPrefix = `${pack}/`;
	for (const [path, contents] of entries) {
		if (!isSafeResourcePath(path) || !path.startsWith(expectedPrefix)) {
			throw new Error(`The ${pack} archive contains an unsafe file path.`);
		}

		const expected = manifest.files[path];
		if (!expected || contents.byteLength !== expected.size) {
			throw new Error(`A file in the ${pack} archive did not match its manifest.`);
		}
		const actualHash = await sha256Hex(contents);
		if (actualHash !== expected.sha256) {
			throw new Error(`A file in the ${pack} archive failed its integrity check.`);
		}
	}

	for (const path of expectedPaths) {
		if (!archive[path]) throw new Error(`The ${pack} archive is missing ${path}.`);
	}

	if (pack === "data") {
		const marker = archive[RESOURCE_MARKER];
		if (!marker || new TextDecoder().decode(marker).trim() !== version) {
			throw new Error("The data archive contains the wrong resource version.");
		}
	}

	return entries;
}

function unzipAsync(data: Uint8Array): Promise<Unzipped> {
	return new Promise((resolve, reject) => {
		unzip(data, (error, files) => {
			if (error) reject(error);
			else resolve(files);
		});
	});
}

function isSafeResourcePath(path: string): boolean {
	return (
		!path.startsWith("/") &&
		!path.includes("\\") &&
		!path.split("/").some((part) => part === ".." || part === "." || part === "")
	);
}

async function ensureParentDirectory(
	adapter: App["vault"]["adapter"],
	filePath: string
): Promise<void> {
	const parts = filePath.split("/");
	parts.pop();
	let current = "";
	for (const part of parts) {
		current = current ? `${current}/${part}` : part;
		if (!(await adapter.exists(current))) await adapter.mkdir(current);
	}
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
	if (!globalThis.crypto?.subtle) {
		throw new Error("This Obsidian environment does not support resource integrity checks.");
	}
	const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
	const digest = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", buffer));
	return Array.from(digest, (byte) => `0${byte.toString(16)}`.slice(-2)).join("");
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
