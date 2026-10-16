import { ItemView, type WorkspaceLeaf, type App } from "obsidian";
import HadithView from "./components/HadithView.svelte";
import type { ReaderSettings } from "../shared/types";

export const VIEW_TYPE_OBSIDEEN_HADITH = "obsideen-hadith-search";

export function createObsideenHadithView(
	leaf: WorkspaceLeaf,
	app: App,
	manifestDir: string,
	settings: ReaderSettings
): ObsideenHadithView {
	return new ObsideenHadithView(leaf, app, manifestDir, settings);
}

export class ObsideenHadithView extends ItemView {
	private component: HadithView | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private appRef: App,
		private manifestDir: string,
		private settings: ReaderSettings
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_OBSIDEEN_HADITH;
	}

	getDisplayText(): string {
		return "Obsideen Hadith Library";
	}

	getIcon(): string {
		return "book";
	}

	async onOpen(): Promise<void> {
		this.containerEl.empty();

		this.component = new HadithView({
			target: this.containerEl,
			props: {
				app: this.appRef,
				manifestDir: this.manifestDir,
				settings: this.settings
			}
		});

		await this.component.initialize();
	}

	onClose(): Promise<void> {
		this.component?.$destroy();
		this.component = null;
		return Promise.resolve();
	}
}
