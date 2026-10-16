import { Plugin, type ItemView, type WorkspaceLeaf, Notice } from "obsidian";
import type { ReaderSettings } from "./shared/types";
import { DEFAULT_SETTINGS, mergeSettings } from "./settings";
import { ObsideenSettingTab } from "./settings-tab";
import { createObsideenView, ObsideenQuranView, VIEW_TYPE_OBSIDEEN } from "./quran/view";
import { createObsideenHadithView, ObsideenHadithView, VIEW_TYPE_OBSIDEEN_HADITH } from "./hadith/view";
import { createObsideenAdkarView, VIEW_TYPE_OBSIDEEN_ADKAR } from "./adhkar/view";
import {
	createObsideenOmniSearchView,
	ObsideenOmniSearchView,
	VIEW_TYPE_OBSIDEEN_OMNI_SEARCH
} from "./omni-search/view";
import {
	createObsideenSalahView,
	ObsideenSalahView,
	VIEW_TYPE_OBSIDEEN_SALAH
} from "./salah/view";
import { YoutubePlaylistImportModal } from "./youtube/import-modal";
import {
	createObsideenDashboardView,
	VIEW_TYPE_OBSIDEEN_DASHBOARD,
	type DashboardAction
} from "./dashboard/view";
import { ResourceInstallerModal } from "./resources/installer-modal";
import { areResourcesInstalled, installResourcePacks } from "./resources/resource-manager";
import { ResourceLockedView } from "./resources/locked-view";
import {
	buildVerseMap,
	getEditionMeta,
	loadEditionsCatalog,
	loadQuranInfo,
	loadTranslation
} from "./quran/data-loader";
import { formatVersesForInsert } from "./quran/utils/format";
import {
	discoverHadithBooks,
	formatHadithForInsert,
	getHadithBasePath,
	loadHadithBook
} from "./hadith/loader";

export default class ObsideenPlugin extends Plugin {
	settings: ReaderSettings = DEFAULT_SETTINGS;
	private resourcesReady = false;
	private resourceInstallerOpen = false;
	private applicationFeaturesRegistered = false;

	async onload(): Promise<void> {
		await this.loadSettings();
		const pluginDir = this.getPluginDir();
		this.resourcesReady = await areResourcesInstalled(this.app, pluginDir, this.manifest.version);
		this.registerResourceGatedViews();
		this.addRibbonIcon("download", "Install Obsideen offline resources", () => {
			this.openResourceInstaller();
		});
		this.addCommand({
			id: "obsideen-install-offline-resources",
			name: "Obsideen: Install offline resources",
			callback: () => this.openResourceInstaller()
		});

		if (!this.resourcesReady) {
			this.app.workspace.onLayoutReady(() => this.openResourceInstaller());
			return;
		}

		this.registerApplicationFeatures();
	}

	private registerResourceGatedViews(): void {
		this.registerResourceGatedView(VIEW_TYPE_OBSIDEEN, "Quran Reader", (leaf) =>
			createObsideenView(leaf, this.app, this.getPluginDir(), this.settings, this.saveSettings.bind(this))
		);
		this.registerResourceGatedView(VIEW_TYPE_OBSIDEEN_DASHBOARD, "Dashboard", (leaf) =>
			createObsideenDashboardView(leaf, (action) => {
				void this.openDashboardAction(action);
			})
		);
		this.registerResourceGatedView(VIEW_TYPE_OBSIDEEN_HADITH, "Hadith Library", (leaf) =>
			createObsideenHadithView(leaf, this.app, this.getPluginDir(), this.settings)
		);
		this.registerResourceGatedView(VIEW_TYPE_OBSIDEEN_ADKAR, "Daily Adkar", (leaf) =>
			createObsideenAdkarView(leaf, this.app, this.getPluginDir())
		);
		this.registerResourceGatedView(VIEW_TYPE_OBSIDEEN_OMNI_SEARCH, "Quran and Hadith Search", (leaf) =>
			createObsideenOmniSearchView(
				leaf,
				this.app,
				this.getPluginDir(),
				this.settings,
				(chapter, verse) => this.openQuranVerse(chapter, verse)
			)
		);
		this.registerResourceGatedView(VIEW_TYPE_OBSIDEEN_SALAH, "Salah Times", (leaf) =>
			createObsideenSalahView(leaf, this.settings, this.saveSettings.bind(this))
		);
	}

	private registerResourceGatedView(
		type: string,
		featureName: string,
		createView: (leaf: WorkspaceLeaf) => ItemView
	): void {
		this.registerView(type, (leaf) =>
			this.resourcesReady
				? createView(leaf)
				: new ResourceLockedView(leaf, type, featureName, () => this.openResourceInstaller())
		);
	}

	private registerApplicationFeatures(): void {
		if (this.applicationFeaturesRegistered || !this.resourcesReady) return;
		this.applicationFeaturesRegistered = true;
		this.injectArabicFontFaces();

		this.addRibbonIcon("home", "Open Obsideen Dashboard", () => {
			this.activateDashboard();
		});

		this.addRibbonIcon("book-open", "Open Obsideen Quran Reader", () => {
			this.activateView();
		});

		this.addRibbonIcon("search", "Search Quran and Hadith", () => {
			this.activateOmniSearch();
		});

		this.addRibbonIcon("library", "Open Obsideen Hadith Library", () => {
			this.activateHadithView();
		});

		this.addRibbonIcon("sun", "Open Obsideen Daily Adkar", () => {
			this.activateAdkarView();
		});

		this.addRibbonIcon("clock", "Open Salah Times & Tracker", () => {
			this.activateSalahView();
		});

		this.addCommand({
			id: "open-obsideen-dashboard",
			name: "Obsideen: Open dashboard",
			callback: () => this.activateDashboard()
		});

		this.addCommand({
			id: "open-obsideen-quran-reader",
			name: "Obsideen: Open Quran reader",
			callback: () => this.activateView()
		});

		this.addCommand({
			id: "open-obsideen-hadith-search",
			name: "Obsideen: Open Hadith library",
			callback: () => this.activateHadithView()
		});

		this.addCommand({
			id: "open-obsideen-daily-adkar",
			name: "Obsideen: Open Daily Adkar",
			callback: () => this.activateAdkarView()
		});

		this.addCommand({
			id: "open-obsideen-omni-search",
			name: "Obsideen: Search Quran and Hadith",
			callback: () => this.activateOmniSearch()
		});

		this.addCommand({
			id: "open-obsideen-salah-times",
			name: "Obsideen: Open Salah times and tracker",
			callback: () => this.activateSalahView()
		});

		this.addCommand({
			id: "import-youtube-playlist-notes",
			name: "Obsideen: Create notes from a YouTube playlist",
			callback: () => new YoutubePlaylistImportModal(this.app).open()
		});

		this.addCommand({
			id: "obsideen-insert-selected-verses",
			name: "Obsideen: Insert selected verses into active note",
			callback: () => {
				const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_OBSIDEEN)[0];
				const view = leaf?.view;
				if (view instanceof ObsideenQuranView) {
					view.insertSelectedVerses();
				} else {
					new Notice("Open the Obsideen Quran reader first.");
				}
			}
		});

		this.addCommand({
			id: "obsideen-insert-random-quran-verse",
			name: "Obsideen: Insert a random Quran verse into active note",
			callback: () => this.insertRandomQuranVerse()
		});

		this.addCommand({
			id: "obsideen-insert-random-hadith",
			name: "Obsideen: Insert a random hadith into active note",
			callback: () => this.insertRandomHadith()
		});

		this.addSettingTab(
			new ObsideenSettingTab(
				this.app,
				this,
				() => this.settings,
				this.saveSettings.bind(this)
			)
		);
	}

	private openResourceInstaller(): void {
		if (this.resourceInstallerOpen) return;
		this.resourceInstallerOpen = true;
		new ResourceInstallerModal(
			this.app,
			this.resourcesReady,
			(onStatus) => installResourcePacks(this.app, this.getPluginDir(), this.manifest.version, onStatus),
			() => this.unlockApplication(),
			() => {
				this.resourceInstallerOpen = false;
			}
		).open();
	}

	private async unlockApplication(): Promise<void> {
		this.resourcesReady = true;
		this.registerApplicationFeatures();

		for (const type of [
			VIEW_TYPE_OBSIDEEN,
			VIEW_TYPE_OBSIDEEN_DASHBOARD,
			VIEW_TYPE_OBSIDEEN_HADITH,
			VIEW_TYPE_OBSIDEEN_ADKAR,
			VIEW_TYPE_OBSIDEEN_OMNI_SEARCH,
			VIEW_TYPE_OBSIDEEN_SALAH
		]) {
			this.app.workspace.getLeavesOfType(type).forEach((leaf) => leaf.detach());
		}

		await this.activateDashboard();
	}

	async loadSettings(): Promise<void> {
		this.settings = mergeSettings(await this.loadData());
	}

	private getPluginDir(): string {
		const pluginDir = this.manifest.dir;
		if (!pluginDir) throw new Error("Plugin directory could not be found.");
		return pluginDir;
	}

	async saveSettings(settings: ReaderSettings): Promise<void> {
		this.settings = settings;
		await this.saveData(this.settings);
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_OBSIDEEN)) {
			if (leaf.view instanceof ObsideenQuranView) leaf.view.updateSettings(settings);
		}
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_OBSIDEEN_OMNI_SEARCH)) {
			if (leaf.view instanceof ObsideenOmniSearchView) leaf.view.updateSettings(settings);
		}
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_OBSIDEEN_SALAH)) {
			if (leaf.view instanceof ObsideenSalahView) leaf.view.updateSettings(settings);
		}
	}

	private injectArabicFontFaces(): void {
		const adapter = this.app.vault.adapter;
		const fontDir = `${this.getPluginDir()}/fonts/`;

		function fontUrl(file: string): string {
			const path = `${fontDir}${file}`;
			return "getResourcePath" in adapter
				? (adapter as any).getResourcePath(path)
				: `file://${path}`;
		}

		const css = `
			@font-face {
				font-family: "Uthmanic Hafs";
				src: local("Uthmanic Hafs"), url("${fontUrl("UthmanicHafs.ttf")}") format("truetype");
				font-weight: 400;
				font-style: normal;
				font-display: swap;
			}
			@font-face {
				font-family: "Noto Naskh Arabic";
				src: local("Noto Naskh Arabic"), url("${fontUrl("NotoNaskhArabic-Regular.ttf")}") format("truetype");
				font-weight: 400;
				font-style: normal;
				font-display: swap;
			}
			@font-face {
				font-family: "Noto Naskh Arabic";
				src: local("Noto Naskh Arabic Medium"), url("${fontUrl("NotoNaskhArabic-Medium.ttf")}") format("truetype");
				font-weight: 500;
				font-style: normal;
				font-display: swap;
			}
			@font-face {
				font-family: "Noto Naskh Arabic";
				src: local("Noto Naskh Arabic SemiBold"), url("${fontUrl("NotoNaskhArabic-SemiBold.ttf")}") format("truetype");
				font-weight: 600;
				font-style: normal;
				font-display: swap;
			}
			@font-face {
				font-family: "Noto Naskh Arabic";
				src: local("Noto Naskh Arabic Bold"), url("${fontUrl("NotoNaskhArabic-Bold.ttf")}") format("truetype");
				font-weight: 700;
				font-style: normal;
				font-display: swap;
			}
		`;

		const style = document.createElement("style");
		style.id = "obsideen-arabic-fonts";
		style.textContent = css;
		document.head.appendChild(style);
	}

	async activateView(): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_OBSIDEEN)[0];
		if (!leaf) {
			leaf = workspace.getRightLeaf(false);
			await leaf.setViewState({ type: VIEW_TYPE_OBSIDEEN, active: true });
		} else {
			workspace.revealLeaf(leaf);
		}
	}

	async activateDashboard(): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_OBSIDEEN_DASHBOARD)[0];
		if (!leaf) {
			leaf = workspace.getRightLeaf(false);
			await leaf.setViewState({ type: VIEW_TYPE_OBSIDEEN_DASHBOARD, active: true });
		} else {
			workspace.revealLeaf(leaf);
		}
	}

	private async openDashboardAction(action: DashboardAction): Promise<void> {
		switch (action) {
			case "quran":
				await this.activateView();
				break;
			case "search":
				await this.activateOmniSearch();
				break;
			case "hadith":
				await this.activateHadithView();
				break;
			case "adkar":
				await this.activateAdkarView();
				break;
			case "salah":
				await this.activateSalahView();
				break;
			case "youtube":
				new YoutubePlaylistImportModal(this.app).open();
				break;
		}
	}

	async activateHadithView(): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_OBSIDEEN_HADITH)[0];
		if (!leaf) {
			leaf = workspace.getRightLeaf(false);
			await leaf.setViewState({ type: VIEW_TYPE_OBSIDEEN_HADITH, active: true });
		} else {
			workspace.revealLeaf(leaf);
		}
	}

	async activateAdkarView(): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_OBSIDEEN_ADKAR)[0];
		if (!leaf) {
			leaf = workspace.getRightLeaf(false);
			await leaf.setViewState({ type: VIEW_TYPE_OBSIDEEN_ADKAR, active: true });
		} else {
			workspace.revealLeaf(leaf);
		}
	}

	async activateOmniSearch(): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_OBSIDEEN_OMNI_SEARCH)[0];
		if (!leaf) {
			leaf = workspace.getRightLeaf(false);
			await leaf.setViewState({ type: VIEW_TYPE_OBSIDEEN_OMNI_SEARCH, active: true });
		} else {
			workspace.revealLeaf(leaf);
		}
	}

	async activateSalahView(): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_OBSIDEEN_SALAH)[0];
		if (!leaf) {
			leaf = workspace.getRightLeaf(false);
			await leaf.setViewState({ type: VIEW_TYPE_OBSIDEEN_SALAH, active: true });
		} else {
			workspace.revealLeaf(leaf);
		}
	}

	async openQuranVerse(chapter: number, verse: number): Promise<void> {
		await this.activateView();
		const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_OBSIDEEN)[0];
		if (leaf?.view instanceof ObsideenQuranView) {
			await leaf.view.openVerse(chapter, verse);
		} else {
			new Notice("The Quran reader could not be opened.");
		}
	}

	private async insertRandomQuranVerse(): Promise<void> {
		if (!this.app.workspace.getActiveFile()) {
			new Notice("No active note to insert into.");
			return;
		}

		try {
			const manifestDir = this.getPluginDir();
			if (!manifestDir) throw new Error("Plugin data directory could not be found.");

			const [quranInfo, catalog] = await Promise.all([
				loadQuranInfo(this.app, manifestDir),
				loadEditionsCatalog(this.app, manifestDir)
			]);
			if (!quranInfo) throw new Error("Bundled Quran data could not be loaded.");

			const verses: { chapter: (typeof quranInfo.chapters)[number]; verse: number }[] = [];
			for (const chapter of quranInfo.chapters) {
				for (const verse of chapter.verses) {
					verses.push({ chapter, verse: verse.verse });
				}
			}
			const selection = verses[Math.floor(Math.random() * verses.length)];
			if (!selection) throw new Error("No Quran verses are available.");

			const [primaryData, secondaryData] = await Promise.all([
				loadTranslation(this.app, manifestDir, this.settings.primaryEdition),
				loadTranslation(this.app, manifestDir, this.settings.secondaryEdition)
			]);
			const verseKey = `${selection.chapter.chapter}:${selection.verse}`;
			const primaryText = buildVerseMap(primaryData).get(verseKey);
			const secondaryText = buildVerseMap(secondaryData).get(verseKey);
			if (primaryText === undefined && secondaryText === undefined) {
				throw new Error("The selected verse text could not be loaded.");
			}

			const text = formatVersesForInsert(
				selection.chapter,
				[selection.verse],
				new Map([[selection.verse, { primary: primaryText, secondary: secondaryText }]]),
				getEditionMeta(catalog, this.settings.primaryEdition),
				getEditionMeta(catalog, this.settings.secondaryEdition),
				this.settings.insertFormat
			);
			await this.insertTextIntoActiveNote(text, "Random Quran verse");
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			new Notice(`Could not insert a random Quran verse: ${message}`);
		}
	}

	private async insertRandomHadith(): Promise<void> {
		if (!this.app.workspace.getActiveFile()) {
			new Notice("No active note to insert into.");
			return;
		}

		try {
			const manifestDir = this.getPluginDir();
			if (!manifestDir) throw new Error("Plugin data directory could not be found.");

			const result = await discoverHadithBooks(this.app, manifestDir);
			if (result.books.length === 0) {
				throw new Error(result.error || "No bundled hadith books were found.");
			}

			const books = result.books.filter((book) => book.length > 0);
			const totalHadiths = books.reduce((total, book) => total + book.length, 0);
			if (books.length === 0 || totalHadiths === 0) {
				throw new Error("No hadiths are available in the bundled books.");
			}

			let offset = Math.floor(Math.random() * totalHadiths);
			let bookRef = books[books.length - 1];
			for (const book of books) {
				if (offset < book.length) {
					bookRef = book;
					break;
				}
				offset -= book.length;
			}

			const bookData = await loadHadithBook(
				this.app,
				getHadithBasePath(manifestDir),
				bookRef
			);
			if (!bookData?.hadiths?.length) {
				throw new Error(`Hadiths from ${bookRef.englishTitle} could not be loaded.`);
			}

			const hadith = bookData.hadiths[Math.floor(Math.random() * bookData.hadiths.length)];
			const chapter = bookData.chapters.find((item) => item.id === hadith.chapterId);
			const text = formatHadithForInsert(
				hadith,
				bookRef,
				chapter,
				this.settings.insertFormat
			);
			await this.insertTextIntoActiveNote(text, "Random hadith");
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			new Notice(`Could not insert a random hadith: ${message}`);
		}
	}

	private async insertTextIntoActiveNote(text: string, label: string): Promise<void> {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice("No active note to insert into.");
			return;
		}

		const editor = this.app.workspace.activeEditor?.editor;
		if (editor) {
			editor.replaceSelection(text);
			new Notice(`${label} inserted into active note.`);
			return;
		}

		const current = await this.app.vault.read(activeFile);
		await this.app.vault.modify(activeFile, `${current}\n\n${text}`);
		new Notice(`${label} appended to active note.`);
	}
}
