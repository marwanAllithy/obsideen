import { ItemView, type WorkspaceLeaf } from "obsidian";
import Dashboard from "./components/Dashboard.svelte";

export const VIEW_TYPE_OBSIDEEN_DASHBOARD = "obsideen-dashboard";

export type DashboardAction = "quran" | "search" | "hadith" | "adkar" | "salah" | "youtube";

export function createObsideenDashboardView(
	leaf: WorkspaceLeaf,
	onNavigate: (action: DashboardAction) => void
): ObsideenDashboardView {
	return new ObsideenDashboardView(leaf, onNavigate);
}

export class ObsideenDashboardView extends ItemView {
	private component: Dashboard | null = null;

	constructor(leaf: WorkspaceLeaf, private onNavigate: (action: DashboardAction) => void) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_OBSIDEEN_DASHBOARD;
	}

	getDisplayText(): string {
		return "Obsideen Dashboard";
	}

	getIcon(): string {
		return "home";
	}

	async onOpen(): Promise<void> {
		this.containerEl.empty();
		this.component = new Dashboard({
			target: this.containerEl,
			props: { onNavigate: this.onNavigate }
		});
	}

	onClose(): Promise<void> {
		this.component?.$destroy();
		this.component = null;
		return Promise.resolve();
	}
}
