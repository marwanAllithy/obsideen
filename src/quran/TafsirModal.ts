import { Modal, type App } from "obsidian";
import type { ChapterInfo, VerseInfo } from "../shared/types";
import {
	DEFAULT_TAFSIR_SLUG,
	getPreferredTafsir,
	getTafsirLanguages,
	loadTafsir,
	loadTafsirEditions,
	type TafsirEdition,
	type TafsirLanguageOption
} from "./tafsir-loader";

export class TafsirModal extends Modal {
	private language: string;
	private tafsirSlug: string;
	private editions: TafsirEdition[] = [];
	private languageSelectEl: HTMLSelectElement | null = null;
	private tafsirSelectEl: HTMLSelectElement | null = null;
	private tafsirContentEl: HTMLDivElement | null = null;
	private requestId = 0;
	private catalogRequestId = 0;

	constructor(
		app: App,
		private chapter: ChapterInfo,
		private verse: VerseInfo,
		private verseText: string,
		private manifestDir: string,
		language: string,
		tafsirSlug: string,
		private onSelectionChange: (language: string, tafsirSlug: string) => void
	) {
		super(app);
		this.language = language || "arabic";
		this.tafsirSlug = tafsirSlug || DEFAULT_TAFSIR_SLUG;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.modalEl.addClass("obsideen-tafsir-modal");
		this.setTitle(this.getTitle());

		const selection = contentEl.createDiv({ cls: "obsideen-tafsir-selectors" });
		const languageSetting = selection.createDiv({ cls: "obsideen-tafsir-language" });
		languageSetting.createEl("label", { text: "Language" });
		this.languageSelectEl = languageSetting.createEl("select", {
			attr: { "aria-label": "Tafsir language", disabled: "true" }
		});
		this.languageSelectEl.createEl("option", { text: "Loading languages…" });
		this.languageSelectEl.addEventListener("change", () => this.handleLanguageChange());

		const tafsirSetting = selection.createDiv({ cls: "obsideen-tafsir-edition" });
		tafsirSetting.createEl("label", { text: "Tafsir" });
		this.tafsirSelectEl = tafsirSetting.createEl("select", {
			attr: { "aria-label": "Tafsir edition", disabled: "true" }
		});
		this.tafsirSelectEl.createEl("option", { text: "Loading tafsirs…" });
		this.tafsirSelectEl.addEventListener("change", () => this.handleTafsirChange());

		const verseBlock = contentEl.createDiv({ cls: "obsideen-tafsir-verse" });
		verseBlock.createEl("div", {
			cls: "obsideen-tafsir-reference",
			text: `${this.chapter.arabicname} · ${this.chapter.chapter}:${this.verse.verse}`
		});
		verseBlock.createEl("div", {
			cls: "obsideen-tafsir-verse-text",
			text: this.verseText || "Quran text unavailable."
		});
		this.tafsirContentEl = contentEl.createDiv({ cls: "obsideen-tafsir-content" });
		this.tafsirContentEl.createEl("p", {
			cls: "obsideen-tafsir-loading",
			text: "Loading tafsir catalog…"
		});
		void this.loadCatalog();
	}

	onClose(): void {
		this.requestId++;
		this.catalogRequestId++;
		this.contentEl.empty();
		this.languageSelectEl = null;
		this.tafsirSelectEl = null;
		this.tafsirContentEl = null;
	}

	private getTitle(): string {
		const selected = this.editions.find((edition) => edition.slug === this.tafsirSlug);
		const tafsirName = selected?.name ?? "Tafsir";
		return `${tafsirName} · ${this.chapter.englishname} ${this.chapter.chapter}:${this.verse.verse}`;
	}

	private async loadCatalog(): Promise<void> {
		const catalogRequestId = ++this.catalogRequestId;
		const editions = await loadTafsirEditions(this.app, this.manifestDir);
		if (catalogRequestId !== this.catalogRequestId || !this.tafsirContentEl) return;

		this.editions = editions;
		const languages = getTafsirLanguages(editions);
		if (languages.length === 0 || !this.languageSelectEl || !this.tafsirSelectEl) {
			this.setMessage("No tafsir editions are available.");
			return;
		}

		const previousLanguage = this.language;
		const previousSlug = this.tafsirSlug;
		this.populateLanguages(languages);
		if (!languages.some((language) => language.id === this.language)) {
			this.language = languages.some((language) => language.id === "arabic")
				? "arabic"
				: languages[0].id;
		}
		this.languageSelectEl.value = this.language;
		this.languageSelectEl.disabled = false;
		this.populateTafsirs();
		this.tafsirSelectEl.disabled = false;
		if (previousLanguage !== this.language || previousSlug !== this.tafsirSlug) {
			this.onSelectionChange(this.language, this.tafsirSlug);
		}
		void this.loadContent();
	}

	private populateLanguages(languages: TafsirLanguageOption[]): void {
		if (!this.languageSelectEl) return;
		this.languageSelectEl.empty();
		for (const language of languages) {
			this.languageSelectEl.createEl("option", {
				value: language.id,
				text: language.label
			});
		}
	}

	private populateTafsirs(): void {
		if (!this.tafsirSelectEl) return;
		this.tafsirSelectEl.empty();
		const languageEditions = this.editions.filter((edition) => edition.language === this.language);
		for (const edition of languageEditions) {
			const label = edition.author ? `${edition.name} — ${edition.author}` : edition.name;
			this.tafsirSelectEl.createEl("option", { value: edition.slug, text: label });
		}

		const selected = getPreferredTafsir(this.editions, this.language, this.tafsirSlug);
		if (!selected) return;
		this.tafsirSlug = selected.slug;
		this.tafsirSelectEl.value = selected.slug;
		this.setTitle(this.getTitle());
		this.updateDirection();
	}

	private handleLanguageChange(): void {
		if (!this.languageSelectEl) return;
		this.language = this.languageSelectEl.value;
		this.populateTafsirs();
		this.onSelectionChange(this.language, this.tafsirSlug);
		void this.loadContent();
	}

	private handleTafsirChange(): void {
		if (!this.tafsirSelectEl) return;
		this.tafsirSlug = this.tafsirSelectEl.value;
		this.setTitle(this.getTitle());
		this.updateDirection();
		this.onSelectionChange(this.language, this.tafsirSlug);
		void this.loadContent();
	}

	private updateDirection(): void {
		const direction = getTafsirLanguages(this.editions).find(
			(language) => language.id === this.language
		)?.direction;
		if (direction) this.tafsirContentEl?.setAttr("dir", direction);
	}

	private setMessage(message: string): void {
		if (!this.tafsirContentEl) return;
		this.tafsirContentEl.empty();
		this.tafsirContentEl.createEl("p", {
			cls: "obsideen-tafsir-unavailable",
			text: message
		});
	}

	private async loadContent(): Promise<void> {
		const contentEl = this.tafsirContentEl;
		if (!contentEl || !this.tafsirSlug) return;
		const requestId = ++this.requestId;
		contentEl.empty();
		this.updateDirection();
		contentEl.createEl("p", { cls: "obsideen-tafsir-loading", text: "Loading tafsir…" });

		const text = await loadTafsir(
			this.app,
			this.manifestDir,
			this.tafsirSlug,
			this.chapter.chapter,
			this.verse.verse
		);
		if (requestId !== this.requestId || !this.tafsirContentEl) return;

		contentEl.empty();
		if (!text) {
			contentEl.createEl("p", {
				cls: "obsideen-tafsir-unavailable",
				text: "Tafsir could not be loaded from the bundled data."
			});
			return;
		}
		this.renderTafsirText(contentEl, text);
	}

	private renderTafsirText(container: HTMLDivElement, text: string): void {
		container.addClass("obsideen-tafsir-text");
		const quotedVersePattern = /(\{[^{}]+\})/g;
		let lastIndex = 0;
		let match: RegExpExecArray | null;
		while ((match = quotedVersePattern.exec(text)) !== null) {
			if (match.index > lastIndex) {
				container.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
			}
			container.createEl("span", {
				cls: "obsideen-tafsir-quran-quote",
				text: match[0]
			});
			lastIndex = match.index + match[0].length;
		}
		if (lastIndex < text.length) {
			container.appendChild(document.createTextNode(text.slice(lastIndex)));
		}
	}
}
