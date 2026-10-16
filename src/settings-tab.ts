import {
	Notice,
	PluginSettingTab,
	Setting,
	type App,
	type ButtonComponent,
	type Plugin,
	type TextComponent
} from "obsidian";
import type { ReaderSettings } from "./shared/types";
import { findCityFromCoordinates } from "./salah/loader";

const DEFAULT_TRANSLATIONS = [
	{ id: "eng-mustafakhattaba", label: "The Clear Quran — Mustafa Khattab" },
	{ id: "eng-abdullahyusufal", label: "Abdullah Yusuf Ali" },
	{ id: "eng-abdelhaleem", label: "Abdel Haleem" }
];

const BUNDLED_ARABIC_EDITIONS = [
	{ id: "ara-quranuthmanihaf", label: "Uthmanic Hafs" },
	{ id: "ara-quransimple", label: "Quran Simple" }
];

const SALAH_METHODS = [
	{ id: 1, label: "University of Islamic Sciences, Karachi" },
	{ id: 2, label: "Islamic Society of North America (ISNA)" },
	{ id: 3, label: "Muslim World League" },
	{ id: 4, label: "Umm Al-Qura, Makkah" },
	{ id: 5, label: "Egyptian General Authority" }
];

export class ObsideenSettingTab extends PluginSettingTab {
	private settings: ReaderSettings;
	private salahCityDraft = "";
	private salahCountryDraft = "";
	private salahMethodDraft = 3;
	private cityInput: TextComponent | null = null;
	private countryInput: TextComponent | null = null;

	constructor(
		app: App,
		plugin: Plugin,
		private getSettings: () => ReaderSettings,
		private onChange: (settings: ReaderSettings) => Promise<void>
	) {
		super(app, plugin);
		this.settings = getSettings();
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.settings = this.getSettings();
		this.salahCityDraft = this.settings.salahCity;
		this.salahCountryDraft = this.settings.salahCountry;
		this.salahMethodDraft = this.settings.salahMethod;
		this.cityInput = null;
		this.countryInput = null;

		containerEl.createEl("h2", { text: "Obsideen Settings" });
		containerEl.createEl("p", {
			text: "Settings are grouped by feature. Choose a section below to configure the corresponding Obsideen view."
		});

		this.displayQuranSettings(containerEl);
		this.displaySalahSettings(containerEl);
		this.displayHadithSettings(containerEl);
		this.displayAdkarSettings(containerEl);
	}

	private displayQuranSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Quran Reader").setHeading();

		new Setting(containerEl)
			.setName("Primary edition")
			.setDesc("Choose an Arabic edition bundled with Obsideen.")
			.addDropdown((dropdown) => {
				for (const edition of BUNDLED_ARABIC_EDITIONS) {
					dropdown.addOption(edition.id, edition.label);
				}
				const selected = BUNDLED_ARABIC_EDITIONS.some(
					(edition) => edition.id === this.settings.primaryEdition
				)
					? this.settings.primaryEdition
					: BUNDLED_ARABIC_EDITIONS[0].id;
				return dropdown
					.setValue(selected)
					.onChange(async (value) => this.saveSettings({ primaryEdition: value }));
			});

		new Setting(containerEl)
			.setName("Default translation")
			.setDesc("Choose the translation shown in the verse-by-verse reader.")
			.addDropdown((dropdown) => {
				for (const edition of DEFAULT_TRANSLATIONS) {
					dropdown.addOption(edition.id, edition.label);
				}
				const selected = DEFAULT_TRANSLATIONS.some(
					(edition) => edition.id === this.settings.secondaryEdition
				)
					? this.settings.secondaryEdition
					: DEFAULT_TRANSLATIONS[0].id;
				return dropdown
					.setValue(selected)
					.onChange(async (value) => this.saveSettings({ secondaryEdition: value }));
			});

		new Setting(containerEl)
			.setName("Default reader mode")
			.setDesc("Choose how the Quran reader opens by default.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("qcf", "QCF layout — Arabic only")
					.addOption("translation", "Translation — Arabic + translation")
					.setValue(this.settings.readerMode)
					.onChange(async (value) =>
						this.saveSettings({ readerMode: value as "qcf" | "translation" })
					)
			);

		new Setting(containerEl)
			.setName("Insert format")
			.setDesc("How selected verses are formatted when copied or inserted into a note.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("quote", "Blockquote")
					.addOption("plain", "Plain text")
					.setValue(this.settings.insertFormat)
					.onChange(async (value) => this.saveSettings({ insertFormat: value as "quote" | "plain" }))
			);
	}

	private displaySalahSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Salah Times").setHeading();

		new Setting(containerEl)
			.setName("City")
			.setDesc("City used for daily Salah times.")
			.addText((text) => {
				this.cityInput = text;
				return text
					.setPlaceholder("e.g. London")
					.setValue(this.salahCityDraft)
					.onChange((value) => (this.salahCityDraft = value));
			});

		new Setting(containerEl)
			.setName("Country")
			.setDesc("Country paired with the city above.")
			.addText((text) => {
				this.countryInput = text;
				return text
					.setPlaceholder("e.g. United Kingdom")
					.setValue(this.salahCountryDraft)
					.onChange((value) => (this.salahCountryDraft = value));
			});

		new Setting(containerEl)
			.setName("Calculation method")
			.setDesc("Choose the calculation convention used for your prayer times.")
			.addDropdown((dropdown) => {
				for (const item of SALAH_METHODS) dropdown.addOption(String(item.id), item.label);
				return dropdown
					.setValue(String(this.salahMethodDraft))
					.onChange((value) => (this.salahMethodDraft = Number(value)));
			});

		new Setting(containerEl)
			.setName("Use current location")
			.setDesc("Ask for permission, then send coordinates to OpenStreetMap (© contributors) to find your city. Only the city and country are saved.")
			.addButton((button) => {
				button
					.setButtonText("Use my location")
					.setCta()
					.onClick(async () => this.detectSalahLocation(button));
			});

		new Setting(containerEl)
			.setName("Save Salah preferences")
			.setDesc("Apply the city, country, and calculation method entered above.")
			.addButton((button) =>
				button
					.setButtonText("Save")
					.setCta()
					.onClick(async () => this.saveSalahPreferences())
			);
	}

	private displayHadithSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Hadith Library").setHeading();
		containerEl.createEl("p", {
			text: "The Hadith Library uses its bundled collection."
		});
	}

	private displayAdkarSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Daily Adkar").setHeading();
		containerEl.createEl("p", {
			text: "Daily Adkar uses its bundled collection and does not need additional configuration."
		});
	}

	private async saveSettings(changes: Partial<ReaderSettings>): Promise<void> {
		this.settings = { ...this.settings, ...changes };
		await this.onChange(this.settings);
	}

	private async saveSalahPreferences(): Promise<void> {
		const city = this.salahCityDraft.trim();
		const country = this.salahCountryDraft.trim();
		if (!city || !country) {
			new Notice("Enter both a Salah city and country.");
			return;
		}
		try {
			await this.saveSettings({
				salahCity: city,
				salahCountry: country,
				salahMethod: this.salahMethodDraft
			});
			new Notice("Salah settings saved.");
		} catch (cause) {
			new Notice(`Could not save Salah settings: ${cause instanceof Error ? cause.message : String(cause)}`);
		}
	}

	private async detectSalahLocation(button: ButtonComponent): Promise<void> {
		if (typeof navigator === "undefined" || !navigator.geolocation) {
			new Notice("Location is unavailable here. Enter a city and country manually.");
			return;
		}

		button.setDisabled(true).setButtonText("Finding location…");
		try {
			const position = await new Promise<GeolocationPosition>((resolve, reject) => {
				navigator.geolocation.getCurrentPosition(resolve, reject, {
					enableHighAccuracy: false,
					timeout: 15_000,
					maximumAge: 5 * 60_000
				});
			});
			const location = await findCityFromCoordinates(
				position.coords.latitude,
				position.coords.longitude
			);
			this.salahCityDraft = location.city;
			this.salahCountryDraft = location.country;
			this.cityInput?.setValue(location.city);
			this.countryInput?.setValue(location.country);
			await this.saveSettings({
				salahCity: location.city,
				salahCountry: location.country,
				salahMethod: this.salahMethodDraft
			});
			new Notice(`Salah location set to ${location.city}, ${location.country}.`);
		} catch (cause) {
			new Notice(locationErrorMessage(cause));
		} finally {
			button.setDisabled(false).setButtonText("Use my location");
		}
	}
}

function locationErrorMessage(cause: unknown): string {
	if (cause && typeof cause === "object" && "code" in cause) {
		const code = Number((cause as { code: unknown }).code);
		if (code === 1) return "Location access was denied. Allow access or enter your city manually.";
		if (code === 3) return "Location lookup timed out. Try again or enter your city manually.";
		return "Your location could not be determined. Enter your city manually instead.";
	}
	return cause instanceof Error ? cause.message : "Could not look up your location.";
}
