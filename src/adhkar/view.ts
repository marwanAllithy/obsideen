import { ItemView, type App, type WorkspaceLeaf } from "obsidian";
import AdkarView from "./components/AdkarView.svelte";

export const VIEW_TYPE_OBSIDEEN_ADKAR = "obsideen-daily-adkar";

export function createObsideenAdkarView(leaf: WorkspaceLeaf, app: App, manifestDir: string): ObsideenAdkarView {
	return new ObsideenAdkarView(leaf, app, manifestDir);
}

export class ObsideenAdkarView extends ItemView {
	private component: AdkarView | null = null;

	constructor(leaf: WorkspaceLeaf, private appRef: App, private manifestDir: string) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_OBSIDEEN_ADKAR;
	}

	getDisplayText(): string {
		return "Obsideen Daily Adkar";
	}

	getIcon(): string {
		return "sun";
	}

	async onOpen(): Promise<void> {
		this.containerEl.empty();

		this.component = new AdkarView({
			target: this.containerEl,
			props: {
				app: this.appRef,
				manifestDir: this.manifestDir
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
