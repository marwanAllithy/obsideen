import { Modal, type App } from "obsidian";

export class ResourceInstallerModal extends Modal {
	private statusEl: HTMLElement | null = null;
	private installButton: HTMLButtonElement | null = null;
	private busy = false;

	constructor(
		app: App,
		private readonly resourcesInstalled: boolean,
		private readonly onInstall: (onStatus: (message: string) => void) => Promise<void>,
		private readonly onInstalled: () => Promise<void>,
		private readonly onDismiss: () => void
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle("Obsideen offline resources");
		this.contentEl.empty();

		this.contentEl.createEl("p", {
			text: this.resourcesInstalled
				? "The required Quran, hadith, tafsir, and Arabic font resources are installed and verified."
				: "Obsideen needs its Quran, hadith, tafsir, and Arabic font resources before its reader tools can open."
		});
		if (!this.resourcesInstalled) {
			this.contentEl.createEl("p", {
				text: "The resource packs are downloaded from the public Obsideen GitHub release and stored with the plugin on this device. The current download is about 115 MB (195 MB unpacked); keep Obsidian open while it runs."
			});
		}

		this.statusEl = this.contentEl.createEl("p", {
			text: this.resourcesInstalled
				? "Offline resources are installed and verified for this version."
				: "The plugin stays locked until both resource packs are downloaded and verified."
		});

		if (!this.resourcesInstalled) {
			this.installButton = this.contentEl.createEl("button", {
				text: "Download and install resources"
			});
			this.installButton.classList.add("mod-cta");
			this.installButton.type = "button";
			this.installButton.addEventListener("click", () => void this.install());
		}
	}

	close(): void {
		if (this.busy) return;
		super.close();
	}

	onClose(): void {
		this.contentEl.empty();
		this.onDismiss();
	}

	private async install(): Promise<void> {
		if (this.busy || !this.statusEl || !this.installButton) return;
		this.busy = true;
		this.installButton.disabled = true;
		this.statusEl.setText("Starting the resource download… Keep Obsidian open until installation finishes.");

		try {
			await this.onInstall((message) => {
				if (this.statusEl?.isConnected) this.statusEl.setText(message);
			});
			if (this.statusEl?.isConnected) this.statusEl.setText("Resources verified. Unlocking Obsideen…");
			await this.onInstalled();
			this.busy = false;
			this.close();
		} catch (error) {
			this.busy = false;
			if (this.statusEl?.isConnected) {
				const message = error instanceof Error ? error.message : String(error);
				this.statusEl.setText(`Installation failed: ${message} You can retry the download.`);
			}
			if (this.installButton?.isConnected) this.installButton.disabled = false;
		}
	}
}
