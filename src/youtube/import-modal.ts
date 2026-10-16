import { Modal, Notice, Setting, TFile, TFolder, type App, type ButtonComponent } from "obsidian";
import { fetchYoutubePlaylist, type YoutubePlaylistVideo } from "./playlist";

export class YoutubePlaylistImportModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Create notes from a YouTube playlist" });
		contentEl.createEl("p", {
			text: "Imports public playlist videos and embeds them in individual notes. Videos are not downloaded."
		});

		let playlistUrl = "";
		let folderPath = "Islamic Lectures";
		const status = contentEl.createEl("p", { cls: "obsideen-youtube-import-status" });

		new Setting(contentEl)
			.setName("Playlist URL")
			.addText((text) =>
				text
					.setPlaceholder("https://www.youtube.com/playlist?list=...")
					.onChange((value) => (playlistUrl = value))
			);

		new Setting(contentEl)
			.setName("Notes folder")
			.setDesc("Vault-relative folder. Missing folders will be created; leave empty to use the vault root.")
			.addText((text) =>
				text
					.setValue(folderPath)
					.setPlaceholder("Islamic Lectures")
					.onChange((value) => (folderPath = value))
			);

		new Setting(contentEl).addButton((button) => {
			button
				.setButtonText("Import playlist")
				.setCta()
				.onClick(() => void this.importPlaylist(playlistUrl, folderPath, status, button));
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async importPlaylist(
		playlistUrl: string,
		folderInput: string,
		status: HTMLElement,
		button: ButtonComponent
	): Promise<void> {
		button.setDisabled(true);
		status.setText("Reading the playlist from YouTube…");

		try {
			const folder = validateFolderPath(folderInput);
			const playlist = await fetchYoutubePlaylist(playlistUrl);
			await ensureFolder(this.app, folder);

			let created = 0;
			let skipped = 0;
			let failed = 0;
			for (let index = 0; index < playlist.videos.length; index += 1) {
				const video = playlist.videos[index];
				status.setText(`Creating notes: ${index + 1} of ${playlist.videos.length}…`);
				try {
					const result = await createVideoNote(this.app, folder, playlist.id, playlist.title, video);
					if (result === "created") created += 1;
					else skipped += 1;
				} catch (error) {
					failed += 1;
					console.warn(`Obsideen: could not create a note for YouTube video ${video.id}`, error);
				}
			}

			const summary = [
				`${created} note${created === 1 ? "" : "s"} created`,
				skipped ? `${skipped} already existed` : "",
				failed ? `${failed} failed` : "",
				playlist.unavailableVideoCount ? `${playlist.unavailableVideoCount} unavailable video${playlist.unavailableVideoCount === 1 ? "" : "s"} skipped` : ""
			].filter(Boolean).join(", ");
			status.setText(`“${playlist.title}”: ${summary}.`);
			new Notice(`YouTube playlist import complete: ${summary}.`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			status.setText(message);
			new Notice(`YouTube playlist import failed: ${message}`);
		} finally {
			button.setDisabled(false);
		}
	}
}

function validateFolderPath(input: string): string {
	const path = input.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
	if (!path) return "";
	const segments = path.split("/").filter(Boolean);
	if (segments.some((segment) => segment === "." || segment === "..")) {
		throw new Error("Use a folder path inside the vault (parent-directory segments are not allowed).");
	}
	return segments.join("/");
}

async function ensureFolder(app: App, folderPath: string): Promise<void> {
	if (!folderPath) return;
	let currentPath = "";
	for (const segment of folderPath.split("/")) {
		currentPath = currentPath ? `${currentPath}/${segment}` : segment;
		const existing = app.vault.getAbstractFileByPath(currentPath);
		if (existing instanceof TFolder) continue;
		if (existing) throw new Error(`Cannot create notes: “${currentPath}” is a file, not a folder.`);
		await app.vault.createFolder(currentPath);
	}
}

async function createVideoNote(
	app: App,
	folder: string,
	playlistId: string,
	playlistTitle: string,
	video: YoutubePlaylistVideo
): Promise<"created" | "exists"> {
	const baseName = sanitizeFileName(video.title) || `YouTube video ${video.id}`;
	const marker = `youtube_video_id: ${JSON.stringify(video.id)}`;
	let path = "";
	for (let suffix = 1; suffix <= 1000; suffix += 1) {
		const name = suffix === 1 ? baseName : `${baseName} (${suffix})`;
		path = folder ? `${folder}/${name}.md` : `${name}.md`;
		const existing = app.vault.getAbstractFileByPath(path);
		if (!existing) break;
		if (existing instanceof TFile && (await app.vault.read(existing)).includes(marker)) return "exists";
		path = "";
	}
	if (!path) throw new Error(`Could not find an unused filename for “${video.title}”.`);

	const content = createNoteContent(video, playlistId, playlistTitle);
	await app.vault.create(path, content);
	return "created";
}

function createNoteContent(video: YoutubePlaylistVideo, playlistId: string, playlistTitle: string): string {
	const lines = [
		"---",
		`youtube_video_id: ${JSON.stringify(video.id)}`,
		`youtube_playlist_id: ${JSON.stringify(playlistId)}`,
		`youtube_playlist_title: ${JSON.stringify(playlistTitle)}`,
		`youtube_url: ${JSON.stringify(`https://www.youtube.com/watch?v=${video.id}`)}`,
		"---",
		"",
		`# ${video.title.replace(/[\r\n]+/g, " ")}`,
		"",
		`![](https://www.youtube.com/watch?v=${video.id})`,
		""
	];
	if (video.channel) lines.push(`**Channel:** ${video.channel}`, "");
	if (video.published) lines.push(`**Published:** ${video.published}`, "");
	if (video.duration) lines.push(`**Duration:** ${video.duration}`, "");
	if (video.description) lines.push("## Description", "", video.description, "");
	lines.push(`**Playlist:** ${playlistTitle}`, "");
	return lines.join("\n");
}

function sanitizeFileName(title: string): string {
	return title
		.replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
		.replace(/\s+/g, " ")
		.replace(/[. ]+$/g, "")
		.trim()
		.slice(0, 120);
}
