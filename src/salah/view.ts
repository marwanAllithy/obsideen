import { ItemView, type WorkspaceLeaf } from "obsidian";
import SalahView from "./components/SalahView.svelte";
import type { ReaderSettings } from "../shared/types";

export const VIEW_TYPE_OBSIDEEN_SALAH = "obsideen-salah-times";

export function createObsideenSalahView(
	leaf: WorkspaceLeaf,
	settings: ReaderSettings,
	onSaveSettings: (settings: ReaderSettings) => Promise<void>
): ObsideenSalahView {
	return new ObsideenSalahView(leaf, settings, onSaveSettings);
}

export class ObsideenSalahView extends ItemView {
	private component: SalahView | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private settings: ReaderSettings,
		private onSaveSettings: (settings: ReaderSettings) => Promise<void>
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_OBSIDEEN_SALAH;
	}

	getDisplayText(): string {
		return "Salah Times & Tracker";
	}

	getIcon(): string {
		return "clock";
	}

	async onOpen(): Promise<void> {
		this.containerEl.empty();
		this.component = new SalahView({
			target: this.containerEl,
			props: {
				settings: this.settings,
				onSaveSettings: this.onSaveSettings
			}
		});
		await this.component.initialize();
	}

	updateSettings(settings: ReaderSettings): void {
		this.settings = settings;
		this.component?.$set({ settings });
	}

	onClose(): Promise<void> {
		this.component?.$destroy();
		this.component = null;
		return Promise.resolve();
	}
}
