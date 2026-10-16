import { ItemView, type WorkspaceLeaf } from "obsidian";

export class ResourceLockedView extends ItemView {
	constructor(
		leaf: WorkspaceLeaf,
		private readonly viewType: string,
		private readonly featureName: string,
		private readonly openInstaller: () => void
	) {
		super(leaf);
	}

	getViewType(): string {
		return this.viewType;
	}

	getDisplayText(): string {
		return `${this.featureName} — resources required`;
	}

	getIcon(): string {
		return "download";
	}

	async onOpen(): Promise<void> {
		const contentEl = this.contentEl;
		contentEl.empty();
		contentEl.addClass("obsideen-resource-locked");
		contentEl.createEl("h2", { text: "Offline resources required" });
		contentEl.createEl("p", {
			text: `${this.featureName} is locked until the Obsideen resource packs are installed.`
		});
		const button = contentEl.createEl("button", { text: "Download resources" });
		button.setAttr("type", "button");
		button.addClass("mod-cta");
		button.addEventListener("click", this.openInstaller);
	}
}
