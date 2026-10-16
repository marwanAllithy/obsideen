import { ItemView, type WorkspaceLeaf, type App, Notice } from "obsidian";
import ReaderView from "./components/ReaderView.svelte";
import type { ReaderSettings } from "../shared/types";

export const VIEW_TYPE_OBSIDEEN = "obsideen-quran-reader";

export function createObsideenView(
	leaf: WorkspaceLeaf,
	app: App,
	manifestDir: string,
	settings: ReaderSettings,
	onSettingsChange: (settings: ReaderSettings) => Promise<void>
): ObsideenQuranView {
	return new ObsideenQuranView(leaf, app, manifestDir, settings, onSettingsChange);
}

export class ObsideenQuranView extends ItemView {
	private component: ReaderView | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private appRef: App,
		private manifestDir: string,
		private settings: ReaderSettings,
		private onSettingsChange: (settings: ReaderSettings) => Promise<void>
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_OBSIDEEN;
	}

	getDisplayText(): string {
		return "Obsideen Quran Reader";
	}

	getIcon(): string {
		return "book-open";
	}

	updateSettings(settings: ReaderSettings): void {
		this.settings = settings;
		this.component?.$set({ settings });
	}

	async onOpen(): Promise<void> {
		this.containerEl.empty();

		this.component = new ReaderView({
			target: this.containerEl,
			props: {
				app: this.appRef,
				manifestDir: this.manifestDir,
				settings: this.settings,
				onSettingsChange: async (settings: ReaderSettings) => {
					this.settings = settings;
					await this.onSettingsChange(settings);
				}
			}
		});

		await this.component.initialize();
	}

	onClose(): Promise<void> {
		this.component?.$destroy();
		this.component = null;
		return Promise.resolve();
	}

	async insertSelectedVerses(): Promise<void> {
		if (!this.component) {
			new Notice("Reader is not ready.");
			return;
		}
		await this.component.insertSelectedVerses();
	}

	async copySelectedVerses(): Promise<void> {
		if (!this.component) {
			new Notice("Reader is not ready.");
			return;
		}
		await this.component.copySelectedVerses();
	}

	async openVerse(chapter: number, verse: number): Promise<void> {
		if (!this.component) {
			new Notice("Reader is not ready.");
			return;
		}
		await this.component.openVerse(chapter, verse);
	}
}
