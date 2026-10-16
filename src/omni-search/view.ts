import { ItemView, type WorkspaceLeaf, type App } from "obsidian";
import OmniSearch from "./components/OmniSearch.svelte";
import type { ReaderSettings } from "../shared/types";

export const VIEW_TYPE_OBSIDEEN_OMNI_SEARCH = "obsideen-omni-search";

export function createObsideenOmniSearchView(
	leaf: WorkspaceLeaf,
	app: App,
	manifestDir: string,
	settings: ReaderSettings,
	onOpenVerse: (chapter: number, verse: number) => Promise<void>
): ObsideenOmniSearchView {
	return new ObsideenOmniSearchView(leaf, app, manifestDir, settings, onOpenVerse);
}

export class ObsideenOmniSearchView extends ItemView {
	private component: OmniSearch | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private appRef: App,
		private manifestDir: string,
		private settings: ReaderSettings,
		private onOpenVerse: (chapter: number, verse: number) => Promise<void>
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_OBSIDEEN_OMNI_SEARCH;
	}

	getDisplayText(): string {
		return "Obsideen Omni Search";
	}

	getIcon(): string {
		return "search";
	}

	updateSettings(settings: ReaderSettings): void {
		const indexInputsChanged =
			settings.primaryEdition !== this.settings.primaryEdition ||
			settings.secondaryEdition !== this.settings.secondaryEdition;
		this.settings = settings;
		this.component?.$set({ settings });
		if (indexInputsChanged) this.component?.resetIndexes();
	}

	async onOpen(): Promise<void> {
		this.containerEl.empty();
		this.component = new OmniSearch({
			target: this.containerEl,
			props: {
				app: this.appRef,
				manifestDir: this.manifestDir,
				settings: this.settings,
				onOpenVerse: this.onOpenVerse
			}
		});
	}

	onClose(): Promise<void> {
		this.component?.$destroy();
		this.component = null;
		return Promise.resolve();
	}
}
