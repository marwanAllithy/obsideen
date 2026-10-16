import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { strToU8, zipSync } from "fflate";

const pluginManifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

if (pluginManifest.version !== packageJson.version) {
	throw new Error("manifest.json and package.json versions must match before packaging resources.");
}

const version = pluginManifest.version;
const outputDir = "dist/resources";
mkdirSync(outputDir, { recursive: true });
writeFileSync("data/.obsideen-resource-version", `${version}\n`);

for (const pack of ["data", "fonts"]) {
	const archiveFiles = {};
	const packManifest = {
		version,
		pack,
		files: {}
	};

	for (const fullPath of listFiles(pack)) {
		const archivePath = relative(".", fullPath).split(sep).join("/");
		const contents = new Uint8Array(readFileSync(fullPath));
		archiveFiles[archivePath] = contents;
		packManifest.files[archivePath] = {
			size: contents.byteLength,
			sha256: createHash("sha256").update(contents).digest("hex")
		};
	}

	archiveFiles["resource-pack.json"] = strToU8(JSON.stringify(packManifest));
	const archive = zipSync(archiveFiles, { level: pack === "data" ? 6 : 1 });
	const outputPath = join(outputDir, `obsideen-resources-${version}-${pack}.zip`);
	writeFileSync(outputPath, archive);
	console.log(`${outputPath} (${(archive.byteLength / 1024 / 1024).toFixed(1)} MB)`);
}

function listFiles(directory) {
	const result = [];
	for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) result.push(...listFiles(path));
		else if (entry.isFile()) result.push(path);
	}
	return result;
}
