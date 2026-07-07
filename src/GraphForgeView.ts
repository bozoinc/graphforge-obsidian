import { ItemView, WorkspaceLeaf, TFile, MetadataCache, Vault, Notice, Menu, Modal, App } from 'obsidian';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { EffectComposer, RenderPass, BloomEffect, EffectPass } from 'postprocessing';
import { GraphForgeSettings, THEMES, ClusterMode } from './settings';
import { computeAnalytics, GraphAnalytics } from './analytics';
import { findSuggestedConnections, SuggestedConnection } from './suggestions';
import { runClassicalPhysics, runEinsteinPhysics, runNexusPhysics, getDefaultForceParams } from './physics';

export interface GraphNode {
	file: TFile; mesh: THREE.Mesh; label: CSS2DObject; links: string[];
	x: number; y: number; z: number; vx: number; vy: number; vz: number;
	degree: number; entryProgress: number; entryDelay: number; entryStartTime: number;
	exitProgress: number; isExiting: boolean; baseEmissiveIntensity: number;
	currentEmissiveIntensity: number; targetEmissiveIntensity: number; targetScale: THREE.Vector3;
}

export const GRAPHFORGE_VIEW_TYPE = 'graphforge-view';

export class GraphForgeView extends ItemView {
	// Core
	private renderer!: THREE.WebGLRenderer; private labelRenderer!: CSS2DRenderer;
	private scene!: THREE.Scene; private camera!: THREE.PerspectiveCamera;
	private controls!: OrbitControls; private composer!: EffectComposer;
	private bloomEffect!: BloomEffect; private bloomPass!: EffectPass;
	private nodes: Map<string, GraphNode> = new Map(); private links: THREE.Line[] = [];
	private animationId: number | null = null; private settings: GraphForgeSettings;
	private vault: Vault; private metadataCache: MetadataCache; private containerEl2: HTMLElement;
	private raycaster = new THREE.Raycaster(); private mouse = new THREE.Vector2();
	private hoveredNode: GraphNode | null = null; private selectedNode: GraphNode | null = null;
	private searchQuery = ''; private showLabels = true; private layoutRunning = true;
	private nodeCount = 0; private loadStartTime = 0;
	// Clusters
	private clusterMode: ClusterMode = 'none';
	private clusters: Map<string, { nodes: GraphNode[]; color: number; hull: THREE.Line | null; collapsed: boolean }> = new Map();
	// UI panels
	private analyticsPanelOpen = false; private analyticsData: GraphAnalytics | null = null;
	private analyticsPanelEl: HTMLElement | null = null; private filterPanelEl: HTMLElement | null = null;
	private currentFolderFilter = ''; private currentTagFilter = ''; private currentMinConnections = 0;
	private currentMaxConnections = 999; private viewsDropdown: HTMLSelectElement | null = null;
	// Suggestions
	private suggestionLines: THREE.Line[] = []; private processedSuggestions = new Set<string>();
	private suggestionsModalOpen = false;
	// Focus & preview
	private focusMode = false; private hoverPreviewEl: HTMLElement | null = null;
	private hoverTimeout: number | null = null;
	// Layout
	private currentLayout: string = 'force';
	// Raycasting cache
	private _nodeMeshes: THREE.Mesh[] | null = null;

	// Physics engine state
	private physicsMode: 'classical' | 'einstein' | 'nexus' = 'classical';
	// Tunable force parameters (shared across all physics engines)
	private forceParams = getDefaultForceParams();
	private forcePanelOpen = false; private forcePanelEl: HTMLElement | null = null;
	private temporalMode = false; private temporalPanelEl: HTMLElement | null = null;
	private temporalSlider: HTMLInputElement | null = null; private temporalPlaying = false;

	constructor(leaf: WorkspaceLeaf, settings: GraphForgeSettings, vault: Vault, metadataCache: MetadataCache) {
		super(leaf); this.settings = settings; this.vault = vault; this.metadataCache = metadataCache;
		const child = this.containerEl.children[1];
		this.containerEl2 = child ? (child as HTMLElement) : this.containerEl.createDiv();
		this.showLabels = settings.showLabels; this.clusterMode = settings.clusterMode;
	}

	getViewType(): string { return GRAPHFORGE_VIEW_TYPE; }
	getDisplayText(): string { return 'Graphforge'; }

	// ═══════════════════════════════════════════════════════════════════════
	// INIT
	// ═══════════════════════════════════════════════════════════════════════

	async onOpen() {
		try {
			this.containerEl2.empty(); this.containerEl2.addClass('graphforge-container');
			// Show loading spinner using CSS classes
			const loadingEl = this.containerEl2.createDiv({ cls: 'gf-loading-overlay' });
			loadingEl.innerHTML = `<div class="gf-spinner"></div><div class="gf-loading-text">Loading Graph...</div><div class="gf-loading-status" id="gf-loading-status">Initializing</div>`;

			const w = this.containerEl2.clientWidth || 800; const h = this.containerEl2.clientHeight || 600;
			const theme = THEMES[this.settings.theme]; this.loadStartTime = performance.now();
			this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(theme.background);
			if (this.settings.theme === 'galaxy') this.addGalaxyEffects();
			this.camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 5000); this.camera.position.set(0, 30, 60);
			this.renderer = new THREE.WebGLRenderer({ antialias: true }); this.renderer.setSize(w, h);
			this.renderer.setPixelRatio(window.devicePixelRatio); this.containerEl2.appendChild(this.renderer.domElement);
			this.labelRenderer = new CSS2DRenderer(); this.labelRenderer.setSize(w, h);
			this.labelRenderer.domElement.classList.add('label-renderer');
			this.containerEl2.appendChild(this.labelRenderer.domElement);
			this.composer = new EffectComposer(this.renderer, { depthBuffer: true, stencilBuffer: false });
			this.composer.addPass(new RenderPass(this.scene, this.camera));
			this.bloomEffect = new BloomEffect({ intensity: this.settings.bloomIntensity, luminanceThreshold: this.settings.bloomThreshold, radius: this.settings.bloomRadius });
			this.bloomPass = new EffectPass(this.camera, this.bloomEffect); this.composer.addPass(this.bloomPass);
			this.controls = new OrbitControls(this.camera, this.renderer.domElement);
			this.controls.enableDamping = true; this.controls.dampingFactor = 0.05;
			this.controls.autoRotate = this.settings.autoRotate; this.controls.autoRotateSpeed = 0.3;
			this.controls.minDistance = 5; this.controls.maxDistance = 1000;
			this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
			const dl = new THREE.DirectionalLight(0xffffff, 0.8); dl.position.set(50, 50, 50); this.scene.add(dl);
			const pl = new THREE.PointLight(theme.nodeDefault, 0.6, 150); pl.position.set(0, 30, 0); this.scene.add(pl);
			this.scene.add(new THREE.GridHelper(100, 20, 0x333366, 0x222244));

			// Update loading status
			const statusEl = loadingEl.querySelector('#gf-loading-status');
			if (statusEl) statusEl.textContent = 'Building graph...';
			this.buildGraph();

			if (statusEl) statusEl.textContent = 'Finalizing...';
			this.setupMouseHandlers(); this.setupToolbar(); this.animate();

			// Remove loading spinner with fade
			loadingEl.classList.add('gf-fade-out');
			setTimeout(() => { loadingEl.remove(); }, 300);

			this.registerEvent(this.app.workspace.on('resize', () => {
				const w = this.containerEl2.clientWidth || 800; const h = this.containerEl2.clientHeight || 600;
				this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
				this.renderer.setSize(w, h); this.labelRenderer.setSize(w, h); this.composer.setSize(w, h);
			}));
			new Notice(`GraphForge: ${this.nodes.size} nodes loaded`);
		} catch (e) {
			console.error('GraphForge: Failed to initialize view', e);
			new Notice('❌ GraphForge failed to load: ' + (e as Error).message);
		}
	}

	// ═══════════════════════════════════════════════════════════════════════
	// GRAPH BUILD
	// ═══════════════════════════════════════════════════════════════════════

	buildGraph() {
		const files = this.vault.getMarkdownFiles(); this.nodeCount = Math.min(files.length, this.settings.maxNodes);
		const theme = THEMES[this.settings.theme]; let staggerDelay = 0;
		for (let i = 0; i < this.nodeCount; i++) {
			const file = files[i]; if (!file) continue;
			const cache = this.metadataCache.getFileCache(file);
			const linkPaths = (cache?.links || []).map((l: any) => l.link);
			const extraLinks: string[] = [];
			if (this.settings.connectionMode === 'folder' || this.settings.connectionMode === 'all') {
				const folder = file.parent?.path || '';
				for (const f of files) { if (f.path !== file.path && f.parent?.path === folder) extraLinks.push(f.path.replace('.md', '')); }
			}
			if (this.settings.connectionMode === 'tags' || this.settings.connectionMode === 'all') {
				const ft = new Set<string>(); const fm = cache?.frontmatter?.tags || [];
				if (Array.isArray(fm)) fm.forEach((t: string) => ft.add(t.toLowerCase()));
				(cache?.tags || []).forEach((t: any) => ft.add(t.tag.toLowerCase()));
				for (const f of files) {
					if (f.path === file.path) continue; const fc = this.metadataCache.getFileCache(f); const fTags = new Set<string>();
					const fFm = fc?.frontmatter?.tags || []; if (Array.isArray(fFm)) fFm.forEach((t: string) => fTags.add(t.toLowerCase()));
					(fc?.tags || []).forEach((t: any) => fTags.add(t.tag.toLowerCase()));
					for (const tag of ft) { if (fTags.has(tag)) { extraLinks.push(f.path.replace('.md', '')); break; } }
				}
			}
			const allLinks = [...new Set([...linkPaths, ...extraLinks])]; const degree = allLinks.length;
			if (!this.settings.showOrphans && degree === 0) continue;
			const phi = Math.acos(-1 + (2 * i) / this.nodeCount); const theta = Math.sqrt(this.nodeCount * Math.PI) * phi;
			const radius = 25 + Math.min(degree, 20) * 1.5;
			const x = radius * Math.cos(theta) * Math.sin(phi); const y = radius * Math.sin(theta) * Math.sin(phi); const z = radius * Math.cos(phi);
			const color = this.getNodeColor(file, theme); const size = Math.min(this.settings.nodeSize + degree * 0.2, 12);
			const geo = new THREE.SphereGeometry(size, 16, 16);
			const mat = new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.15, shininess: 80, transparent: true, opacity: 0.9 });
			const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z); mesh.userData = { file };
			const labelDiv = document.createElement('div'); 
			labelDiv.className = 'graphforge-label'; 
			labelDiv.textContent = file.basename;
			if (!this.showLabels) labelDiv.style.opacity = '0';
			const label = new CSS2DObject(labelDiv); label.position.set(0, size + 2, 0); mesh.add(label);
			this.scene.add(mesh);
			this.nodes.set(file.path, { file, mesh, label, links: allLinks, x, y, z, vx: 0, vy: 0, vz: 0, degree, entryProgress: 0, entryDelay: staggerDelay, entryStartTime: this.loadStartTime, exitProgress: 0, isExiting: false, baseEmissiveIntensity: 0.15, currentEmissiveIntensity: 0.15, targetEmissiveIntensity: 0.15, targetScale: new THREE.Vector3(1, 1, 1) });
			staggerDelay += 30;
		}
		this.nodes.forEach(node => { node.links.forEach(lp => { const t = this.nodes.get(lp + '.md') || this.nodes.get(lp); if (t) { const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(node.x, node.y, node.z), new THREE.Vector3(t.x, t.y, t.z)]); const m = new THREE.LineBasicMaterial({ color: THEMES[this.settings.theme].linkDefault, transparent: true, opacity: 0.2 }); const l = new THREE.Line(g, m); l.userData = { from: node.file.path, to: t.file.path }; this.scene.add(l); this.links.push(l); } }); });
		this._nodeMeshes = null; // Invalidate raycast cache
	}

	getNodeColor(file: TFile, theme: typeof THEMES.dark): number {
		const f = file.parent?.path || '';
		if (f.includes('Projects') || f.includes('02_Projects')) return 0x4a9eff;
		if (f.includes('Technical')) return 0xff6b6b;
		if (f.includes('People')) return 0x50fa7b;
		if (f.includes('Decisions')) return 0xffd700;
		if (f.includes('Sessions')) return 0xbd93f9;
		if (f.includes('Daily') || f.includes('06_Calendar')) return 0x8be9fd;
		if (f.includes('Templates') || f.includes('00_Templates')) return 0xff5555;
		if (f.includes('Chief')) return 0xffd700;
		if (f.includes('Contacts')) return 0x50fa7b;
		if (f.includes('Portfolios')) return 0xff79c6;
		if (f.includes('Hermes-State')) return 0x6272a4;
		if (f.includes('Inbox') || f.includes('01_Inbox')) return 0xffb86c;
		if (f.includes('Resources') || f.includes('03_Resources')) return 0x50fa7b;
		if (f.includes('Zettelkasten') || f.includes('04_Zettelkasten')) return 0x8be9fd;
		if (f.includes('Archive') || f.includes('99_Archive')) return 0x6272a4;
		return theme.nodeDefault;
	}

	// ═══════════════════════════════════════════════════════════════════════
	// GALAXY THEME
	// ═══════════════════════════════════════════════════════════════════════

	private addGalaxyEffects() {
		const n = 2000; const pos = new Float32Array(n * 3); const col = new Float32Array(n * 3);
		for (let i = 0; i < n; i++) { const r = 200 + Math.random() * 800; const th = Math.random() * Math.PI * 2; const ph = Math.acos(2 * Math.random() - 1); pos[i*3] = r*Math.sin(ph)*Math.cos(th); pos[i*3+1] = r*Math.sin(ph)*Math.sin(th); pos[i*3+2] = r*Math.cos(ph); const t = Math.random(); if (t<0.7) { col[i*3]=1; col[i*3+1]=1; col[i*3+2]=1; } else if (t<0.85) { col[i*3]=0.8; col[i*3+1]=0.9; col[i*3+2]=1; } else { col[i*3]=1; col[i*3+1]=0.95; col[i*3+2]=0.8; } }
		const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
		this.scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.5, vertexColors: true, transparent: true, opacity: 0.8, sizeAttenuation: true })));
		[0x4400aa, 0x0044aa, 0xaa0044].forEach((c, i) => { const s = new THREE.Mesh(new THREE.SphereGeometry(80+i*30,32,32), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.03, side: THREE.BackSide, depthWrite: false })); s.position.set((Math.random()-0.5)*100, (Math.random()-0.5)*100, (Math.random()-0.5)*100-50); this.scene.add(s); });
		if (this.bloomEffect) this.bloomEffect.intensity = 1.5;
	}

	// ═══════════════════════════════════════════════════════════════════════
	// ANIMATION
	// ═══════════════════════════════════════════════════════════════════════

	animate() {
		this.animationId = requestAnimationFrame(() => this.animate());
		const now = performance.now();
		if (this.layoutRunning && this.currentLayout === 'force') this.runForceLayout();
		this.nodes.forEach(n => {
			const mat = n.mesh.material as THREE.MeshPhongMaterial;
			const t = Math.min((now - n.entryStartTime - n.entryDelay) / 1000, 1);
			if (t > 0 && t < 1) { n.entryProgress = 1 - Math.pow(1 - t, 3); n.mesh.scale.setScalar(n.entryProgress); mat.opacity = 0.3 + 0.6 * n.entryProgress; }
			else if (t >= 1) { n.entryProgress = 1; n.mesh.scale.copy(n.targetScale); mat.opacity = 0.9; }
			if (n.isExiting) { n.exitProgress = Math.min(n.exitProgress + 0.03, 1); n.mesh.scale.setScalar(1 - n.exitProgress); mat.opacity = 0.9 * (1 - n.exitProgress); if (n.exitProgress >= 1) { n.mesh.visible = false; n.isExiting = false; n.exitProgress = 0; } }
			if (this.focusMode && this.hoveredNode) { const c = n.file.path === this.hoveredNode.file.path || this.hoveredNode.links.some(lp => lp === n.file.path.replace('.md', '') || lp + '.md' === n.file.path); mat.opacity = c ? 0.9 : 0.1; n.mesh.scale.setScalar(c ? 1 : 0.5); }
		});
		const t = now * 0.001; this.nodes.forEach(n => { n.mesh.position.y = n.y + Math.sin(t + n.x * 0.1) * 0.2; });
		this.controls.update(); this.composer.render(0.016); this.labelRenderer.render(this.scene, this.camera);
	}

		runForceLayout() {
			switch (this.physicsMode) {
				case 'einstein': runEinsteinPhysics(Array.from(this.nodes.values()), this.forceParams); break;
				case 'nexus': runNexusPhysics(Array.from(this.nodes.values()), this.forceParams); break;
				default: runClassicalPhysics(Array.from(this.nodes.values()), this.forceParams); break;
			}
		// Sync mesh positions back
		this.nodes.forEach(n => { n.mesh.position.set(n.x, n.y, n.z); });
		this.updateLinkPositions();
	}


	updateLinkPositions() { this.links.forEach(l => { const u = l.userData, a = this.nodes.get(u.from), b = this.nodes.get(u.to); if (a && b) { const p = l.geometry.attributes.position; if (p) { (p.array as Float32Array)[0]=a.x; (p.array as Float32Array)[1]=a.y; (p.array as Float32Array)[2]=a.z; (p.array as Float32Array)[3]=b.x; (p.array as Float32Array)[4]=b.y; (p.array as Float32Array)[5]=b.z; p.needsUpdate=true; } } }); }

	// ═══════════════════════════════════════════════════════════════════════
	// MOUSE HANDLERS
	// ═══════════════════════════════════════════════════════════════════════

	setupMouseHandlers() {
		const canvas = this.renderer.domElement;
		canvas.addEventListener('mousemove', (e) => { const r = canvas.getBoundingClientRect(); this.mouse.x = ((e.clientX-r.left)/r.width)*2-1; this.mouse.y = -((e.clientY-r.top)/r.height)*2+1; this.checkHover(); });
		canvas.addEventListener('dblclick', () => { const n = this.getNodeAtMouse(); if (n) this.app.workspace.getLeaf(false).openFile(n.file); });
		canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); const n = this.getNodeAtMouse(); if (n) this.showContextMenu(e, n); });
	}

	checkHover() {
		if (!this.camera) return; this.raycaster.setFromCamera(this.mouse, this.camera);
		if (!this._nodeMeshes || this._nodeMeshes.length !== this.nodes.size) {
			this._nodeMeshes = Array.from(this.nodes.values(), n => n.mesh);
		}
		const hits = this.raycaster.intersectObjects(this._nodeMeshes);
		const prev = this.hoveredNode; this.hoveredNode = null;
		if (hits.length > 0) { const file = hits[0].object.userData.file as TFile | undefined; if (file) this.hoveredNode = this.nodes.get(file.path) || null; }
		if (prev && prev !== this.hoveredNode) { const m = prev.mesh.material as THREE.MeshPhongMaterial; m.emissiveIntensity = 0.15; m.opacity = 0.9; this.highlightLinks(prev, false); }
		if (this.hoveredNode) { const m = this.hoveredNode.mesh.material as THREE.MeshPhongMaterial; m.emissiveIntensity = 0.5; m.opacity = 1; document.body.style.cursor = 'pointer'; this.highlightLinks(this.hoveredNode, true); this.showHoverPreview(this.hoveredNode); }
		else { this.hideHoverPreview(); document.body.style.cursor = 'default'; }
		if (this.focusMode) this.applyFocusMode();
	}

	highlightLinks(node: GraphNode, on: boolean) { this.links.forEach(l => { const u = l.userData; if (u.from === node.file.path || u.to === node.file.path) { const m = l.material as THREE.LineBasicMaterial; m.opacity = on ? 0.8 : 0.2; m.color.setHex(on ? 0x4a9eff : 0x333366); } }); }

	getNodeAtMouse(): GraphNode | null {
		if (!this.camera) return null; this.raycaster.setFromCamera(this.mouse, this.camera);
		const hits = this.raycaster.intersectObjects(Array.from(this.nodes.values()).map(n => n.mesh));
		if (hits.length > 0) { const file = hits[0].object.userData.file as TFile | undefined; return file ? (this.nodes.get(file.path) || null) : null; } return null;
	}

	showContextMenu(e: MouseEvent, node: GraphNode) {
		const menu = new Menu();
		menu.addItem(i => { i.setTitle('Open note').onClick(() => this.app.workspace.getLeaf(false).openFile(node.file)); });
		menu.addItem(i => { i.setTitle('Copy link').onClick(() => { navigator.clipboard.writeText(`[[${node.file.basename}]]`); new Notice('Link copied'); }); });
		menu.addItem(i => { i.setTitle('Focus here').onClick(() => { this.controls.target.set(node.x, node.y, node.z); this.camera.position.set(node.x+20, node.y+15, node.z+20); this.controls.update(); }); });
		menu.showAtPosition({ x: e.clientX, y: e.clientY });
	}

	// ═══════════════════════════════════════════════════════════════════════
	// NOTE PREVIEW ON HOVER
	// ═══════════════════════════════════════════════════════════════════════

	showHoverPreview(node: GraphNode) {
		this.hideHoverPreview();
		this.hoverTimeout = window.setTimeout(() => {
			const file = node.file; const cache = this.metadataCache.getFileCache(file);
			this.hoverPreviewEl = this.containerEl2.createDiv({ cls: 'gf-hover-preview' });
			this.hoverPreviewEl.createDiv({ text: file.basename, cls: 'gf-hover-title' });
			this.vault.cachedRead(file).then(content => { if (!this.hoverPreviewEl) return; const p = content.replace(/[#*`\[\]]/g,'').slice(0,200); const el = this.hoverPreviewEl.createDiv(); el.textContent = p+(content.length>200?'...':''); el.classList.add('gf-hover-content'); }).catch(() => { if (this.hoverPreviewEl) { const el = this.hoverPreviewEl.createDiv({ cls: 'gf-hover-content' }); el.textContent = 'Unable to load preview'; } });
			const tags = new Set<string>(); (cache?.frontmatter?.tags||[]).forEach((t:string)=>tags.add(t)); (cache?.tags||[]).forEach((t:any)=>tags.add(t.tag));
			if (tags.size > 0) { const row = this.hoverPreviewEl.createDiv(); row.addClass('gf-hover-tags'); tags.forEach(t => { row.createSpan({ text: '#'+t, cls: 'gf-hover-tag' }); }); }
			const stats = this.hoverPreviewEl.createDiv({ cls: 'gf-hover-stats' });
			stats.createSpan({ text: `📅 ${new Date(file.stat.mtime).toLocaleDateString()}` });
			stats.createSpan({ text: `🔗 ${node.degree} links` });
		}, 500);
	}

	hideHoverPreview() { if (this.hoverTimeout) { clearTimeout(this.hoverTimeout); this.hoverTimeout = null; } if (this.hoverPreviewEl) { this.hoverPreviewEl.remove(); this.hoverPreviewEl = null; } }

	// ═══════════════════════════════════════════════════════════════════════
	// FOCUS MODE
	// ═══════════════════════════════════════════════════════════════════════

	toggleFocusMode() { this.focusMode = !this.focusMode; if (this.focusMode) this.applyFocusMode(); else this.exitFocusMode(); }

	applyFocusMode() {
		const center = this.selectedNode || this.hoveredNode; if (!center) { this.focusMode = false; return; }
		const connected = new Set<string>(); connected.add(center.file.path);
		center.links.forEach(lp => { connected.add(lp); connected.add(lp + '.md'); });
		this.nodes.forEach(n => { const c = connected.has(n.file.path); const m = n.mesh.material as THREE.MeshPhongMaterial; m.opacity = c ? 0.9 : 0.1; n.mesh.scale.setScalar(c ? 1 : 0.5); });
	}

	exitFocusMode() { this.nodes.forEach(n => { const m = n.mesh.material as THREE.MeshPhongMaterial; m.opacity = 0.9; n.mesh.scale.setScalar(1); }); }

	// ═══════════════════════════════════════════════════════════════════════
	// LAYOUT ALGORITHMS
	// ═══════════════════════════════════════════════════════════════════════

	// Layout animation state
	private _layoutAnimating = false;
	private _layoutAnimId: number | null = null;

	applyLayout(layout: string) {
		this.currentLayout = layout; const nodes = Array.from(this.nodes.values()); const count = nodes.length; if (count === 0) return;
		const duration = 1000; const startTime = performance.now(); const startPos = nodes.map(n => ({ x: n.x, y: n.y, z: n.z }));
		let targets: { x: number; y: number; z: number }[] = [];
		switch (layout) {
			case 'hierarchical': { const sorted = [...nodes].sort((a,b) => b.degree-a.degree); const levels: GraphNode[][] = []; const assigned = new Set<string>(); sorted.forEach(n => { if (assigned.has(n.file.path)) return; const level: GraphNode[] = [n]; assigned.add(n.file.path); n.links.forEach(lp => { const c = this.nodes.get(lp+'.md')||this.nodes.get(lp); if (c && !assigned.has(c.file.path)) { level.push(c); assigned.add(c.file.path); } }); levels.push(level); }); let y = 40; levels.forEach((level, li) => { level.forEach((n, ni) => { const idx = nodes.indexOf(n); targets[idx] = { x: (ni-level.length/2)*12, y: y-li*15, z: 0 }; }); }); break; }
			case 'circular': { const rings = new Map<number, GraphNode[]>(); nodes.forEach(n => { const r = Math.min(n.degree, 5); if (!rings.has(r)) rings.set(r, []); rings.get(r)!.push(n); }); let ri = 0; rings.forEach(rn => { const radius = 10+ri*15; rn.forEach((n, ni) => { const a = (ni/rn.length)*Math.PI*2; const idx = nodes.indexOf(n); targets[idx] = { x: Math.cos(a)*radius, y: Math.sin(a)*radius, z: 0 }; }); ri++; }); break; }
			case 'grid': { const cols = Math.ceil(Math.sqrt(count)); nodes.forEach((n, i) => { targets[i] = { x: (i%cols-cols/2)*10, y: (Math.floor(i/cols)-count/cols/2)*10, z: 0 }; }); break; }
			case 'timeline': { const sorted = [...nodes].sort((a,b) => a.file.stat.ctime-b.file.stat.ctime); sorted.forEach((n, i) => { const idx = nodes.indexOf(n); targets[idx] = { x: (i-count/2)*8, y: 0, z: 0 }; }); break; }
			case 'radial': { const center = this.selectedNode||this.hoveredNode||nodes[0]; const ci = nodes.indexOf(center); targets[ci] = { x: 0, y: 0, z: 0 }; const others = nodes.filter((_,i) => i!==ci); others.forEach((n, i) => { const a = (i/others.length)*Math.PI*2; const r = 20+n.degree*3; const idx = nodes.indexOf(n); targets[idx] = { x: Math.cos(a)*r, y: Math.sin(a)*r, z: 0 }; }); break; }
			case 'solar': {
				// Solar System: hub node at center, others in orbital rings by degree
				const sorted = [...nodes].sort((a,b) => b.degree-a.degree);
				const hub = sorted[0]; const hubIdx = nodes.indexOf(hub);
				targets[hubIdx] = { x: 0, y: 0, z: 0 };
				const planets = sorted.slice(1);
				planets.forEach((n, i) => {
					const idx = nodes.indexOf(n);
					const ring = Math.floor(i / 4); // 4 planets per ring
					const posInRing = i % 4;
					const radius = 15 + ring * 12;
					const angle = (posInRing / 4) * Math.PI * 2 + ring * 0.5; // Offset each ring
					targets[idx] = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z: (Math.random()-0.5) * 4 };
				});
				break;
			}
			case 'galaxy': {
				// Galaxy: spiral arms with golden ratio spacing
				const sorted = [...nodes].sort((a,b) => b.degree-a.degree);
				const core = sorted[0]; const coreIdx = nodes.indexOf(core);
				targets[coreIdx] = { x: 0, y: 0, z: 0 };
				const PHI = 1.6180339887;
				const spacing = 5 + this.forceParams.linkDistance * 15; // Use link distance slider for spacing
				sorted.slice(1).forEach((n, i) => {
					const idx = nodes.indexOf(n);
					const arm = i % 3;
					const armOffset = (arm / 3) * Math.PI * 2;
					const radius = spacing * 0.8 + Math.sqrt(i + 1) * spacing * 0.6;
					const angle = armOffset + radius * 0.3 + (i * PHI * 0.5);
					const zSpread = Math.sin(i * 0.7) * (2 + this.forceParams.gravity * 6);
					targets[idx] = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z: zSpread };
				});
				break;
			}
			default: return;
		}
		// Cancel any running layout animation
		if (this._layoutAnimId) { cancelAnimationFrame(this._layoutAnimId); this._layoutAnimId = null; }
		this._layoutAnimating = true;
		const animate = () => { const elapsed = performance.now()-startTime; const t = Math.min(elapsed/duration, 1); const e = 1-Math.pow(1-t,3); nodes.forEach((n, i) => { if (!targets[i]) return; const s = startPos[i]; n.x = s.x+(targets[i].x-s.x)*e; n.y = s.y+(targets[i].y-s.y)*e; n.z = s.z+(targets[i].z-s.z)*e; n.mesh.position.set(n.x, n.y, n.z); }); this.updateLinkPositions(); if (t<1) { this._layoutAnimId = requestAnimationFrame(animate); } else { this._layoutAnimating = false; this._layoutAnimId = null; } }; animate();
	}

	// ═══════════════════════════════════════════════════════════════════════
	// SUGGESTED CONNECTIONS
	// ═══════════════════════════════════════════════════════════════════════

	private openSuggestConnectionsModal() {
		const modal = new SuggestConnectionsModal(this.app, this.vault, this.metadataCache, this.settings, this.nodes, this.processedSuggestions, (s) => this.highlightSuggestions(s), () => this.clearSuggestionHighlights()); modal.open();
	}

	highlightSuggestions(suggestions: SuggestedConnection[]) {
		this.clearSuggestionHighlights(); suggestions.forEach(s => {
			const src = this.nodes.get(s.source.path); const tgt = this.nodes.get(s.target.path);
			if (src && tgt) {
				const pts = [new THREE.Vector3(src.x, src.y, src.z), new THREE.Vector3(tgt.x, tgt.y, tgt.z)];
				const geo = new THREE.BufferGeometry().setFromPoints(pts);
				const mat = new THREE.LineDashedMaterial({ color: 0x00ffff, dashSize: 4, gapSize: 2, transparent: true, opacity: 1.0 });
				const line = new THREE.Line(geo, mat); line.computeLineDistances(); this.scene.add(line); this.suggestionLines.push(line);
				const sGeo = new THREE.SphereGeometry(1.5, 8, 8); const sMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8 });
				const s1 = new THREE.Mesh(sGeo, sMat); s1.position.copy(pts[0]); this.scene.add(s1); this.suggestionLines.push(s1 as any);
				const s2 = new THREE.Mesh(sGeo.clone(), sMat.clone()); s2.position.copy(pts[1]); this.scene.add(s2); this.suggestionLines.push(s2 as any);
			}
		});
	}

	clearSuggestionHighlights() { this.suggestionLines.forEach(l => { this.scene.remove(l); l.geometry.dispose(); (l.material as THREE.Material).dispose(); }); this.suggestionLines = []; }

	// ═══════════════════════════════════════════════════════════════════════
	// TOOLBAR
	// ═══════════════════════════════════════════════════════════════════════

	setupToolbar() {
		const header = this.containerEl2.createDiv({ cls: 'gf-toolbar' });
		const search = header.createEl('input'); search.type = 'text'; search.placeholder = 'Search...';
		search.classList.add('gf-toolbar-input');
		search.addEventListener('input', (e) => { this.searchQuery = (e.target as HTMLInputElement).value.toLowerCase(); this.applyFilters(); });
		const mkBtn = (text: string, title: string, onClick: () => void) => { const b = header.createEl('button', { text }); b.title = title; b.classList.add('gf-toolbar-btn'); b.addEventListener('click', onClick); return b; };
		mkBtn('🏷️', 'Toggle labels', () => { this.showLabels = !this.showLabels; this.nodes.forEach(n => { n.label.element.style.opacity = this.showLabels ? '1' : '0'; }); });
		mkBtn('🔄', 'Reset view', () => { this.camera.position.set(0, 30, 60); this.controls.reset(); });
		mkBtn('⏸️', 'Pause/Resume layout', () => { this.layoutRunning = !this.layoutRunning; });
		mkBtn('🎯', 'Focus mode', () => this.toggleFocusMode());
		// Layout dropdown
		const layoutSel = header.createEl('select') as HTMLSelectElement; layoutSel.classList.add('gf-toolbar-select');
		[{v:'force',l:'Force'},{v:'hierarchical',l:'Tree'},{v:'circular',l:'Circle'},{v:'grid',l:'Grid'},{v:'timeline',l:'Timeline'},{v:'radial',l:'Radial'},{v:'solar',l:'Solar System'},{v:'galaxy',l:'Galaxy'}].forEach(o => { const opt = layoutSel.createEl('option'); opt.value = o.v; opt.text = o.l; });
		layoutSel.value = this.currentLayout; layoutSel.addEventListener('change', () => this.applyLayout(layoutSel.value));
		// View mode
		const viewSel = header.createEl('select') as HTMLSelectElement; viewSel.classList.add('gf-toolbar-select');
		[{v:'all',l:'All Nodes'},{v:'hub-spoke',l:'Hub & Spoke'},{v:'constellation',l:'Constellation'},{v:'focused',l:'Focused'}].forEach(o => { const opt = viewSel.createEl('option'); opt.value = o.v; opt.text = o.l; });
		viewSel.value = 'all'; viewSel.addEventListener('change', () => this.applyViewMode(viewSel.value));
		// Suggest connections dropdown
		const suggestContainer = header.createDiv({ cls: 'gf-suggest-container' });
		const suggestBtn = suggestContainer.createEl('button', { text: '💡' }); suggestBtn.title = 'Suggest connections'; suggestBtn.classList.add('gf-toolbar-btn');
		const suggestDropdown = suggestContainer.createDiv({ cls: 'gf-suggest-dropdown' });
		suggestDropdown.innerHTML = `<div class="gf-suggest-header">Suggested Connections</div><button id="gf-accept-all" class="gf-suggest-btn">✓ Accept All & Create Links</button><button id="gf-view-suggestions" class="gf-suggest-btn">👁️ View Suggestions</button>`;
		suggestBtn.onclick = () => { suggestDropdown.style.display = suggestDropdown.style.display === 'none' ? 'block' : 'none'; };
		document.addEventListener('click', (e) => { if (!suggestContainer.contains(e.target as Node)) suggestDropdown.style.display = 'none'; });
		suggestDropdown.querySelector('#gf-accept-all')!.addEventListener('click', async () => { suggestDropdown.style.display = 'none'; await this.acceptAllSuggestions(); });
		suggestDropdown.querySelector('#gf-view-suggestions')!.addEventListener('click', () => { suggestDropdown.style.display = 'none'; this.openSuggestConnectionsModal(); });
		mkBtn('📊', 'Analytics', () => this.toggleAnalyticsPanel());
		mkBtn('📤', 'Export', () => this.openExportMenu());
		// Physics engine dropdown
		const physSel = header.createEl('select') as HTMLSelectElement; physSel.classList.add('gf-toolbar-select');
		[{v:'classical',l:'⚡ Classical'},{v:'einstein',l:'🌌 Einstein'},{v:'nexus',l:'🔮 Nexus'}].forEach(o => { const opt = physSel.createEl('option'); opt.value = o.v; opt.text = o.l; });
		physSel.value = this.physicsMode; physSel.addEventListener('change', () => { this.physicsMode = physSel.value as any; new Notice(`Physics: ${physSel.options[physSel.selectedIndex].text}`); });
		// Temporal mode button
		mkBtn('⏳', 'Time Travel', () => this.toggleTemporalMode());
		// Force controls button
		mkBtn('🎛️', 'Force Controls', () => this.toggleForcePanel());
	}

	// ═══════════════════════════════════════════════════════════════════════
	// FORCE CONTROL PANEL
	// ═══════════════════════════════════════════════════════════════════════

	toggleForcePanel() {
		this.forcePanelOpen = !this.forcePanelOpen;
		if (this.forcePanelOpen) this.showForcePanel(); else this.hideForcePanel();
	}

	showForcePanel() {
			this.hideForcePanel();
			this.forcePanelEl = this.containerEl2.createDiv({ cls: 'gf-panel gf-force-panel' });
			const fh = this.forcePanelEl.createDiv({ cls: 'gf-panel-header' });
			fh.createSpan({ text: '🎛️ Force Controls' });
			const closeF = fh.createEl('button', { text: '✕', cls: 'gf-panel-close' }); closeF.onclick = () => this.hideForcePanel();

			// Reset button
			const resetBtn = this.forcePanelEl.createEl('button', { text: '↺ Reset to Defaults', cls: 'gf-panel-reset' });
			resetBtn.onclick = () => { this.forceParams = { gravity: 0.5, repel: 0.5, linkForce: 0.5, linkDistance: 0.5, damping: 0.85 }; this.hideForcePanel(); this.showForcePanel(); new Notice('Forces reset to defaults'); };

			if (!this.forcePanelEl) return;
			const sliders = [
				{ key: 'gravity', label: '🌌 Gravity', min: 0, max: 100, desc: 'Central pull strength' },
				{ key: 'repel', label: '⚡ Repel', min: 20, max: 100, desc: 'Node separation (min 20% to prevent collapse)' },
				{ key: 'linkForce', label: '🔗 Link', min: 10, max: 100, desc: 'Connection strength (min 10%)' },
				{ key: 'linkDistance', label: '💫 Distance', min: 30, max: 100, desc: 'Link rest distance (min 30%)' },
				{ key: 'damping', label: '🌊 Damping/Rotation', min: 50, max: 95, desc: 'Friction / spin resistance' },
			];
			sliders.forEach(s => {
				const row = this.forcePanelEl!.createDiv({ cls: 'gf-slider-row' });
				const lbl = row.createDiv({ cls: 'gf-slider-label' });
				lbl.createSpan({ text: s.label });
				const valSpan = lbl.createSpan({ text: '50%', cls: 'gf-slider-value' });
				const slider = row.createEl('input') as HTMLInputElement;
				slider.type = 'range'; slider.min = String(s.min); slider.max = String(s.max); slider.classList.add('gf-slider');
				slider.value = String(Math.round(this.forceParams[s.key as keyof typeof this.forceParams] * 100));
				slider.addEventListener('input', () => {
					const val = parseInt(slider.value) / 100;
					this.forceParams[s.key as keyof typeof this.forceParams] = val;
					valSpan.textContent = Math.round(val * 100) + '%';
				});
				const desc = row.createDiv({ cls: 'gf-slider-desc' }); desc.textContent = s.desc;
			});
		}

	hideForcePanel() { this.forcePanelEl?.remove(); this.forcePanelEl = null; this.forcePanelOpen = false; }
	// ═══════════════════════════════════════════════════════════════════════

	toggleTemporalMode() {
		this.temporalMode = !this.temporalMode;
		if (this.temporalMode) this.showTemporalPanel(); else this.hideTemporalPanel();
	}

	showTemporalPanel() {
		this.hideTemporalPanel();
		this.temporalPanelEl = this.containerEl2.createDiv({ cls: 'gf-panel gf-temporal-panel' });
		const files = this.vault.getMarkdownFiles();
		const timestamps = files.map(f => f.stat.ctime).filter(t => t > 0);
		const minTime = Math.min(...timestamps); const maxTime = Math.max(...timestamps);
		const range = maxTime - minTime || 1;
		// Date label
		const dateLabel = this.temporalPanelEl.createDiv({ cls: 'gf-temporal-date' }); dateLabel.textContent = new Date(minTime).toLocaleDateString();
		// Slider
		this.temporalSlider = this.temporalPanelEl.createEl('input') as HTMLInputElement;
		this.temporalSlider.type = 'range'; this.temporalSlider.min = '0'; this.temporalSlider.max = '1000'; this.temporalSlider.value = '1000'; this.temporalSlider.classList.add('gf-slider');
		this.temporalSlider.addEventListener('input', () => {
			const val = parseInt(this.temporalSlider!.value);
			const cutoff = minTime + (val / 1000) * range;
			dateLabel.textContent = new Date(cutoff).toLocaleDateString();
			this.nodes.forEach(n => { const ts = n.file.stat.ctime; n.mesh.visible = ts <= cutoff; n.label.element.style.display = ts <= cutoff && this.showLabels ? 'block' : 'none'; });
			this.links.forEach(l => { const u = l.userData; l.visible = (this.nodes.get(u.from)?.mesh.visible && this.nodes.get(u.to)?.mesh.visible) || false; });
		});
		// Controls
		const controls = this.temporalPanelEl.createDiv({ cls: 'gf-temporal-controls' });
		const playBtn = controls.createEl('button', { text: '▶ Play', cls: 'gf-temporal-btn' });
		playBtn.onclick = () => {
			if (this.temporalPlaying) { this.temporalPlaying = false; playBtn.textContent = '▶ Play'; return; }
			this.temporalPlaying = true; playBtn.textContent = '⏸ Pause';
			let val = 0;
			const step = () => { if (!this.temporalPlaying || !this.temporalSlider) return; val += 2; if (val > 1000) val = 0; this.temporalSlider.value = String(val); this.temporalSlider.dispatchEvent(new Event('input')); setTimeout(step, 50); };
			step();
		};
		const closeBtn = controls.createEl('button', { text: '✕ Close', cls: 'gf-temporal-btn' });
		closeBtn.onclick = () => this.hideTemporalPanel();
	}

	hideTemporalPanel() { this.temporalPlaying = false; this.temporalPanelEl?.remove(); this.temporalPanelEl = null; }

	applyViewMode(mode: string) {
		this.nodes.forEach(n => {
			let visible = true;
			if (mode === 'hub-spoke') visible = n.degree >= 3;
			else if (mode === 'focused' && this.hoveredNode) { visible = n.file.path === this.hoveredNode.file.path || this.hoveredNode.links.some(lp => lp === n.file.path.replace('.md', '') || lp + '.md' === n.file.path); }
			n.mesh.visible = visible; n.label.element.style.display = visible && this.showLabels ? 'block' : 'none';
		});
		this.links.forEach(l => { const u = l.userData; l.visible = (this.nodes.get(u.from)?.mesh.visible && this.nodes.get(u.to)?.mesh.visible) || false; });
	}

	async acceptAllSuggestions() {
		const files = this.vault.getMarkdownFiles(); const existingLinks = new Map<string, Set<string>>();
		files.forEach(f => { const cache = this.metadataCache.getFileCache(f); const links = new Set<string>(); (cache?.links||[]).forEach((l:any) => { links.add(l.link); links.add(l.link+'.md'); }); existingLinks.set(f.path, links); });
		const suggestions = findSuggestedConnections(files, this.metadataCache, existingLinks, 50);
		const filtered = suggestions.filter(s => { const k1 = s.source.path+'<->'+s.target.path; const k2 = s.target.path+'<->'+s.source.path; return !this.processedSuggestions.has(k1) && !this.processedSuggestions.has(k2); });
		if (filtered.length === 0) { new Notice('No new suggestions found'); return; }
		this.highlightSuggestions(filtered); let count = 0;
		for (const s of filtered) { try { await this.addWikilinkToNote(s.source, s.target.basename); await this.addWikilinkToNote(s.target, s.source.basename); this.processedSuggestions.add(s.source.path+'<->'+s.target.path); count++; } catch(e) { console.error(e); } }
		this.clearSuggestionHighlights(); new Notice(`Created ${count} connection(s)`);
	}

	async addWikilinkToNote(file: TFile, targetName: string) {
		try { const content = await this.vault.read(file); const linkText = `[[${targetName}]]`; if (content.includes(linkText)) return;
			let newContent: string; if (content.startsWith('---')) { const fmEnd = content.indexOf('---', 3); if (fmEnd >= 0) { newContent = content.substring(0, fmEnd+3)+'\n'+linkText+'\n'+content.substring(fmEnd+3); } else { newContent = content+'\n'+linkText+'\n'; } } else { newContent = content+'\n'+linkText+'\n'; }
			await this.vault.modify(file, newContent);
		} catch(e) { console.error('GraphForge: Failed to add wikilink', e); }
	}

	applyFilters() {
		const q = this.searchQuery.toLowerCase();
		this.nodes.forEach(n => { const match = !q || n.file.basename.toLowerCase().includes(q) || n.file.path.toLowerCase().includes(q); n.mesh.visible = match; n.label.element.style.display = match && this.showLabels ? 'block' : 'none'; });
		this.links.forEach(l => { const u = l.userData; l.visible = (this.nodes.get(u.from)?.mesh.visible && this.nodes.get(u.to)?.mesh.visible) || false; });
	}

	toggleAnalyticsPanel() { this.analyticsPanelOpen = !this.analyticsPanelOpen; if (this.analyticsPanelOpen) this.showAnalyticsPanel(); else this.hideAnalyticsPanel(); }

	hideAnalyticsPanel() { this.analyticsPanelEl?.remove(); this.analyticsPanelEl = null; this.analyticsPanelOpen = false; }

	showAnalyticsPanel() {
		this.hideAnalyticsPanel();
		const files = this.vault.getMarkdownFiles();
		const getLinks = (f: TFile) => {
			const cache = this.metadataCache.getFileCache(f);
			return (cache?.links || []).map((l: any) => l.link);
		};
		const analytics = computeAnalytics(files, this.metadataCache, this.vault, getLinks);

		this.analyticsPanelEl = this.containerEl2.createDiv({ cls: 'gf-analytics-panel' });

		// Header
		const header = this.analyticsPanelEl.createDiv({ cls: 'gf-panel-header' });
		header.createSpan({ text: '📊 Graph Analytics', cls: 'gf-analytics-title' });
		const closeBtn = header.createEl('button', { text: '✕' });
		closeBtn.classList.add('gf-panel-close');
		closeBtn.onclick = () => this.hideAnalyticsPanel();

		// Stat cards row
		const cards = this.analyticsPanelEl.createDiv(); cards.addClass('gf-analytics-cards');
		const statCards = [
			{ label: 'Nodes', value: analytics.totalNodes, icon: '🔵', color: '#4a9eff' },
			{ label: 'Links', value: analytics.totalConnections, icon: '🔗', color: '#50fa7b' },
			{ label: 'Orphans', value: analytics.orphanedCount, icon: '⚪', color: '#ffb86c' },
			{ label: 'Density', value: (analytics.connectionDensity * 100).toFixed(1) + '%', icon: '📈', color: '#bd93f9' },
		];
		statCards.forEach(card => {
			const c = cards.createDiv();
			c.addClass('gf-analytics-card');
			c.createDiv({ text: card.icon, cls: 'gf-analytics-card-icon' });
			const valEl = c.createDiv({ cls: 'gf-analytics-card-value' }); valEl.textContent = String(card.value); valEl.style.color = card.color;
			c.createDiv({ text: card.label, cls: 'gf-analytics-card-label' });
		});

		// Most connected section
		const mcSection = this.analyticsPanelEl.createDiv();
		mcSection.style.marginBottom = '14px';
		mcSection.createDiv({ text: '🏆 Most Connected', cls: 'gf-analytics-section-header' });
		analytics.mostConnected.slice(0, 5).forEach((note, i) => {
			const row = mcSection.createDiv();
			row.addClass('gf-analytics-mc-row');
			const medal = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i] || '•';
			row.createSpan({ text: medal, cls: 'gf-analytics-mc-medal' });
			const info = row.createDiv({ cls: 'gf-analytics-mc-info' });
			info.createDiv({ text: note.name, cls: 'gf-analytics-mc-name' });
			info.createDiv({ text: note.path, cls: 'gf-analytics-mc-path' });
			row.createSpan({ text: String(note.count), cls: 'gf-analytics-mc-count' });
		});

		// Weekly activity bar chart
		const weekSection = this.analyticsPanelEl.createDiv();
		weekSection.style.marginBottom = '14px';
		weekSection.createDiv({ text: '📅 Weekly Activity', cls: 'gf-analytics-section-header' });
		const maxWeekCount = Math.max(...analytics.notesPerWeek.map(w => w.count), 1);
		const chart = weekSection.createDiv();
		chart.addClass('gf-analytics-chart');
		analytics.notesPerWeek.forEach(week => {
			const barCol = chart.createDiv();
			barCol.addClass('gf-analytics-bar-col');
			const barHeight = Math.max((week.count / maxWeekCount) * 40, 2);
			const bar = barCol.createDiv(); bar.addClass('gf-analytics-bar'); bar.style.height = `${barHeight}px`;
			barCol.createDiv({ text: week.label, cls: 'gf-analytics-bar-label' });
		});

		// Connection distribution
		const distSection = this.analyticsPanelEl.createDiv();
		distSection.createDiv({ text: '📊 Connection Distribution', cls: 'gf-analytics-section-header' });
		const distBars = [
			{ label: '0 links', count: analytics.orphanedCount, color: '#ffb86c' },
			{ label: '1-2 links', count: files.filter(f => { const l = getLinks(f).length; return l >= 1 && l <= 2; }).length, color: '#8be9fd' },
			{ label: '3-5 links', count: files.filter(f => { const l = getLinks(f).length; return l >= 3 && l <= 5; }).length, color: '#4a9eff' },
			{ label: '6+ links', count: files.filter(f => getLinks(f).length >= 6).length, color: '#bd93f9' },
		];
		const maxDist = Math.max(...distBars.map(d => d.count), 1);
		distBars.forEach(d => {
			const row = distSection.createDiv();
			row.style.marginBottom = '6px';
			const labelRow = row.createDiv();
			labelRow.addClass('gf-analytics-dist-label-row');
			labelRow.createSpan({ text: d.label, cls: 'gf-analytics-dist-label' });
			labelRow.createSpan({ text: String(d.count), cls: 'gf-analytics-dist-value' });
			const barBg = row.createDiv();
			barBg.addClass('gf-analytics-bar-bg');
			const barFill = barBg.createDiv(); barFill.addClass('gf-analytics-bar-fill'); barFill.style.width = `${(d.count / maxDist) * 100}%`; barFill.style.background = d.color;
		});
	}
	openExportMenu() {
		const menu = new Menu();
		menu.addItem(i => {
			i.setTitle('📷 Export as PNG').setIcon('image').onClick(() => this.exportPNG());
		});
		menu.addItem(i => {
			i.setTitle('🌐 Export as Interactive HTML').setIcon('globe').onClick(() => this.exportHTML());
		});
		menu.addItem(i => {
			i.setTitle('📄 Export as JSON').setIcon('file-json').onClick(() => this.exportJSON());
		});
		menu.showAtPosition({ x: this.containerEl2.getBoundingClientRect().right - 200, y: 50 });
	}

	private exportPNG() {
		if (!this.renderer) return;
		try {
			this.renderer.render(this.scene, this.camera);
			const dataURL = this.renderer.domElement.toDataURL('image/png');
			const link = document.createElement('a');
			link.download = `graphforge-export-${Date.now()}.png`;
			link.href = dataURL;
			link.click();
			new Notice('✅ PNG exported successfully');
		} catch (e) { new Notice('❌ Export failed: ' + (e as Error).message); }
	}

	private exportJSON() {
		try {
			const data = {
				nodes: Array.from(this.nodes.values()).map(n => ({
					name: n.file.basename,
					path: n.file.path,
					degree: n.degree,
					x: Math.round(n.x * 100) / 100,
					y: Math.round(n.y * 100) / 100,
					z: Math.round(n.z * 100) / 100,
				})),
				links: this.links.map(l => ({
					from: l.userData.from,
					to: l.userData.to,
				})),
				metadata: {
					exportedAt: new Date().toISOString(),
					totalNodes: this.nodes.size,
					totalLinks: this.links.length,
				}
			};
			const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
			const link = document.createElement('a');
			link.download = `graphforge-export-${Date.now()}.json`;
			link.href = URL.createObjectURL(blob);
			link.click();
			URL.revokeObjectURL(link.href);
			new Notice('✅ JSON exported successfully');
		} catch (e) { new Notice('❌ Export failed: ' + (e as Error).message); }
	}

	private exportHTML() {
		try {
			const data = {
				nodes: Array.from(this.nodes.values()).map(n => ({
					name: n.file.basename, path: n.file.path, degree: n.degree,
					x: n.x, y: n.y, z: n.z,
				})),
				links: this.links.map(l => ({ from: l.userData.from, to: l.userData.to })),
			};
			const html = `<!DOCTYPE html><html><head><title>GraphForge Export</title><style>body{margin:0;background:#0a0a1e;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh}#info{position:fixed;top:20px;left:20px;background:rgba(0,0,0,0.7);padding:16px;border-radius:8px;backdrop-filter:blur(8px)}#info h2{margin:0 0 8px;font-size:16px;color:#4a9eff}#info p{margin:0;font-size:12px;color:#888}</style></head><body><div id="info"><h2>GraphForge Export</h2><p>Nodes: ${data.nodes.length} | Links: ${data.links.length}</p><p>Exported: ${new Date().toLocaleString()}</p></div><script>const data=${JSON.stringify(data)};const canvas=document.createElement('canvas');canvas.width=window.innerWidth;canvas.height=window.innerHeight;document.body.appendChild(canvas);const ctx=canvas.getContext('2d');const cx=canvas.width/2,cy=canvas.height/2,scale=8;function draw(){ctx.fillStyle='#0a0a1e';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='rgba(74,158,255,0.15)';ctx.lineWidth=0.5;data.links.forEach(l=>{const s=data.nodes.find(n=>n.path===l.from);const t=data.nodes.find(n=>n.path===l.to);if(s&&t){ctx.beginPath();ctx.moveTo(s.x*scale+cx,s.y*scale+cy);ctx.lineTo(t.x*scale+cx,t.y*scale+cy);ctx.stroke()}});data.nodes.forEach(n=>{const x=n.x*scale+cx,y=n.y*scale+cy;const r=Math.min(3+n.degree*1.5,12);const g=ctx.createRadialGradient(x,y,0,x,y,r*3);g.addColorStop(0,'rgba(74,158,255,0.9)');g.addColorStop(1,'rgba(74,158,255,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r*3,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()})}draw();window.addEventListener('resize',()=>{canvas.width=window.innerWidth;canvas.height=window.innerHeight;draw()})</script></body></html>`;
			const blob = new Blob([html], { type: 'text/html' });
			const link = document.createElement('a');
			link.download = `graphforge-export-${Date.now()}.html`;
			link.href = URL.createObjectURL(blob);
			link.click();
			URL.revokeObjectURL(link.href);
			new Notice('✅ HTML exported successfully');
		} catch (e) { new Notice('❌ Export failed: ' + (e as Error).message); }
	}

	// ═══════════════════════════════════════════════════════════════════════
	// CLEANUP
	// ═══════════════════════════════════════════════════════════════════════

	async onClose() {
		if (this.animationId) cancelAnimationFrame(this.animationId);
		this.renderer.dispose();
		this.controls.dispose();
		this.composer?.dispose();
		// Dispose all node geometries, materials, and DOM elements
		this.nodes.forEach(n => {
			n.mesh.geometry.dispose();
			(n.mesh.material as THREE.Material).dispose();
			n.label.element.remove();
		});
		this.nodes.clear();
		// Dispose all link geometries and materials
		this.links.forEach(l => {
			l.geometry.dispose();
			(l.material as THREE.Material).dispose();
		});
		this.links = [];
		// Clean up UI panels
		this.clearSuggestionHighlights();
		this.hideHoverPreview();
		this.hideForcePanel();
		this.hideTemporalPanel();
		this.analyticsPanelEl?.remove();
		this.filterPanelEl?.remove();
		// Clear the scene
		this.scene.clear();
	}
}

// ═══════════════════════════════════════════════════════════════════════
// SUGGESTIONS MODAL
// ═══════════════════════════════════════════════════════════════════════

class SuggestConnectionsModal extends Modal {
	private suggestions: SuggestedConnection[] = []; private accepted: Set<number> = new Set(); private rejected: Set<number> = new Set();
	private nodes: Map<string, any>; private settings: GraphForgeSettings; private processedPairs: Set<string>;
	private onOpenHighlight: (s: SuggestedConnection[]) => void; private onCloseHighlight: () => void;

	constructor(app: App, private vault: Vault, private metadataCache: MetadataCache, settings: GraphForgeSettings, nodes: Map<string, any>, processedPairs: Set<string>, onOpenHighlight: (s: SuggestedConnection[]) => void, onCloseHighlight: () => void) {
		super(app); this.nodes = nodes; this.settings = settings; this.processedPairs = processedPairs; this.onOpenHighlight = onOpenHighlight; this.onCloseHighlight = onCloseHighlight;
	}

	onOpen() {
		const { contentEl } = this; contentEl.empty();
		contentEl.addClass('suggest-modal');
		const header = contentEl.createDiv({ cls: 'suggest-modal-header' });
		header.createEl('h2', { text: '💡 Suggestions', cls: 'suggest-modal-title' });
		const closeBtn = header.createEl('button', { text: '✕', cls: 'suggest-modal-close' }); closeBtn.onclick = () => this.close();
		const files = this.vault.getMarkdownFiles(); const existingLinks = new Map<string, Set<string>>();
		files.forEach(f => { const cache = this.metadataCache.getFileCache(f); const links = new Set<string>(); (cache?.links||[]).forEach((l:any) => { links.add(l.link); links.add(l.link+'.md'); }); existingLinks.set(f.path, links); });
		this.suggestions = findSuggestedConnections(files, this.metadataCache, existingLinks, 20);
		this.suggestions = this.suggestions.filter(s => { const k1 = s.source.path+'<->'+s.target.path; const k2 = s.target.path+'<->'+s.source.path; return !this.processedPairs.has(k1) && !this.processedPairs.has(k2); });
		if (this.suggestions.length > 0) this.onOpenHighlight(this.suggestions);
		if (this.suggestions.length === 0) { const empty = contentEl.createDiv({ cls: 'suggest-modal-empty' }); empty.createDiv({ text: '✅ No new suggestions', cls: 'suggest-modal-empty-title' }); empty.createDiv({ text: 'All potentially related notes may already be linked.', cls: 'suggest-modal-empty-sub' }); return; }
		const acceptAllBar = contentEl.createDiv({ cls: 'suggest-modal-accept-all' });
		const acceptAllBtn = acceptAllBar.createEl('button', { text: `Accept All (${this.suggestions.length})`, cls: 'suggest-modal-accept-all-btn' });
		acceptAllBtn.onclick = async () => { this.suggestions.forEach((_, idx) => { this.accepted.add(idx); this.rejected.delete(idx); }); await this.applyAccepted(); new Notice(`Created ${this.accepted.size} connection(s)`); this.close(); };
		const listContainer = contentEl.createDiv({ cls: 'suggest-modal-list' }); (listContainer as any)._listContainer = true; this.renderSuggestions(contentEl);
	}

	private async applyAccepted() { for (const idx of this.accepted) { const s = this.suggestions[idx]; if (!s) continue; try { await this.addWikilink(s.source, s.target.basename); await this.addWikilink(s.target, s.source.basename); this.processedPairs.add(s.source.path+'<->'+s.target.path); } catch(e) { console.error(e); } } }

	private async addWikilink(file: TFile, targetName: string) { try { const content = await this.vault.read(file); const linkText = `[[${targetName}]]`; if (content.includes(linkText)) return; let nc: string; if (content.startsWith('---')) { const fe = content.indexOf('---', 3); nc = fe >= 0 ? content.substring(0,fe+3)+'\n'+linkText+'\n'+content.substring(fe+3) : content+'\n'+linkText+'\n'; } else { nc = content+'\n'+linkText+'\n'; } await this.vault.modify(file, nc); } catch(e) { console.error(e); } }

	private renderSuggestions(contentEl: HTMLElement) {
		let lc = contentEl.querySelector('.suggest-modal-list') as HTMLElement | null;
		if (!lc) { lc = contentEl.createDiv({ cls: 'suggest-modal-list' }); }
		lc.empty();
		this.suggestions.forEach((s, idx) => {
			const isAcc = this.accepted.has(idx); const isRej = this.rejected.has(idx);
			const row = lc!.createDiv({ cls: 'suggest-modal-row' });
			if (isAcc) row.addClass('accepted');
			if (isRej) row.addClass('rejected');
			const badge = row.createDiv({ cls: 'suggest-modal-badge' }); badge.textContent = String(s.score);
			const info = row.createDiv({ cls: 'gf-analytics-mc-info' });
			const titleRow = info.createDiv({ cls: 'suggest-modal-title-row' }); titleRow.textContent = `${s.source.basename} ↔ ${s.target.basename}`;
			const reasonRow = info.createDiv({ cls: 'suggest-modal-reason' }); reasonRow.textContent = s.reason;
			const actions = row.createDiv({ cls: 'suggest-modal-actions' });
			if (!isAcc && !isRej) {
				const accBtn = actions.createEl('button', { text: '✓', cls: 'suggest-modal-acc-btn' }); accBtn.onclick = () => { this.accepted.add(idx); this.rejected.delete(idx); this.renderSuggestions(contentEl); };
				const rejBtn = actions.createEl('button', { text: '✕', cls: 'suggest-modal-rej-btn' }); rejBtn.onclick = () => { this.rejected.add(idx); this.accepted.delete(idx); this.renderSuggestions(contentEl); };
			} else if (isAcc) {
				actions.createSpan({ text: '✓ Added', cls: 'suggest-modal-added' });
			} else {
				actions.createSpan({ text: 'Skipped', cls: 'suggest-modal-skipped' });
			}
		});
	}
	onClose() { this.onCloseHighlight(); super.onClose(); }
}

// Suppress unused warnings
void [computeAnalytics];
