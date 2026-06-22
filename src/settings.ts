export type ClusterMode = 'none' | 'folder' | 'tags';
export type LayoutMode = 'force' | 'hierarchical' | 'circular' | 'grid' | 'timeline' | 'radial';

export interface SavedView {
	name: string;
	folderFilter: string;
	tagFilter: string;
	minConnections: number;
	maxConnections: number;
	searchQuery: string;
}

export interface GraphForgeSettings {
	enabled: boolean;
	nodeSize: number;
	linkDistance: number;
	showLabels: boolean;
	theme: 'dark' | 'light' | 'neon' | 'galaxy';
	autoRotate: boolean;
	maxNodes: number;
	connectionMode: 'links' | 'folder' | 'tags' | 'all';
	showOrphans: boolean;
	bloomIntensity: number;
	bloomRadius: number;
	bloomThreshold: number;
	animationsEnabled: boolean;
	animationSpeed: number;
	clusterMode: ClusterMode;
	savedViews: SavedView[];
	activeView: string;
	layoutMode: LayoutMode;
	focusMode: boolean;
	showKeyboardHints: boolean;
}

export const DEFAULT_SETTINGS: GraphForgeSettings = {
	enabled: true,
	nodeSize: 5,
	linkDistance: 30,
	showLabels: true,
	theme: 'dark',
	autoRotate: false,
	maxNodes: 500,
	connectionMode: 'all',
	showOrphans: true,
	bloomIntensity: 0.8,
	bloomRadius: 0.85,
	bloomThreshold: 0.6,
	animationsEnabled: true,
	animationSpeed: 1.0,
	clusterMode: 'none',
	savedViews: [],
	activeView: '',
	layoutMode: 'force',
	focusMode: false,
	showKeyboardHints: true,
};

export const THEMES = {
	dark: {
		background: 0x1a1a2e,
		nodeDefault: 0x4a9eff,
		linkDefault: 0x333366,
		text: 0xffffff,
		highlight: 0xff6b6b,
	},
	light: {
		background: 0xf0f0f0,
		nodeDefault: 0x2563eb,
		linkDefault: 0xcbd5e1,
		text: 0x1e293b,
		highlight: 0xdc2626,
	},
	neon: {
		background: 0x0a0a1a,
		nodeDefault: 0x00ff88,
		linkDefault: 0x1a3a2a,
		text: 0x00ffcc,
		highlight: 0xff00ff,
	},
	galaxy: {
		background: 0x000008,
		nodeDefault: 0x88ccff,
		linkDefault: 0x1a1a3a,
		text: 0xffffff,
		highlight: 0xff66aa,
		starColor: 0xffffff,
		nebulaColor1: 0x4400aa,
		nebulaColor2: 0x0044aa,
		nebulaColor3: 0xaa0044,
	},
};

// Predefined cluster colors for folder/tag groups
export const CLUSTER_COLORS: number[] = [
	0x4a9eff, 0xff6b6b, 0x50fa7b, 0xffd700, 0xbd93f9,
	0x8be9fd, 0xff5555, 0xffb86c, 0xff79c6, 0x6272a4,
	0x00ff88, 0xff00ff, 0x00bfff, 0xffa500, 0x7cfc00,
];
