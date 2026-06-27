import { Plugin, WorkspaceLeaf, Notice, addIcon } from 'obsidian';
import { GraphForgeView, GRAPHFORGE_VIEW_TYPE } from './GraphForgeView';
import { GraphForgeSettings, DEFAULT_SETTINGS } from './settings';

const GRAPHFORGE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><line x1="9.5" y1="10" x2="6.5" y2="6.5"/><line x1="14.5" y1="10" x2="17.5" y2="6.5"/><line x1="9.5" y1="14" x2="6.5" y2="17.5"/><line x1="14.5" y1="14" x2="17.5" y2="17.5"/></svg>`;

export default class GraphForgePlugin extends Plugin {
	settings!: GraphForgeSettings;

	async onload() {
		await this.loadSettings();

		// Register icon
		addIcon('graphforge', GRAPHFORGE_ICON);

		// Register view
		this.registerView(
			GRAPHFORGE_VIEW_TYPE,
			(leaf) => new GraphForgeView(
				leaf,
				this.settings,
				this.app.vault,
				this.app.metadataCache
			)
		);

		// Add ribbon icon
		this.addRibbonIcon('graphforge', 'GraphForge', () => {
			this.activateView();
		});

		// Add commands
		this.addCommand({
			id: 'open-graphforge',
			name: 'Open GraphForge',
			callback: () => this.activateView(),
		});

		this.addCommand({
			id: 'suggest-connections',
			name: 'Suggest Connections',
			callback: () => {
				this.activateView();
				new Notice('Use the 💡 button in the GraphForge toolbar to see suggestions');
			},
		});

		// Settings tab
		this.addSettingTab(new GraphForgeSettingTab(this.app, this));
	}

	onunload() {
		// No need to detach leaves; just clean up resources if any.
		// (GraphForgeView.onClose already disposes of WebGL resources)
	}

	async activateView() {
		const { workspace } = this.app;
		let leaf: WorkspaceLeaf | null = null;

		const leaves = workspace.getLeavesOfType(GRAPHFORGE_VIEW_TYPE);
		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({ type: GRAPHFORGE_VIEW_TYPE, active: true });
			}
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

import { App, PluginSettingTab, Setting } from 'obsidian';

class GraphForgeSettingTab extends PluginSettingTab {
	plugin: GraphForgePlugin;

	constructor(app: App, plugin: GraphForgePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Title using Setting API
		new Setting(containerEl)
			.setName('GraphForge Settings')
			.setDesc('Configure the 3D knowledge graph visualization');

		new Setting(containerEl)
			.setName('Node Size')
			.setDesc('Base size of nodes in the graph')
			.addSlider(s => s
				.setLimits(1, 15, 0.5)
				.setValue(this.plugin.settings.nodeSize)
				.onChange(async (v) => {
					this.plugin.settings.nodeSize = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Show Labels')
			.setDesc('Display note names on nodes')
			.addToggle(t => t
				.setValue(this.plugin.settings.showLabels)
				.onChange(async (v) => {
					this.plugin.settings.showLabels = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Theme')
			.setDesc('Visual theme for the graph')
			.addDropdown(d => d
				.addOption('dark', 'Dark')
				.addOption('light', 'Light')
				.addOption('neon', 'Neon')
				.addOption('galaxy', 'Galaxy')
				.setValue(this.plugin.settings.theme)
				.onChange(async (v) => {
					this.plugin.settings.theme = v as 'dark' | 'light' | 'neon' | 'galaxy';
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Auto Rotate')
			.setDesc('Automatically rotate the camera')
			.addToggle(t => t
				.setValue(this.plugin.settings.autoRotate)
				.onChange(async (v) => {
					this.plugin.settings.autoRotate = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Max Nodes')
			.setDesc('Maximum number of nodes to display')
			.addSlider(s => s
				.setLimits(50, 2000, 50)
				.setValue(this.plugin.settings.maxNodes)
				.onChange(async (v) => {
					this.plugin.settings.maxNodes = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Connection Mode')
			.setDesc('How to connect nodes in the graph')
			.addDropdown(d => d
				.addOption('links', 'Wikilinks only')
				.addOption('folder', 'Same folder')
				.addOption('tags', 'Shared tags')
				.addOption('all', 'All connections')
				.setValue(this.plugin.settings.connectionMode)
				.onChange(async (v) => {
					this.plugin.settings.connectionMode = v as 'links' | 'folder' | 'tags' | 'all';
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Show Orphans')
			.setDesc('Show nodes with no connections')
			.addToggle(t => t
				.setValue(this.plugin.settings.showOrphans)
				.onChange(async (v) => {
					this.plugin.settings.showOrphans = v;
					await this.plugin.saveSettings();
				})
			);

		// --- Layout Section ---
		new Setting(containerEl)
			.setName('Layout')
			.setDesc('Graph layout settings');

		new Setting(containerEl)
			.setName('Default Layout')
			.setDesc('Default layout algorithm for the graph')
			.addDropdown(d => d
				.addOption('force', 'Force-Directed')
				.addOption('hierarchical', 'Hierarchical')
				.addOption('circular', 'Circular')
				.addOption('grid', 'Grid')
				.addOption('timeline', 'Timeline')
				.addOption('radial', 'Radial')
				.addOption('solar', 'Solar System')
				.addOption('galaxy', 'Galaxy')
				.setValue(this.plugin.settings.layoutMode)
				.onChange(async (v) => {
					this.plugin.settings.layoutMode = v as 'force' | 'hierarchical' | 'circular' | 'grid' | 'timeline' | 'radial' | 'solar' | 'galaxy';
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Show Keyboard Hints')
			.setDesc('Show keyboard shortcut hints when opening the graph')
			.addToggle(t => t
				.setValue(this.plugin.settings.showKeyboardHints)
				.onChange(async (v) => {
					this.plugin.settings.showKeyboardHints = v;
					await this.plugin.saveSettings();
				})
			);

		// --- Clustering Section ---
		new Setting(containerEl)
			.setName('Clustering')
			.setDesc('Node clustering settings');

		new Setting(containerEl)
			.setName('Cluster Mode')
			.setDesc('How to group nodes into visual clusters')
			.addDropdown(d => d
				.addOption('none', 'None')
				.addOption('folder', 'By Folder')
				.addOption('tags', 'By Tags')
				.setValue(this.plugin.settings.clusterMode)
				.onChange(async (v) => {
					this.plugin.settings.clusterMode = v as 'none' | 'folder' | 'tags';
					await this.plugin.saveSettings();
				})
			);

		// --- Saved Views Section ---
		new Setting(containerEl)
			.setName('Saved Views')
			.setDesc('Manage saved graph views');

		new Setting(containerEl)
			.setName('Active View')
			.setDesc('Currently active saved view (set from the graph toolbar)')
			.addDropdown(d => {
				d.addOption('', '— None —');
				this.plugin.settings.savedViews.forEach(v => {
					d.addOption(v.name, v.name);
				});
				d.setValue(this.plugin.settings.activeView);
				d.onChange(async (v) => {
					this.plugin.settings.activeView = v;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName('Manage Saved Views')
			.setDesc(`${this.plugin.settings.savedViews.length} saved view(s)`)
			.addButton(b => {
				b.setButtonText('Clear All Views');
				b.setWarning();
				b.onClick(async () => {
					this.plugin.settings.savedViews = [];
					this.plugin.settings.activeView = '';
					await this.plugin.saveSettings();
					this.display();
				});
			});

		// List saved views with details
		if (this.plugin.settings.savedViews.length > 0) {
			const viewsList = containerEl.createDiv();
			viewsList.style.cssText = 'margin-top:8px;border:1px solid #333;border-radius:6px;overflow:hidden';

			this.plugin.settings.savedViews.forEach((view, idx) => {
				const row = viewsList.createDiv();
				row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border-bottom:1px solid #222';

				const info = row.createDiv();
				info.createDiv({ text: view.name }).style.cssText = 'font-weight:bold;font-size:12px';
				const details: string[] = [];
				if (view.folderFilter) details.push(`Folder: ${view.folderFilter}`);
				if (view.tagFilter) details.push(`Tag: ${view.tagFilter}`);
				if (view.minConnections > 0) details.push(`Min conn: ${view.minConnections}`);
				if (view.maxConnections < 99999) details.push(`Max conn: ${view.maxConnections}`);
				if (view.searchQuery) details.push(`Search: "${view.searchQuery}"`);
				info.createDiv({ text: details.join(' | ') || 'No filters' }).style.cssText = 'font-size:10px;color:#888';

				const delBtn = row.createEl('button', { text: '✕' });
				delBtn.style.cssText = 'padding:2px 6px;border:1px solid #666;background:transparent;color:#ff6b6b;border-radius:3px;cursor:pointer;font-size:10px';
				delBtn.onclick = async () => {
					this.plugin.settings.savedViews.splice(idx, 1);
					if (this.plugin.settings.activeView === view.name) {
						this.plugin.settings.activeView = '';
					}
					await this.plugin.saveSettings();
					this.display();
				};
			});
		}

		// --- Visual Effects Section ---
		new Setting(containerEl)
			.setName('Visual Effects')
			.setDesc('Visual effects settings');

		new Setting(containerEl)
			.setName('Animations')
			.setDesc('Enable node entry and exit animations')
			.addToggle(t => t
				.setValue(this.plugin.settings.animationsEnabled)
				.onChange(async (v) => {
					this.plugin.settings.animationsEnabled = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Animation Speed')
			.setDesc('Speed multiplier for node animations (higher = faster)')
			.addSlider(s => s
				.setLimits(0.25, 3.0, 0.25)
				.setValue(this.plugin.settings.animationSpeed)
				.setDynamicTooltip()
				.onChange(async (v) => {
					this.plugin.settings.animationSpeed = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Bloom Intensity')
			.setDesc('Intensity of the glow/bloom post-processing effect')
			.addSlider(s => s
				.setLimits(0, 3.0, 0.1)
				.setValue(this.plugin.settings.bloomIntensity)
				.setDynamicTooltip()
				.onChange(async (v) => {
					this.plugin.settings.bloomIntensity = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Bloom Radius')
			.setDesc('How far the bloom glow extends from bright objects')
			.addSlider(s => s
				.setLimits(0, 1.0, 0.05)
				.setValue(this.plugin.settings.bloomRadius)
				.setDynamicTooltip()
				.onChange(async (v) => {
					this.plugin.settings.bloomRadius = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Bloom Threshold')
			.setDesc('Luminance threshold — lower values make more things glow')
			.addSlider(s => s
				.setLimits(0, 1.0, 0.05)
				.setValue(this.plugin.settings.bloomThreshold)
				.setDynamicTooltip()
				.onChange(async (v) => {
					this.plugin.settings.bloomThreshold = v;
					await this.plugin.saveSettings();
				})
			);
	}
}